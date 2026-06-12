# Política de Segurança

## Versões Suportadas

Apenas a última versão estável (main branch) recebe atualizações de segurança.

| Versão | Suportada          |
| ------ | ------------------ |
| 1.x.x  | :white_check_mark: |
| < 1.0  | :x:                |

## Reportar uma Vulnerabilidade

Levamos a segurança muito a sério. Se você descobrir uma vulnerabilidade de segurança, por favor NÃO abra uma issue pública.

### Como Reportar

1. **Email**: Envie detalhes para [security@agendaplus.com]
2. **Informações a incluir**:
   - Descrição detalhada da vulnerabilidade
   - Passos para reproduzir
   - Impacto potencial
   - Sugestões de correção (se houver)

### O que esperar

- **Confirmação**: Responderemos em até 48 horas
- **Investigação**: Avaliaremos a vulnerabilidade em até 7 dias
- **Correção**: Desenvolveremos um patch prioritariamente
- **Divulgação**: Após correção, publicaremos um advisory de segurança
- **Crédito**: Daremos crédito ao descobridor (se desejar)

## Recursos de Segurança Implementados

### Autenticação e Autorização
- ✅ JWT com tokens de curta duração (15 minutos)
- ✅ Refresh tokens com rotação automática
- ✅ Autenticação de dois fatores (2FA) via TOTP
- ✅ Códigos de backup para 2FA
- ✅ Proteção contra brute force (bloqueio após 5 tentativas)
- ✅ Bloqueio temporário de conta (30 minutos)

### Proteção de Dados
- ✅ Senhas criptografadas com bcrypt (10 rounds)
- ✅ Tokens armazenados em httpOnly cookies
- ✅ Política de senhas forte (12+ caracteres, complexidade)
- ✅ Isolamento multi-tenant

### Proteção contra Ataques
- ✅ Sanitização XSS em todas as entradas
- ✅ Proteção SQL Injection (Prisma ORM)
- ✅ CSRF tokens (opcional, configurável)
- ✅ Rate limiting configurável
- ✅ Headers de segurança (Helmet.js)
- ✅ Content Security Policy (CSP)
- ✅ CORS restritivo

### Auditoria e Logging
- ✅ Logs estruturados (Winston)
- ✅ Histórico de atividades
- ✅ Rastreamento de tentativas de login
- ✅ Alertas de atividades suspeitas

### Dependências
- ✅ Dependabot habilitado
- ✅ Scans automáticos semanais
- ✅ CodeQL para análise de código
- ✅ Trivy para vulnerabilidades
- ✅ TruffleHog para detecção de secrets

## Melhores Práticas para Deployment

### Variáveis de Ambiente

**NUNCA** commite arquivos com valores sensíveis:
- ❌ `.env` (deve estar no `.gitignore`)
- ❌ Chaves privadas
- ❌ Tokens de API
- ❌ Senhas de banco de dados

### Produção

1. **JWT_SECRET**: Mínimo 32 caracteres aleatórios
2. **DATABASE_URL**: Use SSL (`?sslmode=require`)
3. **HTTPS**: Sempre use HTTPS em produção
4. **Cookies**: Configure domínio correto
5. **CORS**: Restrinja apenas a origens confiáveis
6. **Rate Limiting**: Ajuste conforme tráfego
7. **Backups**: Automatize backups diários do banco
8. **2FA**: Torne obrigatório para super admins

### Configuração Recomendada

```bash
NODE_ENV=production
JWT_SECRET=<64-chars-random-string>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
COOKIE_SECURE=true
COOKIE_SAME_SITE=strict
ENABLE_CSRF=true
ENABLE_2FA=true
MAX_LOGIN_ATTEMPTS=5
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

## Resposta a Incidentes

### Em caso de comprometimento:

1. **Isolar**: Desligue temporariamente o sistema
2. **Investigar**: Analise logs e identifique vetor de ataque
3. **Mitigar**: Corrija vulnerabilidade
4. **Revogar**: Invalide todos os tokens (`refresh_token_version`)
5. **Notificar**: Informe usuários afetados
6. **Documentar**: Registre incidente e lições aprendidas

### Comandos de Emergência

```bash
# Revogar todos os tokens de um usuário
UPDATE users SET refresh_token_version = refresh_token_version + 1 WHERE id = <user_id>;

# Bloquear usuário
UPDATE users SET account_locked = true WHERE id = <user_id>;

# Resetar tentativas de login
UPDATE users SET failed_login_attempts = 0, locked_until = NULL;
```

## Checklist de Segurança

Antes de cada deploy:

- [ ] Todas as dependências atualizadas
- [ ] npm audit não reporta vulnerabilidades críticas
- [ ] Secrets não commitados
- [ ] Variáveis de ambiente configuradas
- [ ] HTTPS habilitado
- [ ] Rate limiting testado
- [ ] Logs monitorados
- [ ] Backup recente disponível
- [ ] Plano de rollback pronto
- [ ] 2FA habilitado para admins

## Contato

- **Email de Segurança**: security@agendaplus.com
- **Issues Públicas**: [GitHub Issues](https://github.com/seu-usuario/agenda-plus/issues)
- **Documentação**: [README.md](./README.md)

## Agradecimentos

Agradecemos aos pesquisadores de segurança que reportarem vulnerabilidades responsavelmente.

---

**Última atualização**: 11 de Junho de 2026
