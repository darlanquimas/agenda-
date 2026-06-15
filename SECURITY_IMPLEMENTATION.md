# 🔒 Implementação de Melhorias de Segurança

## ✅ O que foi implementado

Todas as vulnerabilidades críticas e de alta prioridade foram corrigidas. O sistema agora possui:

### 🛡️ Segurança do Webhook
1. ✅ Autenticação obrigatória via API Key
2. ✅ Suporte para assinatura HMAC (opcional)
3. ✅ Rate limiting específico (100 req/min)
4. ✅ Validação de origem das mensagens

### 🔐 Validação de Tokens
5. ✅ Validação OBRIGATÓRIA de token em confirmações
6. ✅ Dupla validação (token + telefone)
7. ✅ Validação de formato do token
8. ✅ Expiração automática de tokens (48h)

### 📝 Auditoria e Logging
9. ✅ Tabela `security_logs` para auditoria
10. ✅ Registro de eventos suspeitos
11. ✅ Mascaramento de dados sensíveis
12. ✅ Respostas genéricas (não expõe detalhes)

## 🚀 Como Aplicar as Mudanças

### Passo 1: Aplicar Migration no Banco de Dados

```bash
cd server

# Aplicar migration
npx prisma migrate deploy

# Regenerar cliente Prisma
npx prisma generate
```

**Migration aplicada:**
- Adiciona campo `confirmation_token_expires_at` em `appointments`
- Cria tabela `security_logs` com índices
- Adiciona comentários de documentação

### Passo 2: Configurar Variáveis de Ambiente

**Gerar secret seguro:**
```bash
openssl rand -hex 32
```

**Adicionar ao `.env`:**
```env
# Webhook Security (CRÍTICO)
WEBHOOK_SECRET=<cole o valor gerado acima>

# Token Configuration
CONFIRMATION_TOKEN_EXPIRATION_HOURS=48
```

### Passo 3: Instalar Dependências (se necessário)

```bash
cd server
npm install
```

### Passo 4: Reiniciar o Servidor

```bash
npm run dev
# ou em produção
npm start
```

### Passo 5: Configurar Evolution API

Configure o webhook para incluir o header de autenticação:

**Opção A: Via API**
```bash
curl -X POST 'https://api.evolution.com.br/instance/YOUR_INSTANCE/webhook' \
  -H 'apikey: YOUR_EVOLUTION_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "webhook": {
      "url": "https://seu-dominio.com/webhook/whatsapp/YOUR_INSTANCE",
      "headers": {
        "X-API-Key": "SEU_WEBHOOK_SECRET_AQUI"
      },
      "events": ["messages.upsert"]
    }
  }'
```

**Opção B: Via Interface Web**
1. Acesse painel da Evolution API
2. Vá em Configurações > Webhook
3. URL: `https://seu-dominio.com/webhook/whatsapp/INSTANCE_NAME`
4. Adicione header customizado:
   - Nome: `X-API-Key`
   - Valor: `<seu WEBHOOK_SECRET>`
5. Salve

### Passo 6: Testar o Webhook

**Teste 1: Endpoint de teste**
```bash
curl -X GET 'http://localhost:3001/webhook/whatsapp/test'
# Deve retornar: {"status":"ok","message":"Webhook está acessível e funcionando!"}
```

**Teste 2: Autenticação**
```bash
# Sem API Key (deve falhar)
curl -X POST 'http://localhost:3001/webhook/whatsapp/test' \
  -H 'Content-Type: application/json' \
  -d '{}'
# Retorno esperado: 401 Unauthorized

# Com API Key (deve funcionar)
curl -X POST 'http://localhost:3001/webhook/whatsapp/test' \
  -H 'X-API-Key: SEU_WEBHOOK_SECRET' \
  -H 'Content-Type: application/json' \
  -d '{}'
# Retorno esperado: 200 OK
```

**Teste 3: Criar agendamento e confirmar**
```bash
# 1. Criar agendamento via API pública
curl -X POST 'http://localhost:3001/api/booking/SEU_TENANT/\
  -H 'Content-Type: application/json' \
  -d '{
    "professional_id": 1,
    "service_id": 1,
    "date": "2026-06-20",
    "time": "14:00",
    "customer_name": "Teste Segurança",
    "customer_phone": "22999999999"
  }'

# 2. Verifique o token no banco
# SELECT confirmation_token, confirmation_token_expires_at 
# FROM appointments WHERE customer_phone = '22999999999';

# 3. Envie mensagem no WhatsApp: "SIM TOKEN_AQUI"
# 4. Verifique logs de segurança:
# SELECT * FROM security_logs ORDER BY created_at DESC LIMIT 10;
```

## 📊 Verificar Implementação

### Checklist de Verificação

- [ ] Migration aplicada com sucesso
- [ ] Campo `confirmation_token_expires_at` existe em `appointments`
- [ ] Tabela `security_logs` criada
- [ ] `WEBHOOK_SECRET` configurado no `.env`
- [ ] Servidor reiniciado
- [ ] Evolution API configurada com header `X-API-Key`
- [ ] Teste de autenticação passou
- [ ] Teste de token com expiração funciona
- [ ] Logs de segurança são registrados

### Consultas de Verificação

