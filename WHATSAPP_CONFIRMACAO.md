# Sistema de Confirmação de Agendamentos via WhatsApp

## 🎯 Visão Geral

O sistema agora implementa confirmação **interativa** de agendamentos via WhatsApp. Quando um cliente faz um agendamento pela página pública, ele recebe uma mensagem com botões para confirmar ou cancelar.

## 🔄 Fluxo de Funcionamento

### 1. Cliente Agenda
- Cliente acessa `/book/[tenant-slug]`
- Preenche dados do agendamento
- Informa número de WhatsApp

### 2. Agendamento Criado com Status "Pendente"
- Status inicial: `pending` (Pendente de confirmação)
- Sistema envia mensagem WhatsApp automaticamente

### 3. Mensagem de Confirmação
Cliente recebe mensagem com:
- ✅ Detalhes do agendamento (data, horário, serviço, profissional)
- 📱 **Botões interativos** para responder
- 📝 ID do agendamento (para rastreamento)

Exemplo de mensagem:
```
Olá João! 🎉

Seu agendamento foi confirmado:

📅 Data: 12/06/2026
🕐 Horário: 14:30
📍 Serviço: Corte de cabelo
👤 Profissional: Maria Santos

Nos vemos em breve!

📌 *Para confirmar seu agendamento:*
Responda esta mensagem com:
✅ *SIM* - para confirmar
❌ *NÃO* - para cancelar

_ID: 123_
```

### 4. Cliente Responde
Cliente pode responder de 3 formas:

**a) Clicando nos botões:**
- ✅ Confirmar
- ❌ Cancelar

**b) Enviando mensagem de texto:**
- "Sim", "sim", "SIM" → Confirma
- "Não", "não", "NÃO", "nao" → Cancela

**c) Palavras-chave:**
- "confirmar" → Confirma
- "cancelar" → Cancela

### 5. Status Atualizado Automaticamente
- ✅ **"SIM"** → Status muda para `scheduled` (Agendado)
- ❌ **"NÃO"** → Status muda para `cancelled` (Cancelado)
- 📝 Registrado no log de atividades

## ⚙️ Configuração do Webhook na Evolution API

Para que o sistema receba as respostas do WhatsApp, você precisa configurar o webhook na Evolution API.

### Método 1: Via API (Recomendado)

```bash
curl -X POST 'http://localhost:8081/webhook/set/NOME_DA_INSTANCIA' \
  -H 'apikey: SUA_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "http://SEU_SERVIDOR:3000/webhook/whatsapp/NOME_DA_INSTANCIA",
    "webhook_by_events": false,
    "webhook_base64": false,
    "events": [
      "MESSAGES_UPSERT"
    ]
  }'
```

**Exemplo prático:**
```bash
curl -X POST 'http://localhost:8081/webhook/set/bbnb' \
  -H 'apikey: testkey' \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "http://localhost:3000/webhook/whatsapp/bbnb",
    "webhook_by_events": false,
    "webhook_base64": false,
    "events": [
      "MESSAGES_UPSERT"
    ]
  }'
```

### Método 2: Via Painel da Evolution API

1. Acesse o painel da Evolution API (se disponível)
2. Vá em **Configurações da Instância**
3. Configure o Webhook:
   - **URL**: `http://SEU_SERVIDOR:3000/webhook/whatsapp/NOME_DA_INSTANCIA`
   - **Eventos**: Marque `MESSAGES_UPSERT`
   - **Base64**: Desmarque (false)
   - **By Events**: Desmarque (false)

### Método 3: Via Variáveis de Ambiente (Docker Compose)

Adicione no `docker-compose.yml` da Evolution API:

```yaml
services:
  evolution-api:
    environment:
      - WEBHOOK_GLOBAL_URL=http://seu-backend:3000/webhook/whatsapp
      - WEBHOOK_GLOBAL_ENABLED=true
      - WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=false
```

## 🧪 Testando o Sistema

