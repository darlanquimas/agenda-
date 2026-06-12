# Mensagens de Confirmação WhatsApp

## Visão Geral

O sistema agora envia automaticamente mensagens de confirmação via WhatsApp quando um cliente faz um agendamento pela página pública de booking.

## Funcionalidades

### 1. Envio Automático
- Quando um cliente agenda através da página pública (`/book/:tenantSlug`)
- Se o cliente informar um número de telefone
- E houver uma instância WhatsApp conectada
- O sistema envia automaticamente uma mensagem de confirmação

### 2. Configuração Personalizável

Acesse **WhatsApp > Configurações** no painel administrativo para:

- **Ativar/Desativar** o envio automático
- **Selecionar instância padrão** para envio
- **Personalizar o template** da mensagem

### 3. Variáveis Disponíveis

O template da mensagem aceita as seguintes variáveis:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `{{cliente}}` | Nome do cliente | João Silva |
| `{{data}}` | Data do agendamento | 12/06/2026 |
| `{{horario}}` | Horário do agendamento | 14:30 |
| `{{servico}}` | Nome do serviço | Corte de cabelo |
| `{{profissional}}` | Nome do profissional | Maria Santos |

### 4. Template Padrão

```
Olá {{cliente}}! 🎉

Seu agendamento foi confirmado:

📅 Data: {{data}}
🕐 Horário: {{horario}}
📍 Serviço: {{servico}}
👤 Profissional: {{profissional}}

Nos vemos em breve!
```

## Como Configurar

### Passo 1: Conectar uma instância WhatsApp
1. Acesse **WhatsApp > Instâncias**
2. Crie uma nova instância ou reconecte uma existente
3. Certifique-se que o status está **"Conectado"**

### Passo 2: Configurar mensagens
1. Acesse **WhatsApp > Configurações**
2. Marque **"Enviar mensagem de confirmação automaticamente"**
3. Selecione a **instância padrão** (ou deixe em branco para usar a primeira conectada)
4. Personalize o **template da mensagem** com as variáveis disponíveis
5. Clique em **"Salvar Configuração"**

### Passo 3: Teste
1. Acesse a página pública de agendamento: `/book/[seu-slug]`
2. Faça um agendamento informando um número de WhatsApp
3. Verifique se a mensagem foi recebida

## Detalhes Técnicos

### Banco de Dados
Nova tabela `whatsapp_config`:
- `tenant_id`: ID do tenant
- `confirmation_message`: Template da mensagem
- `send_confirmation`: Flag para ativar/desativar
- `default_instance_id`: ID da instância padrão (opcional)

### API Endpoints
- `GET /api/whatsapp-config` - Buscar configuração
- `PUT /api/whatsapp-config` - Atualizar configuração

### Arquivos Criados/Modificados

**Backend:**
- `server/services/whatsappService.ts` - Service para envio de mensagens
- `server/routes/whatsapp-config.ts` - Rotas de configuração
- `server/services/evolutionApiService.ts` - Adicionado `sendTextMessage()`
- `server/routes/booking.ts` - Integrado envio de mensagem
- `server/prisma/schema.prisma` - Adicionado `WhatsAppConfig` model

**Frontend:**
- `client/src/pages/WhatsApp.tsx` - Adicionado aba "Configurações"

### Formato do Número

O sistema aceita números nos seguintes formatos:
- `5511999999999` (preferido)
- `(11) 99999-9999`
- `11 99999-9999`

Internamente, o sistema converte para o formato do WhatsApp: `5511999999999@s.whatsapp.net`

## Logs e Troubleshooting

### Verificar se a mensagem foi enviada
Verifique os logs do backend:

```bash
cd server
npm run dev
```

Procure por:
- `[WhatsApp] Confirmação de agendamento enviada` - Sucesso
- `[WhatsApp] Envio de confirmação desabilitado` - Configuração desativada
- `[WhatsApp] Nenhuma instância conectada` - Sem instância ativa
- `[WhatsApp] Erro ao enviar confirmação` - Erro no envio

### Problemas Comuns

**Mensagem não é enviada:**
1. Verifique se há uma instância **conectada**
2. Verifique se o envio está **ativado** nas configurações
3. Verifique se o cliente informou um **número de telefone**
4. Verifique os **logs do backend** para erros

**Variáveis não são substituídas:**
- Certifique-se de usar a sintaxe correta: `{{variavel}}`
- Verifique se não há espaços dentro das chaves

## Segurança

- O envio de mensagens **não bloqueia** o fluxo de agendamento
- Se houver erro ao enviar, o agendamento é criado normalmente
- Apenas instâncias do mesmo tenant podem ser usadas
- Logs detalhados são gerados para auditoria

## Próximas Melhorias

- [ ] Mensagens de lembrete (24h antes)
- [ ] Mensagens de cancelamento
- [ ] Mensagens de reagendamento
- [ ] Templates múltiplos por tipo de serviço
- [ ] Suporte a mensagens com mídia (imagens, PDFs)
- [ ] Botões interativos de confirmação
