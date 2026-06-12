# Baba Admin

Painel administrativo web completo com sistema de agendamento público. Desenvolvido com React, Node.js e PostgreSQL.

---

## Funcionalidades

### Painel administrativo (acesso restrito)
- **Dashboard** — estatísticas em tempo real, gráfico dos últimos 30 dias, próximos agendamentos e feed de atividades
- **Clientes** — cadastro, edição, busca e desativação de clientes
- **Profissionais** — cadastro com especialidades, serviços vinculados e disponibilidade por dia da semana
- **Serviços & Especialidades** — gerenciamento de catálogo de serviços (nome, duração, preço) e especialidades
- **Agendamentos** — visualização com filtro por status, criação e edição manual
- **Histórico** — linha do tempo de todas as ações realizadas no sistema
- **Plataforma** — gestão de organizações (tenants) e usuários globais (super admin)
- **Segurança** — autenticação 2FA, gerenciamento de sessões e logs de segurança

### Página pública de agendamento (`/book/:tenantSlug`)
Wizard em 5 etapas acessível por qualquer pessoa, sem login:
1. Escolha do profissional
2. Escolha do serviço (com duração e preço)
3. Seleção de data e horário disponível
4. Dados do cliente (nome, email, telefone)
5. Confirmação com código do agendamento

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Roteamento | React Router v6 |
| Gráficos | Recharts |
| Ícones | Lucide React |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma 7 |
| Banco de dados | PostgreSQL |
| Autenticação | JWT + bcryptjs |
| Datas | date-fns |

---

## Estrutura do projeto

```
agenda+/
├── client/                  # Frontend React
│   └── src/
│       ├── api/             # Instância Axios com interceptor de token
│       ├── components/      # Layout, Sidebar, Modal, StatusBadge
│       ├── contexts/        # AuthContext (estado global do usuário)
│       └── pages/
│           ├── Login.tsx
│           ├── Dashboard.tsx
│           ├── Clients.tsx
│           ├── Professionals.tsx
│           ├── ServicesPage.tsx
│           ├── Appointments.tsx
│           ├── History.tsx
│           ├── TenantUsers.tsx
│           ├── Platform.tsx
│           └── Booking.tsx  # Página pública
│
├── server/                  # Backend Express
│   ├── routes/              # Rotas da API (auth, clients, booking, etc.)
│   ├── middleware/          # JWT, tenant, rate limiting
│   ├── services/            # Regras de negócio
│   ├── lib/                 # Prisma, validação, utilitários
│   ├── prisma/
│   │   ├── schema.prisma    # Modelos do banco
│   │   ├── migrations/      # Migrações SQL
│   │   └── seed.ts          # Dados iniciais
│   └── index.ts             # Entry point do servidor
│
└── package.json             # Scripts raiz (concurrently)
```

---

## Como rodar

### Pré-requisitos

- Node.js 18+
- npm 9+
- PostgreSQL 14+

### Instalação

```bash
# 1. Entre na pasta do projeto
cd agenda+

# 2. Instale todas as dependências (raiz + server + client)
npm run install:all

# 3. Configure as variáveis de ambiente
cp server/.env.example server/.env
# Edite server/.env com DATABASE_URL, JWT_SECRET, etc.

# 4. Crie o banco e aplique as migrações
cd server
npm run db:generate
npm run db:migrate
npm run db:seed
cd ..
```

### Desenvolvimento

```bash
# Inicia backend e frontend simultaneamente
npm run dev
```

| Serviço | URL |
|---|---|
| Frontend (admin) | http://localhost:5173 |
| Backend (API) | http://localhost:3001 |
| Agendamento público | http://localhost:5173/book/demo |

Para rodar separadamente:

```bash
npm run dev:server   # Apenas o backend (porta 3001)
npm run dev:client   # Apenas o frontend (porta 5173)
```

### Primeiro acesso

Após rodar o seed, os seguintes usuários estarão disponíveis:

| Papel | Email | Senha | Acesso |
|---|---|---|---|
| Super admin (plataforma) | super@agendaplus.com | super123 | `/platform` — todas as organizações |
| Admin do tenant demo | admin@agendaplus.com | admin123 | Painel do tenant `demo` |

Agendamento público: `http://localhost:5173/book/demo` (slug da organização).

### Permissões de usuários

| Papel | Onde gerencia | Escopo |
|---|---|---|
| Super admin | `/platform` → aba Usuários | Todos os usuários de todas as organizações (pode alterar tenant) |
| Admin do tenant | `/users` no painel | Somente usuários `admin` da própria organização |

> Para alterar senhas, use o painel da plataforma (super admin) ou atualize o hash diretamente no banco.

---

## Banco de dados

O projeto usa **PostgreSQL** com **Prisma**. A conexão é configurada pela variável `DATABASE_URL` em `server/.env`.

### Comandos úteis

