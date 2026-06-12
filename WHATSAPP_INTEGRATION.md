# Integração WhatsApp - Evolution API

## Visão Geral

Este documento descreve a integração do sistema Agenda+ com a Evolution API para gerenciamento de instâncias do WhatsApp.

## Configuração

### 1. Variáveis de Ambiente

Adicione as seguintes variáveis no arquivo `server/.env`:

```env
EVOLUTION_API_URL=https://sua-url-evolution-api:8081
EVOLUTION_API_KEY=sua-chave-api-aqui
```

### 2. Estrutura do Banco de Dados

Foi criada a tabela `whatsapp_instances` com os seguintes campos:

- `id`: Identificador único
- `tenant_id`: ID do tenant proprietário
- `instance_name`: Nome da instância (único por tenant)
- `instance_id`: ID gerado pela Evolution API
- `phone_number`: Número do WhatsApp conectado
- `status`: Status da conexão (open, connecting, close, disconnected)
- `qr_code`: QR Code para conexão (base64 ou código)
- `connected_at`: Data/hora da última conexão
- `created_at` e `updated_at`: Timestamps de auditoria

## Funcionalidades Implementadas

### Backend

#### Service: `evolutionApiService.ts`

Classe responsável pela comunicação com a Evolution API:

- `createInstance(data)`: Criar nova instância
- `fetchQrCode(instanceName)`: Buscar QR Code para conexão
- `getConnectionStatus(instanceName)`: Consultar status da conexão
- `deleteInstance(instanceName)`: Deletar instância
- `logoutInstance(instanceName)`: Desconectar instância
- `restartInstance(instanceName)`: Reiniciar instância

#### Rotas: `routes/whatsapp.ts`

Endpoints REST disponíveis:

- `GET /api/whatsapp` - Listar todas as instâncias do tenant
- `GET /api/whatsapp/:id` - Buscar instância específica
- `POST /api/whatsapp` - Criar nova instância
- `POST /api/whatsapp/:id/reconnect` - Reconectar e gerar novo QR Code
- `GET /api/whatsapp/:id/status` - Consultar status atual
- `POST /api/whatsapp/:id/disconnect` - Desconectar instância
- `DELETE /api/whatsapp/:id` - Deletar instância

### Frontend

#### Página: `pages/WhatsApp.tsx`

Interface de gerenciamento com as seguintes funcionalidades:

- **Visualização**: Lista em cards todas as instâncias do tenant
- **Criação**: Modal para criar nova instância
- **QR Code**: Modal para exibir QR Code de conexão
- **Status**: Badges coloridos indicando o status (Conectado, Conectando, Desconectado)
- **Ações**:
  - Conectar: Gera QR Code para conectar
  - Desconectar: Desconecta a instância ativa
  - Status: Atualiza o status da instância
  - Excluir: Remove a instância

#### Menu: Adicionado item "WhatsApp" na seção "Operação"

## Fluxo de Uso

### Criar Nova Instância

1. Acessar o menu "WhatsApp" no sistema
2. Clicar em "Nova Instância"
3. Informar um nome para a instância (ex: atendimento, vendas, suporte)
4. Aguardar a criação e exibição do QR Code
5. Escanear o QR Code com o WhatsApp do celular

### Reconectar Instância

1. Clicar no botão "Conectar" na instância desconectada
2. Escanear o novo QR Code gerado

### Verificar Status

1. Clicar no botão "Status" para atualizar o status da instância
2. O badge de status será atualizado automaticamente

### Desconectar

1. Clicar no botão "Desconectar" em uma instância conectada
2. Confirmar a ação

### Excluir Instância

1. Clicar no ícone de lixeira (🗑️)
2. Confirmar a exclusão
3. A instância será removida do sistema e da Evolution API

## Segurança

- Todas as rotas exigem autenticação
- Isolamento por tenant (multi-tenancy)
- Log de todas as operações
- Validação de inputs
- Rate limiting aplicado

## Logs

Todas as operações são logadas com o prefixo `[WhatsApp]` ou `[EvolutionAPI]`:

- Criação de instâncias
- Reconexões
- Consultas de status
- Desconexões
- Exclusões
- Erros de comunicação com a API

## Possíveis Melhorias Futuras

- [ ] Webhook para receber eventos da Evolution API
- [ ] Envio de mensagens
- [ ] Mensagens agendadas
- [ ] Templates de mensagens
- [ ] Estatísticas de uso
- [ ] Backup automático de conversas
- [ ] Múltiplas instâncias por tenant com priorização
- [ ] Dashboard de métricas de WhatsApp

## Troubleshooting

### QR Code não aparece

- Verificar se a URL e API Key estão corretas no `.env`
- Verificar se a Evolution API está acessível
- Checar os logs do servidor

### Instância não conecta

- Verificar se o QR Code foi escaneado antes de expirar
- Tentar reconectar e gerar novo QR Code
- Verificar o status da Evolution API

### Erros de comunicação

- Verificar conectividade com a Evolution API
- Verificar logs do servidor para detalhes do erro
- Verificar se a API Key é válida
