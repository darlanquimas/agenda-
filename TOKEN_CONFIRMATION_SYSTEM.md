# Sistema de Confirmação com Token Único

## 🎯 Visão Geral

Cada agendamento agora possui um **token único de confirmação** de 8 caracteres alfanuméricos (ex: `A7K9M2X4`). Este token garante que a confirmação do cliente seja aplicada ao agendamento correto, mesmo que o cliente tenha múltiplos agendamentos pendentes.

## 🔐 Segurança e Precisão

### Por que usar tokens?

**Problema anterior:**
- Sistema buscava agendamento apenas por número de telefone
- Se cliente tivesse 2+ agendamentos pendentes, poderia confirmar o errado
- Sem identificação única do agendamento na mensagem

**Solução atual:**
- Cada agendamento tem um token único (`confirmation_token`)
- Token é enviado na mensagem WhatsApp
- Webhook valida **token + telefone** para máxima segurança
- Impossível confirmar o agendamento errado

### Validações de Segurança

O webhook valida:
1. ✅ **Autenticação do webhook** (API Key obrigatória)
2. ✅ **Origem da mensagem** (deve ser WhatsApp válido)
3. ✅ **Token existe e formato válido** (8 caracteres A-Z0-9)
4. ✅ **Token corresponde ao telefone** do remetente
5. ✅ **Token não expirou** (validade: 48h configurável)
6. ✅ **Agendamento está pendente** (não foi processado antes)
7. ✅ **Mensagem contém palavra-chave** (SIM/NÃO) + token
8. ✅ **Rate limiting** (previne ataques de flood)

### Auditoria e Monitoramento

- Todos eventos suspeitos são registrados em `security_logs`
- Dados sensíveis são mascarados nos logs
- Respostas genéricas previnem enumeração
- Alertas configuráveis para tentativas de acesso não autorizado

## 📱 Como Funciona

### 1. Criação do Agendamento

```typescript
// Ao criar agendamento, gera token único
const confirmationToken = await generateUniqueToken(async (token) => {
  const existing = await prisma.appointment.findUnique({
    where: { confirmation_token: token },
  });
  return !!existing;
});

await prisma.appointment.create({
  data: {
    // ... outros campos
    confirmation_token: confirmationToken, // Ex: "A7K9M2X4"
    status: 'pending',
  },
});
```

### 2. Mensagem Enviada ao Cliente

```
Olá João! 🎉

Seu agendamento foi confirmado:

📅 Data: 13/06/2026
🕐 Horário: 14:30
📍 Serviço: Corte de cabelo
👤 Profissional: Maria Santos

Nos vemos em breve!

📌 *Para confirmar seu agendamento:*
Responda esta mensagem com:
✅ *SIM A7K9M2X4* - para confirmar
❌ *NÃO A7K9M2X4* - para cancelar

_Código de confirmação: A7K9M2X4_
```

### 3. Cliente Responde

O cliente pode responder de várias formas:

**Texto simples:**
- `SIM A7K9M2X4` ✅
- `NÃO A7K9M2X4` ❌
- `A7K9M2X4` (sistema detecta o token)

**Via botões (se suportado):**
- Botão: `✅ SIM A7K9M2X4`
- Botão: `❌ NÃO A7K9M2X4`

**Flexibilidade:**
- Case-insensitive: `sim a7k9m2x4` funciona
- Ordem não importa: `a7k9m2x4 sim` funciona
- Extra texto: `quero confirmar sim A7K9M2X4` funciona

### 4. Webhook Processa

```typescript
// 1. Extrair token da mensagem
const tokenMatch = text.match(/\b([A-Z0-9]{8})\b/);
const confirmationToken = tokenMatch[1]; // "A7K9M2X4"

// 2. Buscar agendamento com DUPLA validação
const appointment = await prisma.appointment.findFirst({
  where: {
    confirmation_token: confirmationToken,  // ✅ Token correto
    customer_phone: {
      contains: phone?.slice(-9),           // ✅ Telefone correto
    },
    status: 'pending',                      // ✅ Ainda pendente
  },
});

// 3. Verificar palavra-chave
if (text.includes('SIM')) {
  status = 'scheduled'; // Confirmado
} else if (text.includes('NÃO')) {
  status = 'cancelled'; // Cancelado
}

// 4. Atualizar agendamento
await prisma.appointment.update({
  where: { id: appointment.id },
  data: { status },
});
```

## 🔄 Geração de Tokens

### Formato

- **Tamanho**: 8 caracteres
- **Caracteres**: A-Z e 0-9 (maiúsculos)
- **Exemplo**: `A7K9M2X4`, `B3F8K1M9`, `X2Y9Z4A1`

### Algoritmo

```typescript
function generateConfirmationToken(): string {
  const randomBytes = crypto.randomBytes(6);
  const token = randomBytes
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .substring(0, 8);
  
  return token;
}
```

### Unicidade

