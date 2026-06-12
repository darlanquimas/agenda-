#!/bin/bash

# Script de instalação de dependências de segurança
# Agenda+ Security Implementation

set -e

echo "🔒 Instalando dependências de segurança - Agenda+"
echo "=================================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para print colorido
print_step() {
    echo -e "${GREEN}▶${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    print_error "package.json não encontrado. Execute este script da raiz do projeto."
    exit 1
fi

# Instalação Backend
print_step "Instalando dependências do backend..."
cd server

print_step "  → Instalando cookie-parser..."
npm install cookie-parser

print_step "  → Instalando csurf (CSRF protection)..."
npm install csurf

print_step "  → Instalando xss (sanitização)..."
npm install xss

print_step "  → Instalando zod (validação)..."
npm install zod

print_step "  → Instalando winston (logging)..."
npm install winston winston-daily-rotate-file

print_step "  → Instalando speakeasy (2FA TOTP)..."
npm install speakeasy

print_step "  → Instalando qrcode (QR Code para 2FA)..."
npm install qrcode

print_step "  → Instalando tipos TypeScript..."
npm install --save-dev @types/cookie-parser @types/qrcode @types/speakeasy

print_success "Dependências do backend instaladas com sucesso!"

cd ..

# Verificar vulnerabilidades
print_step "Verificando vulnerabilidades..."
cd server
npm audit --audit-level=moderate || print_warning "Vulnerabilidades encontradas. Execute 'npm audit fix' se necessário."
cd ..

# Gerar client Prisma
print_step "Gerando Prisma Client..."
cd server
npm run db:generate
print_success "Prisma Client gerado!"
cd ..

echo ""
echo "=================================================="
print_success "Instalação concluída!"
echo ""
echo "📋 Próximos passos:"
echo ""
echo "1. Aplique a migration de segurança:"
echo "   cd server && npm run db:migrate"
echo ""
echo "2. Atualize suas variáveis de ambiente:"
echo "   cp server/.env.example server/.env"
echo "   # Edite server/.env com os novos valores"
echo ""
echo "3. Rode o seed para popular dados iniciais:"
echo "   cd server && npm run db:seed"
echo ""
echo "4. Inicie o servidor:"
echo "   npm run dev"
echo ""
echo "🔐 Recursos de segurança instalados:"
echo "   ✓ JWT com cookies httpOnly"
echo "   ✓ Refresh tokens com rotação"
echo "   ✓ 2FA (Two-Factor Authentication)"
echo "   ✓ Sanitização XSS"
echo "   ✓ Validação com Zod"
echo "   ✓ Logging estruturado (Winston)"
echo "   ✓ CSRF protection"
echo "   ✓ Rate limiting avançado"
echo ""
echo "📖 Leia a documentação:"
echo "   - SECURITY.md"
echo "   - docs/SECURITY_CHECKLIST.md"
echo "   - SECURITY_IMPLEMENTATION_PLAN.md"
echo ""
print_success "Tudo pronto! 🚀"
