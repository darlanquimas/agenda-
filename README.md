# Baba Admin

Painel administrativo web completo com sistema de agendamento público. Desenvolvido com React, Node.js e SQLite.

---

## Funcionalidades

### Painel administrativo (acesso restrito)
- **Dashboard** — estatísticas em tempo real, gráfico dos últimos 30 dias, próximos agendamentos e feed de atividades
- **Clientes** — cadastro, edição, busca e desativação de clientes
- **Profissionais** — cadastro com especialidades, serviços vinculados e disponibilidade por dia da semana
- **Serviços & Especialidades** — gerenciamento de catálogo de serviços (nome, duração, preço) e especialidades
- **Agendamentos** — visualização com filtro por status, criação e edição manual
- **Histórico** — linha do tempo de todas as ações realizadas no sistema

### Página pública de agendamento (`/book`)
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
| Frontend | React 18 + Vite + Tailwind CSS |
| Roteamento | React Router v6 |
| Gráficos | Recharts |
| Ícones | Lucide React |
| Backend | Node.js + Express |
| Banco de dados | SQLite (better-sqlite3) |
| Autenticação | JWT + bcryptjs |
| Datas | date-fns |

---

## Estrutura do projeto

```
baba/
├── client/                  # Frontend React
│   └── src/
│       ├── api/             # Instância Axios com interceptor de token
│       ├── components/      # Layout, Sidebar, Modal, StatusBadge
│       ├── contexts/        # AuthContext (estado global do usuário)
│       └── pages/
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── Clients.jsx
│           ├── Professionals.jsx
│           ├── ServicesPage.jsx
│           ├── Appointments.jsx
│           ├── History.jsx
│           └── Booking.jsx  # Página pública
│
├── server/                  # Backend Express
│   ├── routes/
│   │   ├── auth.js          # POST /login, GET /me
│   │   ├── clients.js       # CRUD de clientes
│   │   ├── professionals.js # CRUD de profissionais
│   │   ├── services.js      # CRUD de serviços
│   │   ├── specialties.js   # CRUD de especialidades
│   │   ├── appointments.js  # CRUD de agendamentos
│   │   ├── dashboard.js     # Estatísticas e histórico
│   │   └── booking.js       # API pública (sem autenticação)
│   ├── middleware/
│   │   └── auth.js          # Validação JWT
│   ├── db.js                # Schema SQLite + seed inicial
│   └── index.js             # Entry point do servidor
│
└── package.json             # Scripts raiz (concurrently)
```

---

## Como rodar

### Pré-requisitos

- Node.js 18+
- npm 9+

### Instalação

```bash
# 1. Clone ou extraia o projeto
cd baba

# 2. Instale todas as dependências (raiz + server + client)
npm run install:all
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
| Agendamento público | http://localhost:5173/book |

Para rodar separadamente:

```bash
npm run dev:server   # Apenas o backend (porta 3001)
npm run dev:client   # Apenas o frontend (porta 5173)
```

### Primeiro acesso

O banco de dados SQLite é criado automaticamente em `server/baba.db` na primeira execução, já com dados de exemplo.

| Papel | Email | Senha | Acesso |
|---|---|---|---|
| Super admin (plataforma) | super@baba.com | super123 | `/platform` — todas as organizações |
| Admin do tenant demo | admin@baba.com | admin123 | Painel do tenant `demo` |

Agendamento público: `http://localhost:5173/book/demo` (slug da organização).

### Permissões de usuários

| Papel | Onde gerencia | Escopo |
|---|---|---|
| Super admin | `/platform` → aba Usuários | Todos os usuários de todas as organizações (pode alterar tenant) |
| Admin do tenant | `/users` no painel | Somente usuários `admin` da própria organização |

> Para alterar senhas, use o painel da plataforma (super admin) ou atualize o hash em `server/db.js`.

---

## Banco de dados

O arquivo `server/baba.db` é criado automaticamente. Para resetar e recriar com os dados de seed:

```bash
rm server/baba.db
npm run dev:server
```

### Tabelas

| Tabela | Descrição |
|---|---|
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

### Rotas públicas (sem autenticação)

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/booking/professionals` | Lista profissionais ativos |
| GET | `/api/booking/professionals/:id/services` | Serviços de um profissional |
| GET | `/api/booking/professionals/:id/availability` | Dias disponíveis (0–6) |
| GET | `/api/booking/slots?professionalId=&serviceId=&date=` | Horários livres em uma data |
| POST | `/api/booking` | Cria agendamento público |

### Rotas autenticadas (Bearer JWT)

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Login |
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
http://seu-dominio.com/book
```

O sistema de slots leva em conta:
- Dias e horários configurados por profissional
- Duração de cada serviço
- Agendamentos já existentes (sem sobreposição)

---

## Variáveis de ambiente

Copie o template e ajuste conforme o ambiente:

```bash
cp server/.env.example server/.env
```

| Variável | Descrição | Padrão (dev) |
|---|---|---|
| `NODE_ENV` | `development` ou `production` | `development` |
| `PORT` | Porta da API | `3001` |
| `CLIENT_URL` | Origem permitida no CORS | `http://localhost:5173` |
| `JWT_SECRET` | Chave de assinatura JWT | obrigatório em production |
| `JWT_EXPIRES_IN` | Validade do token | `8h` |
| `DATABASE_PATH` | Caminho do SQLite | `server/baba.db` |
| `JSON_BODY_LIMIT` | Limite do body JSON | `100kb` |
| `RATE_LIMIT_WINDOW_MS` | Janela do rate limit (ms) | `900000` |
| `RATE_LIMIT_MAX_LOGIN` | Máx. tentativas de login por janela | `20` |
| `RATE_LIMIT_MAX_BOOKING` | Máx. POST públicos de agendamento | `30` |

Em **production**, o servidor não inicia sem `JWT_SECRET` definido com valor seguro (diferente do padrão de desenvolvimento).

---

## Produção

```bash
# Build do frontend
cd client && npm run build

# Sirva os arquivos de dist/ com um servidor estático (nginx, etc.)
# e mantenha o backend rodando com pm2 ou similar

pm2 start server/index.js --name baba-server
```