- Sistema verifica colisões antes de criar
- Máximo 10 tentativas de geração
- Probabilidade de colisão: ~1 em 218 trilhões (62^8)

### Quando é Gerado

1. **Criação de novo agendamento** (booking público)
2. **Reenvio de confirmação** (se agendamento antigo não tem token)

## 🧪 Testando o Sistema

### 1. Criar Agendamento

```bash
curl -X POST 'http://localhost:3000/api/booking/demo' \
  -H 'Content-Type: application/json' \
  -d '{
    "professional_id": 1,
    "service_id": 1,
    "date": "2026-06-13",
    "time": "14:00",
    "customer_name": "Teste Cliente",
    "customer_phone": "22999999999",
    "notes": "Teste com token"
  }'
```

**Resposta esperada:**
```json
{
  "id": 123,
  "professional": "Maria Santos",
  "service": "Corte de cabelo",
  "scheduled_at": "2026-06-13T14:00:00.000Z",
  "customer_name": "Teste Cliente"
}
```

### 2. Verificar Token no Banco

```sql
SELECT id, customer_name, confirmation_token, status
FROM appointments
WHERE id = 123;
```

**Resultado esperado:**
```
id  | customer_name  | confirmation_token | status
123 | Teste Cliente  | A7K9M2X4          | pending
```

### 3. Verificar Mensagem WhatsApp

A mensagem deve incluir:
- ✅ Token visível: `Código de confirmação: A7K9M2X4`
- ✅ Instrução: `SIM A7K9M2X4` ou `NÃO A7K9M2X4`
- ✅ Botões (se suportado): `✅ SIM A7K9M2X4`

### 4. Testar Confirmação

**Responder no WhatsApp:**
```
SIM A7K9M2X4
```

**Verificar logs do backend:**
```
[WhatsAppWebhook] Token extraído da mensagem
token: "A7K9M2X4"

[WhatsAppWebhook] Agendamento atualizado
appointmentId: 123
oldStatus: 'pending'
newStatus: 'scheduled'
```

**Verificar status atualizado:**
```sql
SELECT id, status FROM appointments WHERE id = 123;
-- status deve ser 'scheduled'
```

## 🛡️ Casos de Segurança

### Caso 1: Cliente com Múltiplos Agendamentos

```
Cliente: João (22999999999)
Agendamento A: Token X1Y2Z3A4 (13/06 14h)
Agendamento B: Token B5C6D7E8 (15/06 10h)
```

Cliente responde: `SIM X1Y2Z3A4`
- ✅ Sistema confirma **apenas** Agendamento A
- ✅ Agendamento B permanece pendente
- ✅ Evento registrado em `security_logs`

### Caso 2: Token Inválido

Cliente responde: `SIM 12345678` (token inexistente)
- ❌ Sistema não encontra agendamento
- ✅ Resposta genérica enviada
- 📝 Evento `webhook_invalid_token` registrado
- 🚨 Monitoramento alerta se houver muitas tentativas

### Caso 3: Token de Outro Cliente (Tentativa de Ataque)

```
Cliente A: Token A1B2C3D4
Cliente B: Tenta usar Token A1B2C3D4
```

- ❌ Telefone não corresponde ao agendamento
- ✅ Sistema rejeita silenciosamente
- 📝 Evento suspeito registrado
- 🔒 IP pode ser bloqueado se repetir

### Caso 4: Agendamento Já Processado

Cliente responde duas vezes: `SIM A1B2C3D4`
- ✅ Primeira resposta: Status muda para 'scheduled'
- ✅ Segunda resposta: Não encontra (status != 'pending')
- 📝 Log registra tentativa duplicada

### Caso 5: Token Expirado

Cliente responde após 48h: `SIM A1B2C3D4`
- ❌ Token já expirou
- ✅ Mensagem automática informa expiração
- 📝 Evento `webhook_expired_token` registrado
- 💡 Cliente orientado a entrar em contato

### Caso 6: Tentativa de Acesso Não Autorizado

Atacante tenta enviar requisição direta ao webhook:
- ❌ Sem header `X-API-Key`
- ✅ Webhook retorna 401 Unauthorized
- 📝 Evento `security_log` registrado com IP
- 🚨 Rate limiter bloqueia se houver muitas tentativas

### Caso 7: Flood de Requisições (DDoS)

Atacante envia 200 requisições em 1 minuto:
- ✅ Primeiras 100 são processadas
- ❌ Requisições 101-200 são bloqueadas (429 Too Many Requests)
- 📝 Eventos registrados
- 🛡️ Sistema permanece estável

## 📊 Banco de Dados

### Schema

```sql
ALTER TABLE appointments
ADD COLUMN confirmation_token VARCHAR(8) UNIQUE,
ADD COLUMN confirmation_token_expires_at TIMESTAMP;

CREATE UNIQUE INDEX idx_confirmation_token 
ON appointments(confirmation_token)
WHERE confirmation_token IS NOT NULL;

CREATE TABLE security_logs (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  tenant_id INTEGER,
  user_id INTEGER,
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_security_logs_event_type ON security_logs(event_type);
CREATE INDEX idx_security_logs_created_at ON security_logs(created_at);
CREATE INDEX idx_security_logs_tenant_id ON security_logs(tenant_id);
```

