# Checklist de Segurança - Agenda+

## 📋 Pré-Deploy

### Configuração Básica
- [ ] `NODE_ENV=production` configurado
- [ ] `JWT_SECRET` tem 32+ caracteres aleatórios
- [ ] `COOKIE_SECRET` diferente de JWT_SECRET
- [ ] `DATABASE_URL` usa SSL (`?sslmode=require`)
- [ ] Todas as variáveis de ambiente obrigatórias preenchidas

### Dependências
- [ ] `npm audit` sem vulnerabilidades críticas/altas
- [ ] Todas as dependências atualizadas
- [ ] Dependabot configurado e ativo
- [ ] Scans de segurança automatizados habilitados

### Banco de Dados
- [ ] Migration de segurança aplicada
- [ ] Índices de performance criados
- [ ] Backup automático configurado
- [ ] Conexões SSL habilitadas
- [ ] Usuário do banco com permissões mínimas

## 🔒 Segurança de Autenticação

### JWT e Tokens
- [ ] Access token: 15 minutos ou menos
- [ ] Refresh token: 7 dias máximo
- [ ] Tokens em httpOnly cookies (não localStorage)
- [ ] `sameSite=strict` configurado
- [ ] Domínio do cookie correto em produção

### Senhas
- [ ] Bcrypt com 10+ rounds
- [ ] Mínimo 12 caracteres exigido
- [ ] Validação de complexidade ativa
- [ ] Senhas comuns bloqueadas
- [ ] Hash de senha atualizado em mudanças

### 2FA (Two-Factor Authentication)
- [ ] 2FA disponível para todos os usuários
- [ ] 2FA obrigatório para super admins
- [ ] Códigos de backup gerados e armazenados com segurança
- [ ] QR Code gerado corretamente
- [ ] TOTP com window de ±1 para clock skew

## 🛡️ Proteções Ativas

### Headers HTTP
- [ ] Helmet configurado com CSP customizada
- [ ] HSTS habilitado em produção
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY
- [ ] Referrer-Policy configurada

### CORS
- [ ] Apenas origens confiáveis permitidas
- [ ] `credentials: true` configurado
- [ ] Preflight requests tratadas
- [ ] Headers expostos documentados

### Rate Limiting
- [ ] Login: 20 tentativas / 15 minutos
- [ ] Booking público: 30 / 15 minutos
- [ ] API geral: 500 / 15 minutos
- [ ] IPs suspeitos bloqueados automaticamente

### Validação de Entrada
- [ ] Zod schemas em todas as rotas
- [ ] Sanitização XSS automática
- [ ] SQL injection impossível (Prisma)
- [ ] Tamanho máximo de body: 100kb
- [ ] Upload de arquivos desabilitado (ou limitado)

### Bloqueio de Conta
- [ ] 5 tentativas de login máximas
- [ ] Bloqueio temporário: 30 minutos
- [ ] Bloqueio permanente manual disponível
- [ ] Contador resetado em login bem-sucedido

## 📝 Auditoria e Logging

### Logs Estruturados
- [ ] Winston configurado
- [ ] Rotação diária de logs
- [ ] Retenção: 14 dias (aplicação), 30 dias (erros)
- [ ] Logs não expõem dados sensíveis
- [ ] Stack traces apenas em development

### Eventos Logados
- [ ] Todos os logins (sucesso e falha)
- [ ] Mudanças de senha
- [ ] Habilitação/desabilitação de 2FA
- [ ] Tentativas de 2FA inválidas
- [ ] Bloqueios de conta
- [ ] Acessos a rotas sensíveis
- [ ] Erros 500+ no servidor

### Activity Log
- [ ] Todas as ações CRUD registradas
- [ ] Timestamp de cada ação
- [ ] Usuário responsável identificado
- [ ] Dados antes/depois armazenados (quando relevante)

## 🌐 Infraestrutura

### HTTPS/TLS
- [ ] Certificado SSL válido
- [ ] TLS 1.2 ou superior
- [ ] Redirect HTTP → HTTPS automático
- [ ] HSTS preload list (opcional)

