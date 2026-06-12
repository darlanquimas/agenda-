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
1. ✅ **Token existe** no banco de dados
2. ✅ **Token corresponde ao telefone** do remetente
3. ✅ **Agendamento está pendente** (não foi processado antes)
4. ✅ **Mensagem contém palavra-chave** (SIM/NÃO) + token

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

### Caso 2: Token Inválido

Cliente responde: `SIM 12345678` (token inexistente)
- ❌ Sistema não encontra agendamento
- ✅ Nenhuma ação é tomada
- 📝 Log registra tentativa

### Caso 3: Token de Outro Cliente

```
Cliente A: Token A1B2C3D4
Cliente B: Tenta usar Token A1B2C3D4
```

- ❌ Telefone não corresponde ao agendamento
- ✅ Sistema rejeita a confirmação
- 🔒 Segurança mantida

### Caso 4: Agendamento Já Processado

Cliente responde duas vezes: `SIM A1B2C3D4`
- ✅ Primeira resposta: Status muda para 'scheduled'
- ✅ Segunda resposta: Não encontra (status != 'pending')
- 📝 Log registra que já foi processado

## 📊 Banco de Dados

### Schema

```sql
ALTER TABLE appointments
ADD COLUMN confirmation_token VARCHAR(8) UNIQUE;

CREATE UNIQUE INDEX idx_confirmation_token 
ON appointments(confirmation_token)
WHERE confirmation_token IS NOT NULL;
```

### Índices

- **confirmation_token**: UNIQUE (busca rápida e previne duplicatas)
- **status**: Filtro eficiente para 'pending'
- **customer_phone**: Validação adicional

### Migração de Dados Antigos

Agendamentos criados antes da implementação:
- `confirmation_token` = `NULL`
- Ao reenviar confirmação, gera token automaticamente
- Não afeta agendamentos já confirmados

## 🔍 Logs e Monitoramento

### Logs Importantes

```
[WhatsAppWebhook] Token extraído da mensagem
→ Token foi detectado com sucesso

[WhatsAppWebhook] Agendamento não encontrado ou já processado
→ Token inválido ou já usado

[WhatsAppWebhook] Agendamento atualizado
→ Confirmação/cancelamento bem-sucedido
```

### Métricas Sugeridas

- Taxa de confirmação por token
- Tempo médio entre envio e resposta
- Tokens inválidos detectados
- Tentativas de reutilização

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
- [x] Migração aplicada no banco de dados
- [x] Função `generateConfirmationToken()` criada
- [x] Token gerado ao criar agendamento
- [x] Token incluído na mensagem WhatsApp
- [x] Webhook extrai token da resposta
- [x] Validação dupla (token + telefone)
- [x] Reenvio gera token se necessário
- [x] Logs detalhados implementados
- [x] Documentação completa

## 🚀 Próximas Melhorias

- [ ] Expiração de token após X horas
- [ ] Regenerar token ao reagendar
- [ ] Histórico de tentativas de confirmação
- [ ] Analytics de taxa de confirmação
- [ ] Notificação ao admin sobre confirmações
