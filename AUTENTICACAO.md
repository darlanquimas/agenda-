# 🔐 Sistema de Autenticação

## Problema Resolvido

A sessão estava expirando frequentemente porque:
1. ❌ Token JWT expirava em 15 minutos
2. ❌ Não havia refresh automático no frontend
3. ❌ Usuário era deslogado automaticamente

## ✅ Solução Implementada

### 1. Refresh Token Automático

Implementado interceptor no Axios que:
- Detecta erro 401 (token expirado)
- Tenta renovar o token automaticamente usando refresh token
- Reenvia a requisição original com novo token
- Evita múltiplas renovações simultâneas (fila de requisições)
- Só desloga se o refresh token também expirar

### 2. Tempos de Expiração Aumentados (Desenvolvimento)

**Antes:**
```env
JWT_EXPIRES_IN=15m        # 15 minutos
JWT_REFRESH_EXPIRES_IN=7d  # 7 dias
```

**Agora:**
```env
JWT_EXPIRES_IN=8h         # 8 horas
JWT_REFRESH_EXPIRES_IN=30d # 30 dias
```

### 3. Configuração Dinâmica

Os tempos dos cookies agora são baseados no `.env`:
- `config.jwtExpiresInMs` - calculado automaticamente de `JWT_EXPIRES_IN`
- `config.jwtRefreshExpiresInMs` - calculado de `JWT_REFRESH_EXPIRES_IN`

## 🔄 Como Funciona

### Fluxo de Autenticação

```
1. Login
   ├─ Backend gera access_token (8h) e refresh_token (30d)
   ├─ Ambos são salvos em cookies httpOnly
   └─ CSRF token é gerado

2. Requisições Normais
   ├─ Access token é enviado automaticamente (cookie)
   ├─ CSRF token é enviado no header
   └─ Se token válido → resposta normal

3. Token Expirado (401)
   ├─ Frontend detecta 401
   ├─ Chama /auth/refresh automaticamente
   ├─ Backend valida refresh_token
   ├─ Gera novos tokens
   ├─ Reenvia requisição original
   └─ Usuário nem percebe!

4. Refresh Token Expirado
   ├─ /auth/refresh retorna 401
   ├─ Frontend desloga usuário
   └─ Redireciona para /login
```

### Segurança

- ✅ Tokens em cookies httpOnly (não acessíveis por JavaScript)
- ✅ CSRF protection
- ✅ Refresh token rotation (novo token a cada refresh)
- ✅ Rate limiting no login
- ✅ Bloqueio de conta após N tentativas
- ✅ 2FA opcional

## 📝 Configuração por Ambiente

### Desenvolvimento
```env
JWT_EXPIRES_IN=8h          # Tempo confortável para desenvolvimento
JWT_REFRESH_EXPIRES_IN=30d  # Evita relogins frequentes
```

### Produção
```env
JWT_EXPIRES_IN=15m         # Mais seguro
JWT_REFRESH_EXPIRES_IN=7d   # Usuário faz login semanal
```

## 🎯 Formato de Tempo Suportado

O sistema aceita:
- `s` - segundos (ex: `60s` = 60 segundos)
- `m` - minutos (ex: `15m` = 15 minutos)
- `h` - horas (ex: `8h` = 8 horas)
- `d` - dias (ex: `30d` = 30 dias)

## 🔍 Debugging

### Ver logs de autenticação

No servidor, os logs mostram:
```
[INFO] Login bem-sucedido: usuario@email.com
[INFO] Token atualizado com sucesso
[ERROR] Refresh token inválido ou expirado
```

### Testar renovação manual

No console do navegador:
```javascript
// Forçar chamada de refresh
await fetch('/api/auth/refresh', { 
  method: 'POST',
  credentials: 'include' 
})
```

### Ver cookies

No DevTools → Application → Cookies:
- `access_token` - httpOnly (não visível no JS)
- `refresh_token` - httpOnly (não visível no JS)
- `csrf_token` - visível (necessário)

## 🚨 Troubleshooting

### "Sessão continua expirando"

1. Verifique o `.env`:
```bash
cat server/.env | grep JWT_
```

2. Reinicie o servidor:
```bash
npm run dev
```

3. Faça novo login (logout + login)

4. Verifique os logs do servidor

### "Redirect loop infinito"

Pode acontecer se:
- Cookies não estão sendo salvos
- CORS não configurado corretamente
- Domínio do cookie incorreto

Solução:
```env
# server/.env
CLIENT_URL=http://localhost:5173
COOKIE_DOMAIN=  # deixe vazio em desenvolvimento
```

### "401 em todas requisições"

1. Limpe cookies do navegador
2. Faça logout
3. Faça login novamente

## 📚 Arquivos Modificados

### Backend
- `server/config/index.ts` - Adicionado parseJwtTime()
- `server/routes/auth.ts` - Cookies dinâmicos
- `server/routes/refresh.ts` - Cookies dinâmicos
- `server/.env` - Tempos aumentados

### Frontend
- `client/src/api/axios.ts` - Interceptor de refresh automático

## 🎓 Boas Práticas

1. **Desenvolvimento**: Use tempos longos (8h) para melhor UX
2. **Produção**: Use tempos curtos (15m) para maior segurança
3. **Sempre** tenha refresh token com tempo > access token
4. **Monitore** logs de autenticação para detectar problemas
5. **Teste** logout e login após mudanças nos tempos

## 🔒 Segurança em Produção

Para produção, considere:
```env
JWT_SECRET=<gerado com: openssl rand -base64 64>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
COOKIE_SECURE=true
COOKIE_SAME_SITE=strict
COOKIE_DOMAIN=.seudominio.com
ENABLE_CSRF=true
ENABLE_2FA=true
```
