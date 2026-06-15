# Dockerfile para o Backend (Node.js + TypeScript)
FROM node:20-alpine AS base

# Instalar dependências do sistema necessárias
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copiar apenas arquivos de dependências primeiro (melhor cache)
COPY package*.json ./
COPY prisma ./prisma/

# Instalar TODAS as dependências (incluindo devDependencies para o build)
RUN npm ci && npm cache clean --force

# Gerar cliente Prisma
RUN npx prisma generate

# Copiar código fonte
COPY . .

# Build da aplicação TypeScript
RUN npm run build

# Stage de produção (menor imagem final)
FROM node:20-alpine AS production

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copiar package.json e instalar apenas dependências de produção
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production && npm cache clean --force
RUN npx prisma generate

# Copiar arquivos compilados do stage anterior
COPY --from=base /app/dist ./dist

# Criar diretório de logs
RUN mkdir -p logs

# Usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expor porta
EXPOSE 3009

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3009/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando de inicialização
CMD ["npm", "start"]
