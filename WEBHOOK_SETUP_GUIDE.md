# Guia de Configuração do Webhook WhatsApp

## 🎯 O que é o Webhook?

O webhook permite que o sistema **receba respostas** dos clientes quando eles confirmam ou cancelam agendamentos via WhatsApp.

## 🚀 Configuração Rápida

### Opção 1: Via Painel (Recomendado)

1. **Acesse**: WhatsApp > Instâncias
2. **Certifique-se** que a instância está **Conectada** (status verde)
3. **Clique em**: "Configurar Webhook" (botão azul)
4. **Confirme** a configuração
5. ✅ Pronto!

### Opção 2: Via Linha de Comando

```bash
cd server
npm run webhook:setup nome-da-instancia
```

Exemplo:
```bash
npm run webhook:setup bbnb
```

## ⚙️ Configuração Avançada

### 1. Descobrir o IP da sua máquina

**Linux/Mac:**
```bash
hostname -I | awk '{print $1}'
# ou
ip addr show | grep "inet " | grep -v 127.0.0.1
```

**Windows:**
```cmd
ipconfig
# Procure por "IPv4 Address"
```

### 2. Atualizar `.env`

Edite `server/.env`:

```env
# Opção 1: Usar host.docker.internal (funciona se Evolution API estiver no Docker)
WEBHOOK_BASE_URL=http://host.docker.internal:3001

# Opção 2: Usar IP da máquina na rede local
WEBHOOK_BASE_URL=http://192.168.1.100:3001

# Opção 3: Usar ngrok (para desenvolvimento/testes remotos)
WEBHOOK_BASE_URL=https://seu-id.ngrok.io
```

### 3. Reiniciar o Backend

```bash
# No terminal do backend
Ctrl+C
npm run dev
```

### 4. Configurar o Webhook

**Via painel** ou **via comando**:
```bash
npm run webhook:setup nome-da-instancia
```

## 🧪 Testando a Configuração

### 1. Teste de Conectividade

```bash
curl http://localhost:3001/webhook/whatsapp/test
```

Resposta esperada:
```json
{
  "status": "ok",
  "message": "Webhook está acessível e funcionando!",
  "timestamp": "2026-06-12T13:00:00.000Z",
  "webhookUrl": "http://host.docker.internal:3001/webhook/whatsapp/:instanceName"
}
```

### 2. Teste da Evolution API

```bash
# Verificar se o webhook está configurado
curl -X GET 'http://localhost:8081/webhook/find/nome-da-instancia' \
  -H 'apikey: SUA_API_KEY'
```

### 3. Teste End-to-End

1. Crie um agendamento de teste na página pública
2. Responda "SIM" no WhatsApp
3. Verifique se o status mudou para "Agendado" no painel

## 🔍 Verificando os Logs

### Backend
```bash
# Procure por:
[WhatsAppWebhook] Mensagem recebida
[WhatsAppWebhook] Processando mensagem
[WhatsAppWebhook] Agendamento atualizado
```

### Evolution API
```bash
docker logs evolution_api --tail 50 -f
```

## ⚠️ Problemas Comuns

### Webhook não está recebendo mensagens

**Causa**: Evolution API não consegue acessar o backend

**Soluções**:

1. **Verificar WEBHOOK_BASE_URL**:
   ```bash
   # Tente acessar do container da Evolution API
   docker exec evolution_api curl http://host.docker.internal:3001/webhook/whatsapp/test
   ```

2. **Usar IP da máquina** ao invés de `localhost`:
   ```env
   WEBHOOK_BASE_URL=http://192.168.1.100:3001
   ```

3. **Verificar firewall**:
   ```bash
   # Linux
   sudo ufw allow 3001/tcp
   
   # Verificar se a porta está aberta
   netstat -tuln | grep 3001
   ```

### Erro "Connection refused"

**Causa**: Backend não está rodando ou porta incorreta

**Solução**:
```bash
# Verificar se o backend está rodando
lsof -i :3001

# Se não estiver, inicie:
cd server
npm run dev
```

### Erro "Unauthorized" ao configurar webhook

**Causa**: API Key incorreta

**Solução**:
1. Verifique `EVOLUTION_API_KEY` no `.env`
2. Compare com a chave da Evolution API
3. Reinicie o backend após alterar

### Mensagens não estão sendo processadas

**Verificar**:
1. Telefone do cliente está cadastrado corretamente?
2. Cliente tem agendamento com status "pending"?
3. Logs mostram `[WhatsAppWebhook] Mensagem recebida`?

## 🔐 Segurança em Produção

### 1. HTTPS Obrigatório

Em produção, use HTTPS:
```env
WEBHOOK_BASE_URL=https://seudominio.com
```

### 2. Validar Origem

O webhook já valida que apenas mensagens de números com agendamentos pendentes são processadas.

### 3. Rate Limiting

Considere adicionar rate limiting específico para o webhook se necessário.

## 📱 Testando com ngrok

Para desenvolvimento ou testes remotos:

### 1. Instalar ngrok

```bash
# Via snap (Linux)
sudo snap install ngrok

# Via brew (Mac)
brew install ngrok

# Windows: baixar de ngrok.com
```

### 2. Iniciar túnel

```bash
ngrok http 3001
```

### 3. Copiar URL

```
Forwarding https://abc123.ngrok.io -> http://localhost:3001
```

### 4. Atualizar .env

```env
WEBHOOK_BASE_URL=https://abc123.ngrok.io
```

### 5. Configurar webhook

```bash
npm run webhook:setup nome-da-instancia
```

## 📊 Monitoramento

### Verificar webhooks configurados

```bash
# Listar todas as instâncias
curl -X GET 'http://localhost:8081/instance/fetchInstances' \
  -H 'apikey: SUA_API_KEY'

# Verificar webhook de uma instância específica
curl -X GET 'http://localhost:8081/webhook/find/nome-da-instancia' \
  -H 'apikey: SUA_API_KEY'
```

### Logs em tempo real

```bash
# Backend
tail -f server/logs/*.log

# Evolution API
docker logs evolution_api -f
```

## 🆘 Suporte

Se ainda tiver problemas:

1. Verifique todos os logs (backend + Evolution API)
2. Teste a conectividade com curl
3. Verifique se o firewall não está bloqueando
4. Confirme que as variáveis de ambiente estão corretas
5. Reinicie ambos os serviços (backend + Evolution API)

## ✅ Checklist de Configuração

- [ ] Backend rodando na porta correta
- [ ] `WEBHOOK_BASE_URL` configurado no `.env`
- [ ] Instância WhatsApp conectada (status "open")
- [ ] Webhook configurado via painel ou comando
- [ ] Teste de conectividade passou
- [ ] Teste end-to-end funcionou
- [ ] Logs mostrando mensagens recebidas