```bash
cd server

npm run db:generate   # Gera o client Prisma
npm run db:migrate    # Aplica migrações pendentes
npm run db:seed       # Popula dados iniciais (idempotente)
npm run db:studio     # Interface visual do banco
```

### Resetar e recriar

```bash
# Recrie o banco no PostgreSQL, depois:
cd server
npm run db:migrate
npm run db:seed
```

### Tabelas

| Tabela | Descrição |
|---|---|
| `tenants` | Organizações (multi-tenant) |
| `users` | Usuários administradores |
| `clients` | Clientes cadastrados |
| `professionals` | Profissionais disponíveis |
| `specialties` | Especialidades (ex: Design, Desenvolvimento) |
| `professional_specialties` | Relação profissional ↔ especialidade |
| `services` | Serviços com duração e preço |
| `professional_services` | Relação profissional ↔ serviço |
| `availability` | Disponibilidade por dia da semana e horário |
| `appointments` | Agendamentos (admin ou público) |
| `activity_log` | Histórico de ações no sistema |

---

## API

As rotas públicas de agendamento incluem o slug do tenant: `/api/booking/:tenantSlug/...`

### Rotas públicas (sem autenticação)

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/booking/:tenantSlug/professionals` | Lista profissionais ativos |
| GET | `/api/booking/:tenantSlug/professionals/:id/services` | Serviços de um profissional |
| GET | `/api/booking/:tenantSlug/professionals/:id/availability` | Dias disponíveis (0–6) |
| GET | `/api/booking/:tenantSlug/slots?professionalId=&serviceId=&date=` | Horários livres em uma data |
| POST | `/api/booking/:tenantSlug` | Cria agendamento público |
| POST | `/api/auth/login` | Login |
| GET | `/api/health` | Health check |

### Rotas autenticadas (Bearer JWT)

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/auth/me` | Dados do usuário logado |
| GET/POST | `/api/clients` | Listagem e criação de clientes |
| GET/PUT/DELETE | `/api/clients/:id` | Detalhes, edição e desativação |
| GET/POST | `/api/professionals` | Listagem e criação |
| GET/PUT/DELETE | `/api/professionals/:id` | Detalhes, edição e desativação |
| GET/POST | `/api/services` | Listagem e criação |
| PUT/DELETE | `/api/services/:id` | Edição e desativação |
| GET/POST | `/api/specialties` | Listagem e criação |
| PUT/DELETE | `/api/specialties/:id` | Edição e exclusão |
| GET/POST | `/api/appointments` | Listagem com filtros e criação |
| GET/PUT/DELETE | `/api/appointments/:id` | Detalhes, edição e exclusão |
| GET | `/api/dashboard/stats` | Estatísticas do dashboard |
| GET | `/api/dashboard/activity` | Histórico paginado |
| GET/POST/PUT | `/api/users` | Usuários do tenant (admin) |
| GET/POST/PUT | `/api/platform/tenants` | Organizações (super admin) |
| GET/POST/PUT | `/api/platform/users` | Usuários globais (super admin) |

---

## Status dos agendamentos

| Status | Significado |
|---|---|
| `scheduled` | Agendado — aguardando execução |
| `running` | Em execução — em andamento |
| `finished` | Finalizado — concluído com sucesso |
| `failed` | Falhou — não foi possível executar |

---

## Link de agendamento

No painel admin, o botão **"Link de agendamento"** na barra lateral copia automaticamente a URL pública para o clipboard. Essa URL pode ser compartilhada com clientes por WhatsApp, email ou redes sociais.

```
http://seu-dominio.com/book/{slug-da-organizacao}
```

O sistema de slots leva em conta:
- Dias e horários configurados por profissional
- Duração de cada serviço
- Agendamentos já existentes (sem sobreposição)

---

## 🔒 Segurança

O Agenda+ implementa múltiplas camadas de segurança para proteger dados sensíveis e prevenir ataques:

### Recursos Implementados

#### Autenticação e Autorização
- **JWT com cookies httpOnly** — Tokens nunca expostos ao JavaScript
- **Refresh tokens** — Tokens de curta duração (15min) + refresh de longa duração (7d)
- **2FA (TOTP)** — Autenticação de dois fatores compatível com Google Authenticator
- **Códigos de backup** — 10 códigos únicos para recuperação
- **Proteção contra brute force** — Bloqueio após 5 tentativas falhadas (30 minutos)

#### Proteção de Dados
- **Bcrypt** — Senhas criptografadas com 10 rounds
- **Política de senhas forte** — Mínimo 12 caracteres com complexidade
- **Sanitização XSS** — Todas as entradas sanitizadas automaticamente
- **Validação com Zod** — Schemas rigorosos em todas as rotas
- **Isolamento multi-tenant** — Dados completamente segregados por organização

