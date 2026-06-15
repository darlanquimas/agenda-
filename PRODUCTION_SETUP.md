# Configuração de Produção - Agenda+

Este documento descreve as configurações específicas para o ambiente de produção.

## URLs de Produção

| Serviço | Domínio | Porta |
|---|---|---|
| Frontend | https://agendaplus.dquimas.com.br | 8075 (host) → 80 (container) |
| Backend API | https://api-agenda.dquimas.com.br | 3009 |

## Variáveis de Ambiente Obrigatórias

### Backend (`server/.env`)

```env
# Ambiente
NODE_ENV=production

# Servidor
PORT=3009
CLIENT_URL=https://agendaplus.dquimas.com.br

# Banco de dados PostgreSQL
DATABASE_URL=postgres://postgres:SENHA_SEGURA@database:5432/agendaplus

# Autenticação JWT (CRÍTICO: gerar valores seguros!)
JWT_SECRET=<gerar com: openssl rand -hex 32>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Cookie Configuration
COOKIE_SECRET=<gerar com: openssl rand -hex 32>
COOKIE_SAME_SITE=strict
COOKIE_DOMAIN=.dquimas.com.br

# Security Features
ENABLE_CSRF=true
ENABLE_2FA=true

# Limites HTTP
JSON_BODY_LIMIT=100kb

# Rate Limiting (janela em ms)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_LOGIN=20
RATE_LIMIT_MAX_BOOKING=30
RATE_LIMIT_MAX_API=500

# Account Security
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=30
PASSWORD_MIN_LENGTH=12

# Logging
LOG_LEVEL=info
LOG_DIR=logs

# Evolution API Configuration
EVOLUTION_API_URL=http://evolution-api:5062
EVOLUTION_API_KEY=<sua_api_key>
WEBHOOK_BASE_URL=https://api-agenda.dquimas.com.br

# Webhook Security (CRÍTICO: gerar valor aleatório longo)
WEBHOOK_SECRET=<gerar com: openssl rand -hex 32>

# Token Configuration
CONFIRMATION_TOKEN_EXPIRATION_HOURS=48
```

### Docker Compose (`.env`)

```env
# Banco de Dados
DB_USER=agenda_user
DB_PASSWORD=<senha_segura_do_banco>
DB_NAME=agenda_db
DB_PORT=5432

# Backend
NODE_ENV=production
BACKEND_PORT=3009
CLIENT_URL=https://agendaplus.dquimas.com.br

# JWT Secrets
JWT_SECRET=<gerar com: openssl rand -hex 32>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Cookie Configuration
COOKIE_SECRET=<gerar com: openssl rand -hex 32>
COOKIE_SAME_SITE=strict
COOKIE_DOMAIN=.dquimas.com.br

# Security
ENABLE_CSRF=true
ENABLE_2FA=true

# Evolution API
EVOLUTION_API_URL=http://evolution-api:5062
EVOLUTION_API_KEY=<sua_api_key>
WEBHOOK_BASE_URL=https://api-agenda.dquimas.com.br
WEBHOOK_SECRET=<gerar com: openssl rand -hex 32>

# Token Configuration
CONFIRMATION_TOKEN_EXPIRATION_HOURS=48

# Logs
LOG_LEVEL=info

# Frontend
FRONTEND_PORT=8075
```

## Configuração do Servidor Web (Nginx/Caddy)

### Opção 1: Nginx como Proxy Reverso

Criar arquivo `/etc/nginx/sites-available/agendaplus`:

```nginx
# Frontend - agendaplus.dquimas.com.br
server {
    listen 80;
    listen [::]:80;
    server_name agendaplus.dquimas.com.br;
    
    # Redirecionar para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name agendaplus.dquimas.com.br;

    # Certificados SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/agendaplus.dquimas.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/agendaplus.dquimas.com.br/privkey.pem;
    
    # Configurações SSL modernas
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    
    # Headers de segurança
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:8075;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Backend API - api-agenda.dquimas.com.br
server {
    listen 80;
    listen [::]:80;
    server_name api-agenda.dquimas.com.br;
    
    # Redirecionar para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api-agenda.dquimas.com.br;

    # Certificados SSL
    ssl_certificate /etc/letsencrypt/live/api-agenda.dquimas.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-agenda.dquimas.com.br/privkey.pem;
    
    # Configurações SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    
    # Headers de segurança
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Limites de taxa (proteção adicional)
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req zone=api_limit burst=20 nodelay;

    location / {
        proxy_pass http://localhost:3009;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Ativar o site:
```bash
sudo ln -s /etc/nginx/sites-available/agendaplus /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Opção 2: Caddy (mais simples)