### 1. Criar Agendamento de Teste

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
    "notes": "Teste de confirmação"
  }'
```

### 2. Verificar Logs

**Backend:**
```
[WhatsApp] Confirmação de agendamento enviada
[EvolutionAPI] Mensagem com botões enviada
```

**Evolution API:**
```
[ChannelStartupService] Checking 1 numbers via Baileys
```

### 3. Responder no WhatsApp

Abra o WhatsApp e responda:
- "Sim" ou clique em ✅ Confirmar
- "Não" ou clique em ❌ Cancelar

### 4. Verificar Mudança de Status

**No painel:**
- Acesse **Agendamentos**
- Verifique se o status mudou para "Agendado" ou "Cancelado"

**Nos logs:**
```
[WhatsAppWebhook] Agendamento atualizado
appointmentId: 123
oldStatus: 'pending'
newStatus: 'scheduled' ou 'cancelled'
```

## 📊 Status dos Agendamentos

| Status | Descrição | Cor | Ícone |
|--------|-----------|-----|-------|
| `pending` | Aguardando confirmação do cliente | Laranja | ⚠️ |
| `scheduled` | Confirmado pelo cliente | Azul | 🕐 |
| `cancelled` | Cancelado pelo cliente | Cinza | 🚫 |
| `running` | Em execução | Amarelo | ▶️ |
| `finished` | Finalizado | Verde | ✅ |
| `failed` | Falhou | Vermelho | ❌ |

## 🔧 Troubleshooting

### Webhook não está recebendo mensagens

1. **Verificar se webhook está configurado:**
```bash
curl -X GET 'http://localhost:8081/webhook/find/bbnb' \
  -H 'apikey: testkey'
```

2. **Verificar logs do backend:**
```bash
# Procure por:
[WhatsAppWebhook] Mensagem recebida
```

3. **Verificar conectividade:**
- Evolution API consegue acessar o backend?
- Firewall bloqueando a porta 3000?

### Mensagens não estão sendo processadas

1. **Verificar se o número está correto:**
- Deve ter 11 dígitos: `(22) 99999-9999`
- Sistema adiciona código do país automaticamente: `5522999999999`

2. **Verificar logs:**
```
[WhatsAppWebhook] Processando mensagem
from: "5522999999999"
text: "sim"
```

3. **Verificar agendamento pendente:**
- Cliente tem agendamento com status `pending`?
- Telefone cadastrado corresponde ao número que respondeu?

### Botões não aparecem no WhatsApp

Se os botões interativos não funcionarem (alguns dispositivos podem não suportar), o sistema:
- ✅ **Automaticamente** envia como mensagem de texto simples
- ✅ Cliente pode responder normalmente com "sim" ou "não"
- ✅ Funciona em **qualquer** dispositivo WhatsApp

## 📱 Compatibilidade

### Botões Interativos
- ✅ WhatsApp Business API
- ✅ WhatsApp Web
- ✅ WhatsApp Android (versões recentes)
- ⚠️ WhatsApp iOS (pode não exibir botões)

### Resposta por Texto
- ✅ **Todos** os dispositivos
- ✅ Funciona como fallback automático

## 🚀 Melhorias Futuras

- [ ] Múltiplas tentativas de confirmação
- [ ] Lembrete automático se não confirmar em X horas
- [ ] Reagendamento via WhatsApp
- [ ] Notificações de lembrete (24h antes)
- [ ] Templates personalizados por tipo de serviço
- [ ] Suporte a múltiplos idiomas

## 📝 Variáveis do Template

As variáveis de personalização da mensagem continuam funcionando:

| Variável | Descrição |
|----------|-----------|
| `{{cliente}}` | Nome do cliente |
| `{{data}}` | Data do agendamento |
| `{{horario}}` | Horário do agendamento |
| `{{servico}}` | Nome do serviço |
| `{{profissional}}` | Nome do profissional |

Configure em: **WhatsApp > Configurações**
