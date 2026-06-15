#!/bin/bash

echo "=========================================="
echo "DIAGNÓSTICO COMPLETO - AGENDA+"
echo "=========================================="
echo ""

echo "1. STATUS DOS CONTAINERS"
echo "----------------------------------------"
docker ps -a | grep -E 'agenda|NAMES'
echo ""

echo "2. LOGS DO FRONTEND (últimas 20 linhas)"
echo "----------------------------------------"
docker logs agenda-frontend --tail 20 2>&1 || echo "Container não encontrado"
echo ""

echo "3. LOGS DO BACKEND (últimas 20 linhas)"
echo "----------------------------------------"
docker logs agenda-backend --tail 20 2>&1 || echo "Container não encontrado"
echo ""

echo "4. ARQUIVOS DENTRO DO CONTAINER FRONTEND"
echo "----------------------------------------"
docker exec agenda-frontend ls -la /usr/share/nginx/html/ 2>&1 || echo "Não foi possível acessar"
echo ""

echo "5. CONTEÚDO DO INDEX.HTML DO CONTAINER"
echo "----------------------------------------"
docker exec agenda-frontend cat /usr/share/nginx/html/index.html 2>&1 | head -15 || echo "Não foi possível ler"
echo ""

echo "6. TESTE DE ACESSO LOCAL AO FRONTEND"
echo "----------------------------------------"
curl -I http://localhost:8075 2>&1 | head -15
echo ""

echo "7. TESTE DE ACESSO LOCAL AO BACKEND"
echo "----------------------------------------"
curl -I http://localhost:3009/api/health 2>&1 | head -15
echo ""

echo "8. PORTAS ESCUTANDO"
echo "----------------------------------------"
ss -tlnp | grep -E ':8075|:3009|:80|:443' || netstat -tlnp | grep -E ':8075|:3009|:80|:443'
echo ""

echo "9. CONFIGURAÇÃO NGINX DO HOST"
echo "----------------------------------------"
ls -la /etc/nginx/sites-enabled/ 2>&1 || echo "Diretório não existe"
echo ""
echo "Procurando configuração para dquimas.com.br:"
grep -r "dquimas.com.br" /etc/nginx/ 2>&1 | head -10 || echo "Não encontrado"
echo ""

echo "10. STATUS DO NGINX DO HOST"
echo "----------------------------------------"
systemctl status nginx --no-pager -l 2>&1 | head -20 || service nginx status 2>&1
echo ""

echo "11. ÚLTIMOS ERROS DO NGINX DO HOST"
echo "----------------------------------------"
tail -20 /var/log/nginx/error.log 2>&1 || echo "Log não acessível"
echo ""

echo "12. NETWORK DO DOCKER"
echo "----------------------------------------"
docker network ls | grep prod
docker network inspect prod_network 2>&1 | grep -A 5 "agenda" || echo "Network não encontrada"
echo ""

echo "=========================================="
echo "DIAGNÓSTICO COMPLETO"
echo "=========================================="