### Firewall
- [ ] Apenas portas 80/443 expostas
- [ ] Porta do banco restrita a IP do servidor
- [ ] SSH apenas com chave (sem senha)
- [ ] Fail2ban ou similar configurado

### Monitoramento
- [ ] Uptime monitoring ativo
- [ ] Alertas de erro 500+
- [ ] Alertas de uso CPU/memória
- [ ] Logs centralizados (Datadog, Sentry, etc)

## 👥 Gestão de Usuários

### Administradores
- [ ] Senhas fortes obrigatórias
- [ ] 2FA obrigatório para super admins
- [ ] Revisão periódica de permissões
- [ ] Usuários inativos desativados automaticamente

### Clientes (dados pessoais)
- [ ] LGPD: direito ao esquecimento implementado
- [ ] LGPD: exportação de dados disponível
- [ ] LGPD: consentimento explícito coletado
- [ ] Dados sensíveis minimizados
- [ ] CPF/documentos criptografados (se armazenados)

## 🚨 Resposta a Incidentes

### Plano de Ação
- [ ] Plano de resposta documentado
- [ ] Contatos de emergência definidos
- [ ] Procedimento de rollback testado
- [ ] Backup testado e funcional (última semana)
- [ ] Equipe treinada

### Ferramentas de Emergência
- [ ] Script para revogar todos os tokens
- [ ] Script para bloquear usuário
- [ ] Script para exportar logs
- [ ] Acesso direto ao banco (somente leitura)

## 📊 Testes de Segurança

### Testes Manuais
- [ ] Tentativa de SQL injection
- [ ] Tentativa de XSS
- [ ] Tentativa de CSRF
- [ ] Tentativa de brute force
- [ ] Tentativa de escalação de privilégios
- [ ] Teste de tokens expirados

### Testes Automatizados
- [ ] CI/CD com security checks
- [ ] OWASP ZAP scan semanal
- [ ] npm audit no pipeline
- [ ] CodeQL habilitado
- [ ] Dependency review em PRs

### Penetration Testing
- [ ] Pentest externo anual (recomendado)
- [ ] Bug bounty program (opcional)
- [ ] Red team exercises (opcional)

## 📚 Documentação

### Para Desenvolvedores
- [ ] SECURITY.md atualizado
- [ ] Guia de contribuição com práticas seguras
- [ ] Código comentado em partes críticas
- [ ] Exemplos de uso seguro

### Para Operações
- [ ] Runbook de deploy
- [ ] Procedimento de backup/restore
- [ ] Procedimento de incidente
- [ ] Contatos de emergência

### Para Usuários
- [ ] Guia de configuração 2FA
- [ ] Boas práticas de senha
- [ ] Como reportar problemas de segurança

## ✅ Certificações e Compliance

### Opcional (para ambientes corporativos)
- [ ] ISO 27001 compliance
- [ ] SOC 2 Type II
- [ ] PCI-DSS (se processar pagamentos)
- [ ] LGPD/GDPR compliance audit
- [ ] OWASP ASVS Level 2+

## 🔄 Manutenção Contínua

### Semanal
- [ ] Revisar logs de segurança
- [ ] Verificar alertas Dependabot
- [ ] Atualizar dependências patch

### Mensal
- [ ] npm audit completo
- [ ] Revisar usuários ativos
- [ ] Testar backup/restore
- [ ] Atualizar dependências minor

### Trimestral
- [ ] Auditoria de permissões
- [ ] Revisar políticas de senha
- [ ] Penetration testing interno
- [ ] Atualizar documentação

### Anual
- [ ] Auditoria externa (recomendado)
- [ ] Atualizar certificados SSL
- [ ] Revisar plano de incidentes
- [ ] Treinamento de segurança da equipe

---

## 📈 Scoring

Calcule seu score:
- ✅ Cada item marcado: 1 ponto
- Total de itens: ~100

| Score | Nível |
|-------|-------|
| 90-100 | 🟢 Excelente |
| 75-89 | 🟡 Bom |
| 60-74 | 🟠 Adequado |
| <60 | 🔴 Crítico |

**Meta mínima para produção: 75/100**

---

**Última atualização**: 11 de Junho de 2026