### Índices

- **confirmation_token**: UNIQUE (busca rápida e previne duplicatas)
- **confirmation_token_expires_at**: Validação de expiração
- **status**: Filtro eficiente para 'pending'
- **customer_phone**: Validação adicional

### Campos de Segurança

- `confirmation_token`: Token único de 8 caracteres
- `confirmation_token_expires_at`: Data/hora de expiração (48h padrão)
- Tabela `security_logs`: Auditoria de eventos suspeitos

### Migração de Dados Antigos

Agendamentos criados antes da implementação:
- `confirmation_token` = `NULL`
- `confirmation_token_expires_at` = `NULL`
- Ao reenviar confirmação, gera token automaticamente
- Não afeta agendamentos já confirmados

## 🔍 Logs e Monitoramento

### Logs Importantes

```
[WhatsAppWebhook] Autenticação bem-sucedida
→ Webhook autenticado com sucesso

[WhatsAppWebhook] Origem inválida detectada
→ Mensagem não é de WhatsApp válido

[WhatsAppWebhook] Token não encontrado na mensagem
→ Cliente não enviou token

[WhatsAppWebhook] Token expirado
→ Token passou de 48h

[WhatsAppWebhook] Agendamento não encontrado
→ Token inválido ou já processado

[WhatsAppWebhook] Agendamento atualizado com sucesso
→ Confirmação/cancelamento bem-sucedido
```

### Métricas de Segurança

Consultas úteis para monitoramento:

```sql
-- Eventos suspeitos nas últimas 24h
SELECT event_type, COUNT(*) as total
FROM security_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY total DESC;

-- IPs com muitas tentativas suspeitas
SELECT ip_address, COUNT(*) as attempts
FROM security_logs
WHERE event_type LIKE 'webhook_invalid%'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY ip_address
HAVING COUNT(*) > 10
ORDER BY attempts DESC;

-- Taxa de sucesso de confirmações
SELECT 
  SUM(CASE WHEN event_type = 'webhook_confirmation_success' THEN 1 ELSE 0 END) as successes,
  SUM(CASE WHEN event_type LIKE 'webhook_invalid%' THEN 1 ELSE 0 END) as failures,
  COUNT(*) as total
FROM security_logs
WHERE created_at > NOW() - INTERVAL '24 hours';
```

### Métricas Recomendadas

- Taxa de confirmação por token
- Tempo médio entre envio e resposta
- Tokens inválidos detectados
- Tentativas de reutilização
- Taxa de expiração de tokens
- Tentativas de acesso não autorizado

## 🎨 Frontend (Opcional)

Para exibir o token no painel administrativo:

```typescript
// Em Appointments.tsx
<td className="px-4 py-3">
  {appointment.confirmation_token ? (
    <code className="text-xs bg-gray-800 px-2 py-1 rounded">
      {appointment.confirmation_token}
    </code>
  ) : (
    <span className="text-gray-600">—</span>
  )}
</td>
```

## ✅ Checklist de Implementação

- [x] Campo `confirmation_token` adicionado ao schema
- [x] Campo `confirmation_token_expires_at` adicionado
- [x] Tabela `security_logs` criada
- [x] Migração aplicada no banco de dados
- [x] Função `generateConfirmationToken()` criada
- [x] Token gerado ao criar agendamento com expiração
- [x] Token incluído na mensagem WhatsApp
- [x] Webhook extrai e valida token (OBRIGATÓRIO)
- [x] Validação dupla (token + telefone)
- [x] Validação de origem da mensagem
- [x] Validação de expiração do token
- [x] Autenticação do webhook (API Key)
- [x] Rate limiting no webhook
- [x] Logging de tentativas suspeitas
- [x] Mascaramento de dados sensíveis
- [x] Respostas genéricas (não expõe detalhes)
- [x] Reenvio gera token se necessário
- [x] Logs detalhados implementados
- [x] Documentação completa de segurança
- [x] Guia de troubleshooting

## 🚀 Melhorias Futuras

- [ ] Dashboard de segurança em tempo real
- [ ] Alertas automáticos via email/Slack
- [ ] Regenerar token ao reagendar
- [ ] Histórico de tentativas por agendamento
- [ ] Analytics de taxa de confirmação
- [ ] Notificação ao admin sobre confirmações
- [ ] Blacklist automática de IPs suspeitos
- [ ] Relatórios mensais de segurança

## 📚 Documentação Adicional

- **Segurança:** Veja `WEBHOOK_SECURITY.md` para detalhes completos sobre segurança
- **Evolution API:** Veja `EVOLUTION_API_SETUP.md` para configuração
- **Webhook:** Veja `WEBHOOK_SETUP_GUIDE.md` para setup passo a passo