#### Proteção contra Ataques
- **SQL Injection** — Impossível via Prisma ORM (queries parametrizadas)
- **XSS (Cross-Site Scripting)** — Sanitização automática + CSP
- **CSRF (Cross-Site Request Forgery)** — Tokens CSRF configuráveis
- **Rate Limiting** — Limites configuráveis por rota
- **Helmet.js** — Headers de segurança (HSTS, CSP, X-Frame-Options, etc)

#### Auditoria e Conformidade
- **Logs estruturados** — Winston com rotação diária
- **Activity log** — Histórico de todas as ações no sistema
- **Rastreamento de sessões** — Controle de logins e tentativas falhadas
- **Dependabot** — Atualizações automáticas de segurança
- **GitHub Actions** — Scans automáticos (CodeQL, Trivy, npm audit)

### Como Habilitar Recursos de Segurança

```bash
# 1. Instalar dependências de segurança
chmod +x scripts/install-security-deps.sh
./scripts/install-security-deps.sh

# 2. Aplicar migration de segurança
cd server
npm run db:migrate

# 3. Configurar variáveis de ambiente (veja seção abaixo)
cp .env.example .env
# Edite .env com valores apropriados

# 4. Reiniciar servidor
npm run dev
```

### Habilitar 2FA para um Usuário

1. Faça login no painel administrativo
2. Acesse **Configurações** → **Segurança**
3. Clique em **Habilitar 2FA**
4. Escaneie o QR Code com Google Authenticator
5. Digite o código de 6 dígitos para confirmar
6. **Guarde os códigos de backup** em local seguro

### Documentação de Segurança

- 📄 [SECURITY.md](./SECURITY.md) — Política de segurança e como reportar vulnerabilidades
- ✅ [SECURITY_CHECKLIST.md](./docs/SECURITY_CHECKLIST.md) — Checklist completo pré-deploy
- 📋 [SECURITY_IMPLEMENTATION_PLAN.md](./SECURITY_IMPLEMENTATION_PLAN.md) — Plano técnico de implementação

---

## Variáveis de ambiente

Copie o template e ajuste conforme o ambiente:

```bash
cp server/.env.example server/.env
```

### Variáveis Básicas

| Variável | Descrição | Padrão (dev) |
|---|---|---|
| `NODE_ENV` | `development` ou `production` | `development` |
| `PORT` | Porta da API | `3001` |
| `CLIENT_URL` | Origem permitida no CORS | `http://localhost:5173` |
| `DATABASE_URL` | URL de conexão PostgreSQL | `postgresql://user:password@localhost:5432/baba_db` |

### JWT e Cookies

| Variável | Descrição | Padrão (dev) |
|---|---|---|
| `JWT_SECRET` | Chave de assinatura JWT (mín. 32 caracteres) | obrigatório |
| `JWT_EXPIRES_IN` | Validade do access token | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Validade do refresh token | `7d` |
| `COOKIE_SECRET` | Secret para cookies assinados | `JWT_SECRET` |
| `COOKIE_SAME_SITE` | Política SameSite (`strict`, `lax`, `none`) | `strict` |
| `COOKIE_DOMAIN` | Domínio dos cookies (ex: `.example.com`) | vazio |

### Segurança

| Variável | Descrição | Padrão |
|---|---|---|
| `ENABLE_CSRF` | Habilitar proteção CSRF | `true` |
| `ENABLE_2FA` | Habilitar autenticação 2FA | `true` |
| `MAX_LOGIN_ATTEMPTS` | Máx. tentativas antes de bloquear | `5` |
| `LOCKOUT_DURATION_MINUTES` | Duração do bloqueio temporário | `30` |
| `PASSWORD_MIN_LENGTH` | Comprimento mínimo da senha | `12` |

### Rate Limiting

| Variável | Descrição | Padrão |
|---|---|---|
| `RATE_LIMIT_WINDOW_MS` | Janela do rate limit (ms) | `900000` (15min) |
| `RATE_LIMIT_MAX_LOGIN` | Máx. tentativas de login | `20` |
| `RATE_LIMIT_MAX_BOOKING` | Máx. agendamentos públicos | `30` |
| `RATE_LIMIT_MAX_API` | Máx. requisições gerais | `500` |

### Outros

| Variável | Descrição | Padrão |
|---|---|---|
| `JSON_BODY_LIMIT` | Limite do body JSON | `100kb` |
| `LOG_LEVEL` | Nível de log (`debug`, `info`, `warn`, `error`) | `info` |
| `LOG_DIR` | Diretório dos logs | `logs` |

Em **production**, `JWT_SECRET` deve ter pelo menos 32 caracteres aleatórios. O servidor não inicia sem essa variável definida.

---

## Produção

```bash
# Build do frontend
cd client && npm run build

# Build do backend
cd ../server && npm run build

# Aplique migrações no banco de produção
npm run db:migrate

# Inicie o servidor (ex.: pm2)
pm2 start dist/index.js --name baba-server
```

Sirva os arquivos de `client/dist/` com um servidor estático (nginx, etc.) e mantenha o backend rodando com pm2 ou similar.
