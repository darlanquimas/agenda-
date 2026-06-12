# 🔍 WhatsApp - Troubleshooting QR Code

## Problema: QR Code não exibe

### ✅ Melhorias Implementadas

1. **Logs Detalhados no Backend**
   - Log da resposta da Evolution API
   - Indica se QR Code está presente (base64 ou code)
   - Fallback automático para buscar QR Code se não vier na criação

2. **Logs no Frontend**
   - Console.log mostra se QR Code foi recebido
   - Alerta visual se QR Code não retornar

3. **Modal Melhorado**
   - Exibe mensagem de erro se QR Code não vier
   - Suporte para QR Code em base64 ou texto

### 🔍 Como Debugar

#### 1. Verifique os Logs do Servidor

Após tentar criar uma instância, verifique o terminal do servidor:

```bash
[WhatsApp] Resposta da Evolution API {
  hasInstance: true,
  hasQrcode: true,
  qrcodeBase64: 'presente',    # ou 'ausente'
  qrcodeCode: 'ausente'        # ou 'presente'
}
```

Se `hasQrcode: false`, a Evolution API não está retornando o QR Code.

#### 2. Verifique o Console do Navegador

Abra o DevTools (F12) → Console e procure:

```
[WhatsApp] Resposta da criação: {...}
[WhatsApp] QR Code: presente   # ou 'ausente'
```

#### 3. Verifique se Evolution API está funcionando

```bash
cd server && npm run test:evolution
```

Deve mostrar:
```
✅ Conexão bem-sucedida!
✅ Teste de criação bem-sucedido!
```

### 🚨 Causas Comuns

#### 1. Evolution API não está rodando
**Sintoma**: `ECONNREFUSED` ou `ECONNRESET`

**Solução**:
```bash
# Ver guia: EVOLUTION_API_SETUP.md
docker-compose up -d evolution-api
```

#### 2. Evolution API sem configuração correta
**Sintoma**: Conexão estabelece mas fecha imediatamente

**Solução**: Use o docker-compose.yml do `EVOLUTION_API_SETUP.md` com TODAS as variáveis de ambiente.

#### 3. QR Code expira muito rápido
**Sintoma**: QR Code aparece mas já está expirado

**Solução**: 
- Configure `QRCODE_LIMIT=60` na Evolution API (60 segundos)
- Escaneie o QR Code imediatamente após aparecer

#### 4. Formato do QR Code incorreto
**Sintoma**: QR Code aparece mas não escaneia

A Evolution API pode retornar em 2 formatos:
- `base64`: Imagem em base64 (começa com `data:image`)
- `code`: Texto do QR Code

O sistema suporta ambos.

### 🔧 Soluções Passo a Passo

#### Se QR Code não aparece:

**1. Teste a Evolution API:**
```bash
cd server && npm run test:evolution
```

**2. Se falhar, configure corretamente:**
- Siga o guia `EVOLUTION_API_SETUP.md`
- Use o docker-compose.yml fornecido
- Verifique todas as variáveis de ambiente

**3. Reinicie tudo:**
```bash
# Parar Evolution API
docker stop evolution-api
docker rm evolution-api

# Iniciar com configuração correta
docker-compose up -d evolution-api

# Aguardar 10 segundos
sleep 10

# Testar novamente
cd server && npm run test:evolution
```

**4. Se o teste passar, tente criar instância:**
- Acesse o menu WhatsApp no sistema
- Crie nova instância
- Verifique logs no console do navegador (F12)
- Verifique logs no terminal do servidor

**5. Se ainda não funcionar:**

Teste manual com curl:
```bash
curl -X POST http://localhost:8081/instance/create \
  -H "apikey: 82044b4fa4248e33569f8e37fadfb2fe4ee60cfe" \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"teste123","qrcode":true}'
```

Deve retornar JSON com `qrcode` contendo o QR Code.

### 📝 Checklist de Verificação

- [ ] Evolution API rodando (porta 8081 acessível)
- [ ] Variáveis de ambiente configuradas no .env
- [ ] Teste `npm run test:evolution` passa
- [ ] Logs do servidor mostram `hasQrcode: true`
- [ ] Console do navegador mostra `QR Code: presente`
- [ ] Modal do QR Code abre

### 🆘 Se nada funcionar

1. **Compartilhe os logs:**
   - Terminal do servidor (últimas 50 linhas)
   - Console do navegador (aba Console)
   - Resultado de `npm run test:evolution`

2. **Informações do ambiente:**
   ```bash
   docker ps | grep evolution
   curl -I http://localhost:8081/
   cat server/.env | grep EVOLUTION
   ```

3. **Tente Evolution API em outro servidor:**
   - Deploy em Railway, Render, etc
   - Configure URL remota no `.env`
   - Teste novamente

### 📚 Referências

- `WHATSAPP_INTEGRATION.md` - Documentação da integração
- `EVOLUTION_API_SETUP.md` - Guia de configuração da Evolution API
- Evolution API Docs: https://doc.evolution-api.com/
