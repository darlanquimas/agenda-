# Plano de Implementação de Segurança
## Agenda+ Security Hardening

**Data de Início:** 11 de Junho de 2026  
**Status:** Em Progresso

---

## 📦 Dependências Necessárias

### Backend
```json
{
  "dependencies": {
    "cookie-parser": "^1.4.6",
    "csurf": "^1.11.0",
    "xss": "^1.0.15",
    "zod": "^3.23.8",
    "winston": "^3.13.0",
    "winston-daily-rotate-file": "^5.0.0",
    "speakeasy": "^2.0.0",
    "qrcode": "^1.5.3"
  },
  "devDependencies": {
    "@types/cookie-parser": "^1.4.7",
    "@types/qrcode": "^1.5.5",
    "@types/speakeasy": "^2.0.10",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.12",
    "ts-jest": "^29.1.4",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2"
  }
}
```

---

## 🗄️ Alterações no Banco de Dados

### Nova Migration: `add_security_fields`

```sql
-- Adicionar campos de 2FA
ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN two_factor_backup_codes TEXT NULL;

-- Adicionar campos de refresh token
ALTER TABLE users ADD COLUMN refresh_token_version INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TIMESTAMP NULL;

-- Criar índices para performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at);
```

---

## 🔐 FASE 1 - CRÍTICO (Imediato)

### 1.1 Migrar Tokens para httpOnly Cookies

**Arquivos a Modificar:**
- `server/routes/auth.ts` - Adicionar configuração de cookies
- `server/middleware/auth.ts` - Ler token de cookie em vez de header
- `server/config/index.ts` - Adicionar configurações de cookie
- `client/src/api/axios.ts` - Remover lógica de localStorage

**Implementação:**
```typescript
// server/routes/auth.ts
res.cookie('access_token', token, {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'strict',
  maxAge: 8 * 60 * 60 * 1000 // 8 horas
});

res.cookie('refresh_token', refreshToken, {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
});
```

### 1.2 Implementar Proteção CSRF

**Arquivos a Criar:**
- `server/middleware/csrf.ts` - Configuração CSRF

**Arquivos a Modificar:**
- `server/index.ts` - Adicionar middleware CSRF

**Implementação:**
```typescript
import csrf from 'csurf';

const csrfProtection = csrf({ 
  cookie: {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict'
  }
});

app.use(csrfProtection);
```

### 1.3 Adicionar Sanitização XSS

**Arquivos a Criar:**
- `server/middleware/sanitize.ts` - Middleware de sanitização
- `server/lib/sanitizer.ts` - Funções auxiliares

**Implementação:**
```typescript
import xss from 'xss';

export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return xss(input);
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  if (typeof input === 'object' && input !== null) {
    return Object.keys(input).reduce((acc, key) => {
      acc[key] = sanitizeInput(input[key]);
      return acc;
    }, {} as any);
  }
  return input;
}
```

---

## 🔒 FASE 2 - ALTA (1-2 meses)

### 2.1 Implementar Validação com Zod

**Arquivos a Criar:**
- `server/schemas/auth.schema.ts`
- `server/schemas/client.schema.ts`
- `server/schemas/professional.schema.ts`
- `server/schemas/appointment.schema.ts`
- `server/schemas/service.schema.ts`
- `server/middleware/validateSchema.ts`

**Exemplo:**
```typescript
import { z } from 'zod';

export const createClientSchema = z.object({
  name: z.string().min(3).max(100),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+?[\d\s\-()]+$/).optional(),
  document: z.string().regex(/^\d{11}$/).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(1000).optional()
});
```

### 2.2 Fortalecer Política de Senhas

**Arquivos a Modificar:**
- `server/lib/validate.ts` - Atualizar `validatePassword()`

**Implementação:**
```typescript
export function validatePassword(password: string): string | null {
  if (password.length < 12) {
    return 'Senha deve ter pelo menos 12 caracteres';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Senha deve conter pelo menos uma letra maiúscula';
  }
  if (!/[a-z]/.test(password)) {
    return 'Senha deve conter pelo menos uma letra minúscula';
  }
  if (!/[0-9]/.test(password)) {
    return 'Senha deve conter pelo menos um número';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Senha deve conter pelo menos um caractere especial';
  }
  
  // Verificar senhas comuns
  const commonPasswords = ['password123', 'admin123456', '123456789012'];
  if (commonPasswords.some(p => password.toLowerCase().includes(p))) {
    return 'Senha muito comum. Escolha uma senha mais segura';
  }
  
  return null;
}
```

