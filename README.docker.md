# 🐳 Agenda+ - Quick Start com Docker

Sistema completo de agendamento com backend, frontend e banco de dados totalmente containerizado.

## 🚀 Início Rápido (3 passos)

### 1️⃣ Configurar Ambiente

```bash
# Copiar arquivo de configuração
cp .env.docker .env

# Gerar secrets seguros (IMPORTANTE!)
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
echo "COOKIE_SECRET=$(openssl rand -hex 32)" >> .env
echo "WEBHOOK_SECRET=$(openssl rand -hex 32)" >> .env

# Editar outras configurações
nano .env
```

### 2️⃣ Iniciar Aplicação

```bash
# Usando docker-compose diretamente
docker-compose up -d

# OU usando o script auxiliar
./docker.sh start
```

### 3️⃣ Acessar

**Desenvolvimento:**
- **Frontend**: http://localhost:8075
- **Backend API**: http://localhost:3009/api
- **Health Check**: http://localhost:3009/api/health

**Produção:**
- **Frontend**: https://agendaplus.dquimas.com.br
- **Backend API**: https://api-agenda.dquimas.com.br/api
- **Health Check**: https://api-agenda.dquimas.com.br/api/health

**Credenciais padrão:**
- Email: `super@agendaplus.com`
- Senha: `super123`

## 📦 Arquitetura

```
┌──────────────┐
│   Frontend   │  React + Vite + Nginx
│   Port: 80   │  
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Backend    │  Node.js + Express
│  Port: 3001  │  
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  PostgreSQL  │  Banco de Dados
│  Port: 5432  │  
└──────────────┘
```

## 🛠️ Comandos Principais

### Usando Script Auxiliar (`docker.sh`)

```bash
# Gerenciamento básico
./docker.sh start           # Iniciar aplicação
./docker.sh stop            # Parar aplicação
./docker.sh restart         # Reiniciar aplicação
./docker.sh status          # Ver status dos containers
./docker.sh logs            # Ver logs de todos os serviços
./docker.sh logs backend    # Ver logs apenas do backend

# Banco de dados
./docker.sh db:migrate      # Aplicar migrations
./docker.sh db:seed         # Dados iniciais
./docker.sh db:backup       # Criar backup
./docker.sh db:restore backup.sql  # Restaurar backup

# Desenvolvimento
./docker.sh shell backend   # Entrar no container do backend
./docker.sh shell postgres  # Entrar no PostgreSQL
./docker.sh build           # Reconstruir imagens

# Ajuda
./docker.sh help            # Ver todos os comandos
```

### Usando Docker Compose Direto

```bash
# Iniciar
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar
docker-compose down

# Rebuild
docker-compose build

# Ver status
docker-compose ps
```

## 📝 Variáveis de Ambiente Importantes

Edite o arquivo `.env`:

```env
# Banco de Dados
DB_USER=agenda_user
DB_PASSWORD=change_this_secure_password
DB_NAME=agenda_db

# JWT Secrets (GERAR!)
JWT_SECRET=<gerar com: openssl rand -hex 32>
COOKIE_SECRET=<gerar com: openssl rand -hex 32>
WEBHOOK_SECRET=<gerar com: openssl rand -hex 32>

# URLs de Produção
CLIENT_URL=https://agendaplus.dquimas.com.br
WEBHOOK_BASE_URL=https://api-agenda.dquimas.com.br

# Cookie Domain
COOKIE_DOMAIN=.dquimas.com.br

# WhatsApp (opcional)
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=seu_api_key
```

## 🔧 Troubleshooting

### Container não inicia

```bash
# Ver logs detalhados
./docker.sh logs backend

# Reconstruir imagem
docker-compose build --no-cache backend
docker-compose up -d
```

### Erro de conexão com banco

```bash
# Verificar status do PostgreSQL
docker-compose ps postgres

# Ver logs do PostgreSQL
docker-compose logs postgres

# Resetar banco (CUIDADO: apaga dados!)
docker-compose down -v
docker-compose up -d
```

### Porta já em uso

```bash
# Mudar portas no .env
FRONTEND_PORT=8080
BACKEND_PORT=3002
DB_PORT=5433
```

## 📚 Documentação Completa

Para informações detalhadas sobre:
- Arquitetura dos containers
- Comandos avançados
- Deploy em produção
- Backup e restore
- Segurança
- CI/CD

Consulte: **[DOCKER.md](DOCKER.md)**

## 🔐 Segurança

⚠️ **IMPORTANTE para Produção:**

1. **Gere secrets fortes**:
   ```bash
   openssl rand -hex 32
   ```

2. **Configure HTTPS** com nginx/Traefik

3. **Use Docker Secrets** ou vault para senhas

4. **Habilite firewall** e restrinja portas

5. **Atualize imagens** regularmente:
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

## 🚀 Deploy em Produção

### Opção 1: VPS (Recomendado para início)

```bash
# No servidor
git clone <seu-repositorio>
cd agenda+
cp .env.docker .env
# Configurar .env com valores de produção
docker-compose up -d
```

### Opção 2: Cloud Platforms

- **AWS ECS**: Deploy automatizado
- **Google Cloud Run**: Serverless
- **DigitalOcean App Platform**: Simples e barato
- **Heroku**: Container Registry

### Opção 3: Kubernetes

```bash
# Converter para K8s
kompose convert -f docker-compose.yml
kubectl apply -f .
```

## 📊 Monitoramento

### Health Checks

```bash
# Backend (desenvolvimento)
curl http://localhost:3009/api/health

# Backend (produção)
curl https://api-agenda.dquimas.com.br/api/health

# Frontend (desenvolvimento)
curl http://localhost:8075/

# Verificar todos
docker-compose ps
```

### Logs em Tempo Real

```bash
# Todos os serviços
docker-compose logs -f

# Apenas erros do backend
docker-compose logs backend | grep ERROR
```

## 💾 Backup e Restore

### Backup Completo

```bash
# Backup do banco
./docker.sh db:backup

# Backup dos volumes (dados + logs)
docker run --rm \
  -v agenda_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/volumes_backup.tar.gz /data
```

### Restore

```bash
# Restaurar banco
./docker.sh db:restore backup_20260615.sql

# Restaurar volumes
docker run --rm \
  -v agenda_postgres_data:/data \
  -v $(pwd):/backup \
  alpine sh -c "cd / && tar xzf /backup/volumes_backup.tar.gz"
```

## 🆘 Suporte

1. **Logs**: `./docker.sh logs`
2. **Status**: `./docker.sh status`
3. **Rebuild**: `./docker.sh build --no-cache`
4. **Documentação completa**: [DOCKER.md](DOCKER.md)

---

**Stack:**
- Frontend: React 18 + Vite + TailwindCSS
- Backend: Node.js 20 + Express + TypeScript
- Banco: PostgreSQL 16
- Infraestrutura: Docker + Docker Compose

**Licença**: MIT  
**Documentação atualizada**: 2026-06-15
