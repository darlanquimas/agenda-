# Dockerfile para o Backend (Node.js + TypeScript)
FROM node:20-alpine AS production

# Instalar dependências do sistema necessárias
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copiar package.json e instalar dependências (incluindo tsx para rodar TS)
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci && npm cache clean --force
RUN npx prisma generate

# Copiar código fonte
COPY . .

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

# Comando de inicialização usando tsx (roda TypeScript diretamente)
CMD ["npx", "tsx", "index.ts"]
