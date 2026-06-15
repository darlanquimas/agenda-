# Guia de Segurança do Webhook WhatsApp

## 🔒 Visão Geral

Este documento descreve as medidas de segurança implementadas no webhook do WhatsApp para proteger o sistema contra ataques e uso indevido.

## 🛡️ Camadas de Segurança Implementadas

### 1. Autenticação do Webhook (CRÍTICO)

**Middleware:** `webhookAuth.ts`

O webhook agora requer autenticação obrigatória em todas as requisições:

#### API Key (Obrigatório)
- Header `X-API-Key` deve conter o valor de `WEBHOOK_SECRET`
- Comparação timing-safe para prevenir timing attacks
- Rejeita requisições sem API Key válida

#### Assinatura HMAC (Opcional)
- Header `X-Evolution-Signature` pode conter assinatura HMAC-SHA256
- Valida integridade do payload
- Previne adulteração de mensagens em trânsito

**Configuração:**
```env
WEBHOOK_SECRET=your-long-random-secret-here
```

**Geração segura:**
```bash
openssl rand -hex 32
```

### 2. Validação Obrigatória de Token

**Localização:** `whatsapp-webhook.ts`

Todas as confirmações/cancelamentos agora exigem token:

#### Validações Implementadas:
1. ✅ **Presença do token** - Mensagem deve conter token de 8 caracteres
2. ✅ **Formato válido** - Apenas A-Z e 0-9 (maiúsculas)
3. ✅ **Token + Telefone** - Dupla validação no banco de dados
4. ✅ **Status pendente** - Apenas agendamentos não processados
5. ✅ **Expiração** - Token válido por 48h (configurável)

**Exemplo:**
```
Cliente envia: "SIM A7K9M2X4"
Sistema valida:
  ✅ Token: A7K9M2X4
  ✅ Telefone: 22999999999
  ✅ Status: pending
  ✅ Expiração: 2026-06-17 14:30
```

### 3. Rate Limiting Específico

**Middleware:** `rateLimit.ts`

Limites aplicados ao webhook:
- **100 requisições** por janela
- **Janela de 1 minuto**
- Previne flood e ataques DDoS

**Configuração:**
```typescript
export const webhookLimiter = rateLimit({ 
  max: 100,
  windowMs: 60 * 1000,
  message: { error: 'Muitas requisições no webhook' },
});
```

### 4. Auditoria de Segurança

**Tabela:** `security_logs`

Todos os eventos suspeitos são registrados:

#### Eventos Rastreados:
- `webhook_invalid_origin` - Origem não é WhatsApp válida
- `webhook_missing_token` - Tentativa sem token
- `webhook_invalid_token_format` - Token em formato inválido
- `webhook_invalid_token` - Token não encontrado ou telefone incorreto
- `webhook_expired_token` - Token expirado
- `webhook_confirmation_success` - Confirmação bem-sucedida
- `webhook_error` - Erro interno

**Schema:**
```sql
CREATE TABLE security_logs (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100),
  ip_address VARCHAR(45),
  user_agent TEXT,
  tenant_id INTEGER,
  user_id INTEGER,
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 5. Expiração de Tokens

**Configuração:** `CONFIRMATION_TOKEN_EXPIRATION_HOURS=48`

Tokens expiram automaticamente:
- Tempo padrão: **48 horas**
- Campo: `confirmation_token_expires_at`
- Validação no webhook

**Benefícios:**
- Limita janela de ataques
- Força renovação de confirmações antigas
- Reduz tokens válidos em circulação

### 6. Validação de Origem

**Utilitário:** `securityUtils.ts`

Valida origem das mensagens:

```typescript
function isValidWhatsAppOrigin(remoteJid: string): boolean {
  return remoteJid.endsWith('@s.whatsapp.net');
}
```

Rejeita:
- Mensagens de grupos
- Mensagens de canais
- Origens inválidas

### 7. Mascaramento de Dados Sensíveis

**Utilitário:** `securityUtils.ts`

Dados sensíveis são mascarados nos logs:

| Tipo | Antes | Depois |
|------|-------|--------|
| Telefone | 22999887766 | 22****7766 |
| Email | user@example.com | u***@e***.com |
| Token | A7K9M2X4 | A7****X4 |

**Funções:**
- `maskPhone()`
- `maskEmail()`
- `maskToken()`
- `sanitizeForLog()`

### 8. Respostas Genéricas

Todas as respostas retornam `{ success: true }`, independente do resultado:

❌ **ANTES (inseguro):**
```json
{ "error": "Token não encontrado" }
{ "error": "Telefone não corresponde" }
```

✅ **AGORA (seguro):**
```json
{ "success": true }
```

**Benefício:** Atacantes não conseguem enumerar tokens ou telefones válidos.

## 🚀 Configuração em Produção

### 1. Variáveis de Ambiente Obrigatórias

```env
# Gere um secret forte
WEBHOOK_SECRET=<gerar com: openssl rand -hex 32>

