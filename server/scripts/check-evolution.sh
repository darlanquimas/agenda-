#!/bin/bash

echo "🔍 Verificando Evolution API..."
echo ""

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não está instalado"
    echo "   Instale o Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✅ Docker instalado"

# Verificar se há container evolution-api rodando
if docker ps | grep -q evolution-api; then
    echo "✅ Container evolution-api está rodando"
    echo ""
    echo "📊 Status do container:"
    docker ps --filter "name=evolution-api" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "📝 Últimas 20 linhas do log:"
    docker logs --tail 20 evolution-api
else
    echo "⚠️  Container evolution-api NÃO está rodando"
    echo ""
    echo "🚀 Para iniciar a Evolution API, execute:"
    echo ""
    echo "   cd /home/darlan/projetos/darlan/agenda+"
    echo "   docker-compose up -d evolution-api"
    echo ""
    echo "   OU use o comando Docker direto (ver EVOLUTION_API_SETUP.md)"
fi

echo ""
echo "🔗 Testando conexão na porta 8081..."
if nc -z localhost 8081 2>/dev/null; then
    echo "✅ Porta 8081 está acessível"
else
    echo "❌ Porta 8081 não está acessível"
    echo "   A Evolution API precisa estar rodando na porta 8081"
fi

echo ""
echo "📖 Para mais informações, veja: EVOLUTION_API_SETUP.md"