### 2.3 Implementar 2FA

**Arquivos a Criar:**
- `server/routes/two-factor.ts` - Rotas de 2FA
- `server/services/twoFactorService.ts` - Lógica de 2FA
- `client/src/pages/TwoFactorSetup.tsx`
- `client/src/pages/TwoFactorVerify.tsx`

**Fluxo:**
1. Admin habilita 2FA no painel
2. Sistema gera QR code com secret
3. Admin escaneia com Google Authenticator
4. Admin confirma com código de 6 dígitos
5. Sistema gera 10 códigos de backup
6. Próximos logins exigem código 2FA

---

## 🛡️ FASE 3 - MÉDIA (3-6 meses)

### 3.1 Sistema Completo de Refresh Tokens

**Arquivos a Criar:**
- `server/services/tokenService.ts` - Gestão de tokens
- `server/routes/refresh.ts` - Endpoint de refresh

**Implementação:**
- Access token: 15 minutos
- Refresh token: 7 dias
- Rotation: novo refresh token a cada uso
- Revogação: versão no banco permite invalidar todos os tokens

### 3.2 Logging Estruturado com Winston

**Arquivos a Criar:**
- `server/lib/logger.ts` - Configuração Winston
- `server/middleware/requestLogger.ts` - Log de requisições

**Implementação:**
```typescript
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logger = winston.createLogger({
  level: config.isProduction ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    }),
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ]
});
```

### 3.3 CSP Customizada

**Arquivos a Modificar:**
- `server/index.ts` - Configuração Helmet detalhada

**Implementação:**
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 3.4 Ferramentas de Teste de Penetração

**Arquivos a Criar:**
- `.github/workflows/security-scan.yml` - CI/CD security
- `scripts/security-check.sh` - Script de verificação
- `SECURITY.md` - Política de segurança

**Ferramentas:**
- OWASP ZAP
- npm audit
- Snyk
- Trivy

---

## 🔄 FASE 4 - MANUTENÇÃO CONTÍNUA

### 4.1 Dependabot

**Arquivos a Criar:**
- `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/server"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    
  - package-ecosystem: "npm"
    directory: "/client"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

### 4.2 Documentação

**Arquivos a Criar:**
- `docs/SECURITY_CHECKLIST.md` - Checklist de segurança
- `docs/INCIDENT_RESPONSE.md` - Plano de resposta a incidentes
- `docs/AUDIT_PROCESS.md` - Processo de auditoria
- `docs/UPDATE_POLICY.md` - Política de atualizações

---

## 📊 Métricas de Sucesso

- [ ] 100% das rotas com validação de entrada
- [ ] 0 vulnerabilidades críticas no npm audit
- [ ] Todos os admins com 2FA habilitado
- [ ] Logs estruturados em todas as operações críticas
- [ ] Rate limiting configurado em todas as rotas públicas
- [ ] CSRF tokens em todas as requisições de mutação
- [ ] Score A+ no Mozilla Observatory
- [ ] Score 95+ no Snyk Security Score

---

## 🚨 Rollback Plan

Em caso de problemas:

1. **Cookies causando problemas**: Reverter para Bearer tokens temporariamente
2. **2FA bloqueando usuários**: Códigos de backup disponíveis
3. **CSRF bloqueando requisições**: Endpoint de fallback sem CSRF para debug
4. **Validações muito restritivas**: Feature flag para desabilitar temporariamente

---

## 📝 Notas de Implementação

- Todas as mudanças devem ser testadas em ambiente de staging primeiro
- Manter backward compatibility por pelo menos uma versão
- Notificar usuários sobre mudanças de segurança (principalmente 2FA obrigatório)
- Documentar todas as variáveis de ambiente adicionais
- Criar guia de migração para usuários existentes