# Configure expiração
CONFIRMATION_TOKEN_EXPIRATION_HOURS=48

# URL base do webhook
WEBHOOK_BASE_URL=https://seu-dominio.com
```

### 2. Aplicar Migration

```bash
cd server
npx prisma migrate deploy
npx prisma generate
```

### 3. Configurar Evolution API

Configure o webhook com autenticação:

```bash
curl -X POST 'https://api.evolution.com.br/instance/webhook' \
  -H 'apikey: YOUR_EVOLUTION_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "webhook": {
      "url": "https://seu-dominio.com/webhook/whatsapp/instance-name",
      "headers": {
        "X-API-Key": "seu-webhook-secret-aqui"
      }
    }
  }'
```

### 4. Monitoramento

Monitore a tabela `security_logs`:

```sql
-- Eventos suspeitos nas últimas 24h
SELECT event_type, COUNT(*) as total, 
       MAX(created_at) as last_occurrence
FROM security_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY total DESC;

-- IPs com mais tentativas suspeitas
SELECT ip_address, COUNT(*) as attempts
FROM security_logs
WHERE event_type LIKE 'webhook_invalid%'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY ip_address
HAVING COUNT(*) > 10
ORDER BY attempts DESC;
```

## 📊 Métricas de Segurança

### KPIs Recomendados

1. **Taxa de Tokens Inválidos**
   - Meta: < 5% das requisições
   - Alerta: > 20%

2. **Tentativas de Acesso Não Autorizado**
   - Meta: 0 por dia
   - Alerta: Qualquer ocorrência

3. **Tokens Expirados**
   - Meta: < 10% das confirmações
   - Otimização: Ajustar tempo de expiração

4. **Taxa de Sucesso**
   - Meta: > 95% das confirmações legítimas
   - Investigar: Quedas súbitas

## 🔍 Troubleshooting

### Webhook Retornando 401

**Possíveis causas:**
1. `WEBHOOK_SECRET` não configurado
2. Header `X-API-Key` ausente
3. API Key incorreta

**Solução:**
```bash
# Verificar configuração
echo $WEBHOOK_SECRET

# Testar webhook
curl -X POST 'http://localhost:3001/webhook/whatsapp/test' \
  -H 'X-API-Key: seu-secret' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

### Tokens Expirando Muito Rápido

**Ajustar tempo de expiração:**
```env
# Aumentar para 72 horas
CONFIRMATION_TOKEN_EXPIRATION_HOURS=72
```

### Rate Limit Bloqueando Usuários Legítimos

**Aumentar limites:**
```typescript
// server/middleware/rateLimit.ts
export const webhookLimiter = rateLimit({ 
  max: 200,  // Aumentar de 100 para 200
  windowMs: 60 * 1000,
});
```

## 🎯 Boas Práticas

### ✅ FAÇA

- Use HTTPS em produção (obrigatório)
- Gere `WEBHOOK_SECRET` com 32+ caracteres aleatórios
- Monitore `security_logs` diariamente
- Configure alertas para eventos `webhook_invalid_*`
- Mantenha logs por pelo menos 90 dias
- Teste autenticação antes de ir para produção

### ❌ NÃO FAÇA

- Não use secrets fracos ou previsíveis
- Não exponha `WEBHOOK_SECRET` em logs ou código
- Não desabilite rate limiting em produção
- Não ignore alertas de segurança
- Não compartilhe tokens entre ambientes

## 📚 Referências

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)
- [HMAC Authentication](https://tools.ietf.org/html/rfc2104)

## 🆘 Suporte

Em caso de incidentes de segurança:
1. Revogue o `WEBHOOK_SECRET` comprometido
2. Gere novo secret
3. Atualize Evolution API com novo secret
4. Analise `security_logs` para avaliar impacto
5. Documente incidente

---

**Última atualização:** 2026-06-15
**Versão:** 1.0