```sql
-- 1. Verificar estrutura da tabela appointments
\d appointments

-- 2. Verificar tabela security_logs
SELECT * FROM security_logs LIMIT 5;

-- 3. Verificar tokens com expiração
SELECT id, customer_name, confirmation_token, 
       confirmation_token_expires_at,
       (confirmation_token_expires_at > NOW()) as is_valid
FROM appointments 
WHERE confirmation_token IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 4. Verificar eventos de segurança
SELECT event_type, COUNT(*) as total
FROM security_logs
GROUP BY event_type;
```

## 🔍 Monitoramento Pós-Implementação

### Primeiras 24 horas

Monitore:
1. Eventos `webhook_invalid_*` na tabela `security_logs`
2. Taxa de erro 401 no webhook
3. Tokens expirados
4. Confirmações bem-sucedidas

### Consultas de Monitoramento

```sql
-- Dashboard de segurança (últimas 24h)
SELECT 
  event_type,
  COUNT(*) as occurrences,
  COUNT(DISTINCT ip_address) as unique_ips,
  MAX(created_at) as last_occurrence
FROM security_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY occurrences DESC;

-- IPs suspeitos
SELECT ip_address, event_type, COUNT(*) as attempts
FROM security_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND event_type LIKE 'webhook_invalid%'
GROUP BY ip_address, event_type
HAVING COUNT(*) > 5
ORDER BY attempts DESC;

-- Taxa de sucesso
SELECT 
  ROUND(100.0 * 
    SUM(CASE WHEN event_type = 'webhook_confirmation_success' THEN 1 ELSE 0 END) / 
    COUNT(*), 2
  ) as success_rate_percent
FROM security_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND event_type IN ('webhook_confirmation_success', 'webhook_invalid_token');
```

## 🚨 Troubleshooting

### Erro: "WEBHOOK_SECRET não configurado"

**Solução:**
```bash
# Gerar secret
openssl rand -hex 32

# Adicionar ao .env
echo "WEBHOOK_SECRET=<valor_gerado>" >> server/.env

# Reiniciar servidor
```

### Erro: 401 Unauthorized no webhook

**Causa:** Header `X-API-Key` não está sendo enviado pela Evolution API

**Solução:**
1. Verifique configuração do webhook na Evolution API
2. Certifique-se que header `X-API-Key` está configurado
3. Valor deve ser idêntico ao `WEBHOOK_SECRET`

### Tokens expirando muito rápido

**Causa:** Tempo de expiração muito curto

**Solução:**
```env
# Aumentar para 72 horas
CONFIRMATION_TOKEN_EXPIRATION_HOURS=72
```

### Muitos eventos "webhook_invalid_token"

**Possíveis causas:**
1. Clientes tentando confirmar sem token
2. Mensagens antigas sendo processadas
3. Tentativa de ataque

**Investigação:**
```sql
SELECT details, COUNT(*) as total
FROM security_logs
WHERE event_type = 'webhook_invalid_token'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY details
ORDER BY total DESC;
```

## 📚 Arquivos Criados/Modificados

### Novos Arquivos
- `server/middleware/webhookAuth.ts` - Autenticação do webhook
- `server/lib/securityUtils.ts` - Utilitários de segurança
- `server/prisma/migrations/20260615_add_security_features/migration.sql` - Migration
- `WEBHOOK_SECURITY.md` - Documentação de segurança
- `SECURITY_IMPLEMENTATION.md` - Este arquivo

### Arquivos Modificados
- `server/config/index.ts` - Novas configurações
- `server/middleware/rateLimit.ts` - Rate limit do webhook
- `server/routes/whatsapp-webhook.ts` - Validações de segurança
- `server/routes/booking.ts` - Expiração de tokens
- `server/index.ts` - Middlewares de segurança
- `server/.env.example` - Novas variáveis
- `server/prisma/schema.prisma` - Novos campos e tabela
- `TOKEN_CONFIRMATION_SYSTEM.md` - Documentação atualizada

## 🎯 Próximos Passos

1. **Imediato:**
   - [ ] Aplicar migration em produção
   - [ ] Configurar `WEBHOOK_SECRET` em produção
   - [ ] Atualizar Evolution API com header de autenticação
   - [ ] Testar fluxo completo

2. **Esta Semana:**
   - [ ] Configurar alertas para eventos suspeitos
   - [ ] Criar dashboard de monitoramento
   - [ ] Documentar processo para equipe

3. **Próximas 2 Semanas:**
   - [ ] Revisar logs de segurança semanalmente
   - [ ] Ajustar rate limits se necessário
   - [ ] Implementar relatórios automáticos

## 💡 Dicas de Segurança

1. **Nunca** commite o `WEBHOOK_SECRET` no Git
2. Use secrets diferentes para dev/staging/production
3. Rotacione o `WEBHOOK_SECRET` a cada 90 dias
4. Configure alertas para eventos `webhook_invalid_*`
5. Mantenha logs por pelo menos 90 dias
6. Revise `security_logs` semanalmente

## 🆘 Suporte

Em caso de dúvidas ou problemas:
1. Consulte `WEBHOOK_SECURITY.md` para detalhes
2. Verifique logs em `server/logs/`
3. Consulte `security_logs` no banco
4. Revise configurações no `.env`

---

**Data de Implementação:** 2026-06-15  
**Versão:** 1.0  
**Status:** ✅ Pronto para produção
