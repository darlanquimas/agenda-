import axios from 'axios';
import https from 'https';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

console.log('🔍 Testando QR Code da Evolution API...\n');
console.log(`URL: ${EVOLUTION_API_URL}`);
console.log(`API Key: ${EVOLUTION_API_KEY?.substring(0, 8)}...\n`);

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  requestCert: false,
});

async function testQRCode() {
  const instanceName = `test_qrcode_${Date.now()}`;

  try {
    console.log('📡 Passo 1: Criando instância...');
    const createResponse = await axios.post(
      `${EVOLUTION_API_URL}/instance/create`,
      {
        instanceName,
        qrcode: true,
      },
      {
        headers: {
          'apikey': EVOLUTION_API_KEY!,
          'Content-Type': 'application/json',
        },
        httpsAgent: EVOLUTION_API_URL?.startsWith('https') ? httpsAgent : undefined,
      }
    );

    console.log('✅ Instância criada!');
    console.log('📊 Status:', createResponse.status);
    console.log('📦 Resposta completa:');
    console.log(JSON.stringify(createResponse.data, null, 2));
    console.log('\n📋 Análise:');
    console.log('  - Tem instance?', !!createResponse.data?.instance);
    console.log('  - Tem qrcode?', !!createResponse.data?.qrcode);
    
    if (createResponse.data?.qrcode) {
      console.log('  - Campos do qrcode:', Object.keys(createResponse.data.qrcode));
      console.log('  - Tem base64?', !!createResponse.data.qrcode.base64);
      console.log('  - Tem code?', !!createResponse.data.qrcode.code);
      console.log('  - Tem pairingCode?', !!createResponse.data.qrcode.pairingCode);
      
      if (createResponse.data.qrcode.base64) {
        console.log('  - Tamanho base64:', createResponse.data.qrcode.base64.length, 'chars');
        console.log('  - Inicia com data:image?', createResponse.data.qrcode.base64.startsWith('data:image'));
      }
      if (createResponse.data.qrcode.code) {
        console.log('  - Code:', createResponse.data.qrcode.code.substring(0, 50) + '...');
      }
    } else {
      console.log('  ⚠️  QR Code não veio na criação!');
    }

    console.log('\n📡 Passo 2: Buscando QR Code via /instance/connect...');
    const connectResponse = await axios.get(
      `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
      {
        headers: {
          'apikey': EVOLUTION_API_KEY!,
        },
        httpsAgent: EVOLUTION_API_URL?.startsWith('https') ? httpsAgent : undefined,
      }
    );

    console.log('✅ Resposta do connect recebida!');
    console.log('📊 Status:', connectResponse.status);
    console.log('📦 Resposta completa:');
    console.log(JSON.stringify(connectResponse.data, null, 2));
    console.log('\n📋 Análise:');
    console.log('  - Tem qrcode?', !!connectResponse.data?.qrcode);
    
    if (connectResponse.data?.qrcode) {
      console.log('  - Campos do qrcode:', Object.keys(connectResponse.data.qrcode));
      console.log('  - Tem base64?', !!connectResponse.data.qrcode.base64);
      console.log('  - Tem code?', !!connectResponse.data.qrcode.code);
      console.log('  - Tem pairingCode?', !!connectResponse.data.qrcode.pairingCode);
    }

    console.log('\n🗑️  Limpando: Deletando instância de teste...');
    await axios.delete(`${EVOLUTION_API_URL}/instance/delete/${instanceName}`, {
      headers: {
        'apikey': EVOLUTION_API_KEY!,
      },
      httpsAgent: EVOLUTION_API_URL?.startsWith('https') ? httpsAgent : undefined,
    });
    console.log('✅ Instância deletada!');

  } catch (error: any) {
    console.error('\n❌ Erro:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('💡 Conclusão:');
  console.log('Se "Tem qrcode?" for false, a Evolution API não está');
  console.log('configurada corretamente ou a instância já está conectada.');
  console.log('='.repeat(60));
}

testQRCode();
