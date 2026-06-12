# 🔧 Configuração da Evolution API

## Problema Atual

A Evolution API está **aceitando conexões** mas **fechando-as imediatamente**, causando erro `ECONNRESET`.

## 🚨 Diagnóstico

```bash
# Teste realizado:
curl -H "apikey: 82044b4fa4248e33569f8e37fadfb2fe4ee60cfe" http://localhost:8081/
# Resultado: Conexão fechada pela outra ponta
```

Isso indica que a Evolution API está com problema de configuração.

## ✅ Solução: Configurar Evolution API Corretamente

### Opção 1: Docker (Recomendado)

```bash
docker run -d \
  --name evolution-api \
  -p 8081:8081 \
  -e SERVER_TYPE=http \
  -e SERVER_PORT=8081 \
  -e CORS_ORIGIN=* \
  -e CORS_METHODS=GET,POST,PUT,DELETE \
  -e CORS_CREDENTIALS=true \
  -e LOG_LEVEL=INFO \
  -e LOG_COLOR=true \
  -e DEL_INSTANCE=false \
  -e AUTHENTICATION_TYPE=apikey \
  -e AUTHENTICATION_API_KEY=82044b4fa4248e33569f8e37fadfb2fe4ee60cfe \
  -e AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true \
  -e DATABASE_ENABLED=false \
  -e DATABASE_SAVE_DATA_INSTANCE=false \
  -e DATABASE_SAVE_DATA_NEW_MESSAGE=false \
  -e RABBITMQ_ENABLED=false \
  -e WEBSOCKET_ENABLED=false \
  -e QRCODE_LIMIT=30 \
  atendai/evolution-api:latest
```

### Opção 2: Docker Compose (Mais fácil)

Crie o arquivo `docker-compose.yml` na raiz:

```yaml
version: '3.8'

services:
  evolution-api:
    image: atendai/evolution-api:latest
    container_name: evolution-api
    restart: unless-stopped
    ports:
      - "8081:8081"
    environment:
      # Servidor
      - SERVER_TYPE=http
      - SERVER_PORT=8081
      
      # CORS
      - CORS_ORIGIN=*
      - CORS_METHODS=GET,POST,PUT,DELETE
      - CORS_CREDENTIALS=true
      
      # Logs
      - LOG_LEVEL=INFO
      - LOG_COLOR=true
      
      # Instâncias
      - DEL_INSTANCE=false
      
      # Autenticação
      - AUTHENTICATION_TYPE=apikey
      - AUTHENTICATION_API_KEY=82044b4fa4248e33569f8e37fadfb2fe4ee60cfe
      - AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true
      
      # Banco de dados (desabilitado para desenvolvimento)
      - DATABASE_ENABLED=false
      - DATABASE_SAVE_DATA_INSTANCE=false
      - DATABASE_SAVE_DATA_NEW_MESSAGE=false
      
      # Outros serviços (desabilitados)
      - RABBITMQ_ENABLED=false
      - WEBSOCKET_ENABLED=false
      
      # QR Code
      - QRCODE_LIMIT=30
    volumes:
      - evolution_instances:/evolution/instances
      - evolution_store:/evolution/store

volumes:
  evolution_instances:
  evolution_store:
```

Depois inicie:

```bash
docker-compose up -d evolution-api
```

## 📋 Verificar se está funcionando

### 1. Verificar se o container está rodando

```bash
docker ps | grep evolution-api
```

### 2. Ver logs do container

```bash
docker logs -f evolution-api
```

### 3. Testar a API

```bash
# Teste no terminal do projeto
cd server && npm run test:evolution
```

Você deve ver: `✅ Conexão bem-sucedida!`

### 4. Testar no navegador

Acesse: `http://localhost:8081/`

Deve retornar informações da API.

## 🔍 Problemas Comuns

### 1. Porta 8081 já está em uso

```bash
# Verificar o que está usando a porta
sudo lsof -i :8081

# Parar o container atual
docker stop evolution-api
docker rm evolution-api

# Reiniciar com as configurações corretas
docker-compose up -d evolution-api
```

### 2. Evolution API fechando conexão

**Causa**: Falta de configuração das variáveis de ambiente.

**Solução**: Use o docker-compose acima com TODAS as variáveis configuradas.

### 3. API Key não funciona

Verifique se a API Key no `.env` do seu projeto é a mesma configurada na Evolution API:

```env
# server/.env
EVOLUTION_API_KEY=82044b4fa4248e33569f8e37fadfb2fe4ee60cfe
```

### 4. ECONNRESET persiste

Se o erro continuar:

1. **Pare e remova o container**:
```bash
docker stop evolution-api
docker rm evolution-api
```

2. **Inicie novamente com as configurações corretas**:
```bash
docker-compose up -d evolution-api
```

3. **Aguarde 10 segundos** para a API inicializar completamente

4. **Teste novamente**:
```bash
cd server && npm run test:evolution
```

## 🎯 Checklist Final

- [ ] Evolution API rodando no Docker
- [ ] Porta 8081 acessível
- [ ] Variáveis de ambiente configuradas
- [ ] API Key correta no `.env` do projeto
- [ ] Teste `npm run test:evolution` passa com sucesso
- [ ] Consegue criar instância pelo sistema

## 📞 Próximos Passos

Depois de configurar corretamente:

1. Reinicie o servidor do Agenda+
2. Acesse o menu WhatsApp
3. Crie uma nova instância
4. Escaneie o QR Code com seu WhatsApp

## 🆘 Se nada funcionar

Tente usar a Evolution API oficial em produção:

1. Deploy da Evolution API em um servidor (Railway, Render, etc)
2. Configure a URL no `.env`:
```env
EVOLUTION_API_URL=https://sua-evolution-api.com
```
3. Configure a API Key correspondente
