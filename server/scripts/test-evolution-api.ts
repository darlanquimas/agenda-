import axios from 'axios';
import https from 'https';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

console.log('🔍 Testando conexão com Evolution API...\n');
console.log(`URL: ${EVOLUTION_API_URL}`);
console.log(`API Key: ${EVOLUTION_API_KEY ? EVOLUTION_API_KEY.substring(0, 8) + '...' + EVOLUTION_API_KEY.slice(-4) : 'NÃO CONFIGURADA'}\n`);

async function testConnection() {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.error('❌ ERRO: EVOLUTION_API_URL ou EVOLUTION_API_KEY não configuradas no .env');
    process.exit(1);
  }

  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    requestCert: false,
  });

  // Teste 1: Endpoint raiz
  console.log('📡 Teste 1: Conectando ao endpoint raiz...');
  try {
    const response = await axios.get(`${EVOLUTION_API_URL}/`, {
      headers: {
        'apikey': EVOLUTION_API_KEY,
      },
      timeout: 10000,
      httpsAgent: EVOLUTION_API_URL.startsWith('https') ? httpsAgent : undefined,
    });

    console.log('✅ Conexão bem-sucedida!');
    console.log(`   Status: ${response.status}`);
    console.log(`   Resposta:`, JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('⚠️  Endpoint raiz falhou:', error.code || error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    }
  }

  console.log('\n📡 Teste 2: Listando instâncias...');
  try {
    const response = await axios.get(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      headers: {
        'apikey': EVOLUTION_API_KEY,
      },
      timeout: 10000,
      httpsAgent: EVOLUTION_API_URL.startsWith('https') ? httpsAgent : undefined,
    });

    console.log('✅ Listagem de instâncias bem-sucedida!');
    console.log(`   Status: ${response.status}`);
    console.log(`   Instâncias:`, JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('❌ Falha ao listar instâncias');
    console.error(`   Código: ${error.code}`);
    console.error(`   Mensagem: ${error.message}`);
    
    if (error.response) {
      console.error(`   Status HTTP: ${error.response.status}`);
      console.error(`   Resposta:`, error.response.data);
    }
  }

  console.log('\n📡 Teste 3: Testando criação de instância de teste...');
  try {
    const testInstanceName = `test_${Date.now()}`;
    const response = await axios.post(
      `${EVOLUTION_API_URL}/instance/create`,
      {
        instanceName: testInstanceName,
        qrcode: true,
      },
      {
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
        httpsAgent: EVOLUTION_API_URL.startsWith('https') ? httpsAgent : undefined,
      }
    );

    console.log('✅ Teste de criação bem-sucedido!');
    console.log(`   Status: ${response.status}`);
    console.log(`   Resposta:`, JSON.stringify(response.data, null, 2));
    
    // Deletar instância de teste
    console.log(`\n🗑️  Removendo instância de teste...`);
    await axios.delete(`${EVOLUTION_API_URL}/instance/delete/${testInstanceName}`, {
      headers: {
        'apikey': EVOLUTION_API_KEY,
      },
      httpsAgent: EVOLUTION_API_URL.startsWith('https') ? httpsAgent : undefined,
    });
    console.log('✅ Instância de teste removida!');
    
  } catch (error: any) {
    console.error('❌ Falha no teste de criação');
    console.error(`   Código: ${error.code}`);
    console.error(`   Mensagem: ${error.message}`);
    
    if (error.response) {
      console.error(`   Status HTTP: ${error.response.status}`);
      console.error(`   Resposta:`, JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎯 Diagnóstico concluído!');
  console.log('='.repeat(60));
  console.log('\n💡 Se os testes falharam, verifique:');
  console.log('  1. Evolution API está rodando?');
  console.log('  2. A URL está acessível? (teste no navegador)');
  console.log('  3. A API Key está correta?');
  console.log('  4. Há firewall bloqueando a conexão?');
}

testConnection();