Criar arquivo `Caddyfile`:

```caddy
# Frontend
agendaplus.dquimas.com.br {
    reverse_proxy localhost:8075
    
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
    }
}

# Backend API
api-agenda.dquimas.com.br {
    reverse_proxy localhost:3009
    
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
    }
}
```

## Certificados SSL

### Usando Certbot (Let's Encrypt)

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Gerar certificados para ambos os domínios
sudo certbot --nginx -d agendaplus.dquimas.com.br -d api-agenda.dquimas.com.br

# Renovação automática já está configurada
```

## Deploy com Docker Compose

1. **Clonar repositório no servidor:**
```bash
cd /opt
sudo git clone <seu-repositorio> agendaplus
cd agendaplus
```

2. **Configurar variáveis de ambiente:**
```bash
# Copiar exemplo
cp .env.docker .env

# Gerar secrets
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
echo "COOKIE_SECRET=$(openssl rand -hex 32)" >> .env
echo "WEBHOOK_SECRET=$(openssl rand -hex 32)" >> .env

# Editar outras variáveis
sudo nano .env
```

3. **Iniciar aplicação:**
```bash
docker-compose up -d
```

4. **Verificar logs:**
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Checklist de Segurança

- [ ] Secrets gerados com `openssl rand -hex 32`
- [ ] `NODE_ENV=production`
- [ ] HTTPS configurado (certificados SSL)
- [ ] `COOKIE_DOMAIN=.dquimas.com.br`
- [ ] `COOKIE_SAME_SITE=strict`
- [ ] Firewall configurado (portas 80, 443, 22)
- [ ] Rate limiting ativado
- [ ] CSRF ativado (`ENABLE_CSRF=true`)
- [ ] 2FA ativado (`ENABLE_2FA=true`)
- [ ] Senhas do banco fortes
- [ ] Backup automático configurado
- [ ] Logs sendo monitorados

## URLs de Verificação

Após o deploy, testar:

```bash
# Health check da API
curl https://api-agenda.dquimas.com.br/api/health

# Frontend acessível
curl -I https://agendaplus.dquimas.com.br

# Verificar certificado SSL
openssl s_client -connect api-agenda.dquimas.com.br:443 -servername api-agenda.dquimas.com.br
```

## Monitoramento

### Logs do Docker
```bash
# Ver logs em tempo real
docker-compose logs -f

# Últimas 100 linhas
docker-compose logs --tail=100

# Logs de um serviço específico
docker-compose logs -f backend
```

### Logs do Sistema
Os logs da aplicação ficam em:
- Backend: `/opt/agendaplus/server/logs/`

### Alertas Recomendados

- Disco > 80% de uso
- Memória > 85% de uso
- CPU > 90% por mais de 5 minutos
- Erros 5xx > 10 em 5 minutos
- Taxa de falhas de login > 50 em 1 minuto

## Backup

### Backup do Banco de Dados
```bash
# Backup manual
docker exec agenda-database pg_dump -U postgres agendaplus > backup-$(date +%Y%m%d).sql

# Restaurar backup
docker exec -i agenda-database psql -U postgres agendaplus < backup-20260615.sql
```

### Backup Automático (Cron)
```bash
# Adicionar ao crontab
0 2 * * * /opt/agendaplus/scripts/backup.sh
```

## Rollback

Em caso de problemas:

```bash
# Voltar para versão anterior
cd /opt/agendaplus
git checkout <commit-anterior>
docker-compose down
docker-compose up -d --build
```

## Suporte

Para problemas em produção:
1. Verificar logs: `docker-compose logs -f`
2. Verificar health check: `curl https://api-agenda.dquimas.com.br/api/health`
3. Verificar uso de recursos: `docker stats`
4. Consultar documentação em `/docs`
