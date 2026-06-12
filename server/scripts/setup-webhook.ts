import axios from 'axios';
import config from '../config';
import logger from '../lib/logger';

interface WebhookConfig {
  instanceName: string;
  webhookUrl?: string;
}

async function setupWebhook({ instanceName, webhookUrl }: WebhookConfig) {
  const finalWebhookUrl = webhookUrl || `${config.webhookBaseUrl}/webhook/whatsapp/${instanceName}`;
  
  console.log('\n🔧 Configurando Webhook na Evolution API...\n');
  console.log(`Instância: ${instanceName}`);
  console.log(`Webhook URL: ${finalWebhookUrl}`);
  console.log(`Evolution API: ${config.evolutionApiUrl}\n`);

  try {
    // Configurar webhook
    const response = await axios.post(
      `${config.evolutionApiUrl}/webhook/set/${instanceName}`,
      {
        webhook: {
          enabled: true,
          url: finalWebhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          events: ['MESSAGES_UPSERT'],
        },
      },
      {
        headers: {
          apikey: config.evolutionApiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Webhook configurado com sucesso!');
    console.log('\nResposta da API:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Verificar configuração
    console.log('\n🔍 Verificando configuração...\n');
    const verification = await axios.get(
      `${config.evolutionApiUrl}/webhook/find/${instanceName}`,
      {
        headers: {
          apikey: config.evolutionApiKey,
        },
      }
    );
    
    console.log('Webhook configurado:');
    console.log(JSON.stringify(verification.data, null, 2));
    
    // Testar conectividade
    console.log('\n🧪 Testando conectividade do webhook...\n');
    try {
      const testResponse = await axios.get(`${config.webhookBaseUrl}/webhook/whatsapp/test`, {
        timeout: 5000,
      });
      console.log('✅ Webhook está acessível!');
      console.log(JSON.stringify(testResponse.data, null, 2));
    } catch (testError: any) {
      console.log('⚠️  AVISO: Webhook pode não estar acessível pela Evolution API');
      console.log(`Erro: ${testError.message}`);
      console.log('\nVerifique se:');
      console.log('1. O backend está rodando');
      console.log('2. A Evolution API consegue acessar a URL do webhook');
      console.log('3. Não há firewall bloqueando a conexão');
      console.log('4. A URL no WEBHOOK_BASE_URL está correta no .env');
    }
    
  } catch (error: any) {
    console.error('\n❌ Erro ao configurar webhook:');
    console.error(error.response?.data || error.message);
    console.error('\nDetalhes do erro:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
    });
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const instanceName = process.argv[2] || 'bbnb';
  const webhookUrl = process.argv[3];
  
  setupWebhook({ instanceName, webhookUrl })
    .then(() => {
      console.log('\n✅ Configuração concluída com sucesso!\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Erro na configuração:', error.message);
      process.exit(1);
    });
}

export default setupWebhook;
