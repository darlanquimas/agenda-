import axios from 'axios';
import type { Axios } from 'axios';
import https from 'https';
import config from '../config';
import logger from '../lib/logger';

interface EvolutionApiConfig {
  baseURL: string;
  apiKey: string;
}

interface CreateInstanceRequest {
  instanceName: string;
  token?: string;
  qrcode?: boolean;
  number?: string;
  integration?: string;
}

interface InstanceInfo {
  instance: {
    instanceName: string;
    instanceId?: string;
    status: string;
  };
  qrcode?: {
    base64?: string;
    code?: string;
  };
}

interface ConnectionStatus {
  instance: {
    instanceName: string;
    state: string;
  };
}

export class EvolutionApiService {
  private client: Axios;

  constructor(config: EvolutionApiConfig) {
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      requestCert: false,
      keepAlive: true,
    });

    this.client = axios.create({
      baseURL: config.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey,
      },
      timeout: 30000,
      httpsAgent: config.baseURL.startsWith('https') ? httpsAgent : undefined,
      validateStatus: (status) => status < 600,
    });

    logger.info('[EvolutionAPI] Cliente configurado', {
      baseURL: config.baseURL,
      hasApiKey: !!config.apiKey,
      apiKeyPrefix: config.apiKey ? config.apiKey.substring(0, 8) + '...' : 'N/A',
    });
  }

  async createInstance(data: CreateInstanceRequest): Promise<InstanceInfo> {
    try {
      logger.info(`[EvolutionAPI] Criando instância: ${data.instanceName}`);
      const payload: any = {
        instanceName: data.instanceName,
        qrcode: data.qrcode ?? true,
        integration: data.integration || 'WHATSAPP-BAILEYS',
      };
      
      if (data.token) payload.token = data.token;
      if (data.number) payload.number = data.number;
      
      logger.info('[EvolutionAPI] Payload da criação', { payload });
      
      const response = await this.client.post('/instance/create', payload);
      
      logger.info('[EvolutionAPI] Resposta completa do createInstance', {
        status: response.status,
        data: JSON.stringify(response.data),
        hasInstance: !!response.data?.instance,
        hasQrcode: !!response.data?.qrcode,
        qrcodeKeys: response.data?.qrcode ? Object.keys(response.data.qrcode) : [],
      });
      
      logger.info(`[EvolutionAPI] Instância criada com sucesso: ${data.instanceName}`);
      return response.data;
    } catch (error: any) {
      const errorDetails = {
        instanceName: data.instanceName,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        code: error.code,
      };
      logger.error('[EvolutionAPI] Erro ao criar instância', errorDetails);
      
      const errorMessage = error.response?.data?.message 
        || error.response?.data?.error 
        || error.message 
        || 'Erro ao criar instância no WhatsApp';
      
      throw new Error(errorMessage);
    }
  }

  async fetchQrCode(instanceName: string): Promise<{ qrcode: { base64?: string; code?: string } }> {
    try {
      logger.info(`[EvolutionAPI] Buscando QR Code: ${instanceName}`);
      const response = await this.client.get(`/instance/connect/${instanceName}`);
      
      logger.info('[EvolutionAPI] Resposta completa do fetchQrCode', {
        status: response.status,
        data: JSON.stringify(response.data),
        hasQrcode: !!response.data?.qrcode,
        qrcodeKeys: response.data?.qrcode ? Object.keys(response.data.qrcode) : [],
      });
      
      return response.data;
    } catch (error: any) {
      logger.error('[EvolutionAPI] Erro ao buscar QR Code', {
        instanceName,
        status: error.response?.status,
        error: error.response?.data || error.message,
      });
      throw new Error(error.response?.data?.message || 'Erro ao buscar QR Code');
    }
  }

  async getConnectionStatus(instanceName: string): Promise<ConnectionStatus> {
    try {
      logger.info(`[EvolutionAPI] Consultando status: ${instanceName}`);
      const response = await this.client.get(`/instance/connectionState/${instanceName}`);
      return response.data;
    } catch (error: any) {
      logger.error('[EvolutionAPI] Erro ao consultar status', {
        instanceName,
        error: error.response?.data || error.message,
      });
      throw new Error(error.response?.data?.message || 'Erro ao consultar status da instância');
    }
  }

  async deleteInstance(instanceName: string): Promise<void> {
    try {
      logger.info(`[EvolutionAPI] Deletando instância: ${instanceName}`);
      await this.client.delete(`/instance/delete/${instanceName}`);
      logger.info(`[EvolutionAPI] Instância deletada com sucesso: ${instanceName}`);
    } catch (error: any) {
      logger.error('[EvolutionAPI] Erro ao deletar instância', {
        instanceName,
        error: error.response?.data || error.message,
      });
      throw new Error(error.response?.data?.message || 'Erro ao deletar instância do WhatsApp');
    }
  }

  async logoutInstance(instanceName: string): Promise<void> {
    try {
      logger.info(`[EvolutionAPI] Desconectando instância: ${instanceName}`);
      await this.client.delete(`/instance/logout/${instanceName}`);
      logger.info(`[EvolutionAPI] Instância desconectada com sucesso: ${instanceName}`);
    } catch (error: any) {
      logger.error('[EvolutionAPI] Erro ao desconectar instância', {
        instanceName,
        error: error.response?.data || error.message,
      });
      throw new Error(error.response?.data?.message || 'Erro ao desconectar instância do WhatsApp');
    }
  }

  async restartInstance(instanceName: string): Promise<void> {
    try {
      logger.info(`[EvolutionAPI] Reiniciando instância: ${instanceName}`);
      await this.client.put(`/instance/restart/${instanceName}`);
      logger.info(`[EvolutionAPI] Instância reiniciada com sucesso: ${instanceName}`);
    } catch (error: any) {
      logger.error('[EvolutionAPI] Erro ao reiniciar instância', {
        instanceName,
        error: error.response?.data || error.message,
      });
      throw new Error(error.response?.data?.message || 'Erro ao reiniciar instância do WhatsApp');
    }
  }

  async sendTextMessage(instanceName: string, phone: string, message: string): Promise<void> {
    try {
      logger.info(`[EvolutionAPI] Enviando mensagem via ${instanceName} para ${phone}`);
      
      // Formatar número: remover caracteres especiais
      let cleanPhone = phone.replace(/\D/g, '');
      
      // Adicionar código do país (55) se não tiver
      // Números brasileiros têm 10 ou 11 dígitos (sem código do país)
      if (cleanPhone.length === 10 || cleanPhone.length === 11) {
        cleanPhone = '55' + cleanPhone;
        logger.info(`[EvolutionAPI] Adicionado código do país: ${cleanPhone}`);
      }
      
      // Adicionar formato WhatsApp se não tiver
      const formattedPhone = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
      
      const payload = {
        number: formattedPhone,
        text: message,
      };
      
      logger.info(`[EvolutionAPI] Payload de envio:`, payload);
      
      const response = await this.client.post(`/message/sendText/${instanceName}`, payload);
      
      logger.info(`[EvolutionAPI] Resposta completa da API:`, {
        status: response.status,
        data: response.data,
        instanceName,
        phone: formattedPhone,
        messageLength: message.length,
      });
      
      // Verificar se a mensagem foi realmente enviada
      if (!response.data || !response.data.key) {
        logger.warn(`[EvolutionAPI] Resposta sem chave de mensagem - pode não ter sido enviada`, {
          response: response.data,
        });
      }
      
      return response.data;
    } catch (error: any) {
      logger.error('[EvolutionAPI] Erro ao enviar mensagem', {
        instanceName,
        phone,
        status: error.response?.status,
        statusText: error.response?.statusText,
        error: error.response?.data || error.message,
        stack: error.stack,
      });
      throw new Error(error.response?.data?.message || 'Erro ao enviar mensagem WhatsApp');
    }
  }

  async fetchAllInstancesFromAPI(): Promise<any[]> {
    try {
      logger.info('[EvolutionAPI] Buscando todas as instâncias da Evolution API');
      const response = await this.client.get('/instance/fetchInstances');
      const instances = response.data || [];
      logger.info(`[EvolutionAPI] Total de instâncias encontradas: ${instances.length}`);
      return instances;
    } catch (error: any) {
      logger.error('[EvolutionAPI] Erro ao buscar instâncias', {
        error: error.response?.data || error.message,
      });
      throw new Error(error.response?.data?.message || 'Erro ao buscar instâncias da Evolution API');
    }
  }

  async sendButtonsMessage(
    instanceName: string,
    phone: string,
    message: string,
    buttons: Array<{ buttonId: string; buttonText: { displayText: string } }>
  ): Promise<void> {
    try {
      logger.info(`[EvolutionAPI] Enviando mensagem com botões via ${instanceName} para ${phone}`);
      
      // Formatar número
      let cleanPhone = phone.replace(/\D/g, '');
      
      // Adicionar código do país (55) se não tiver
      if (cleanPhone.length === 10 || cleanPhone.length === 11) {
        cleanPhone = '55' + cleanPhone;
      }
      
      const formattedPhone = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
      
      // Formatar botões com o tipo correto para Evolution API
      const formattedButtons = buttons.map(btn => ({
        type: 'reply',
        buttonId: btn.buttonId,
        buttonText: {
          displayText: btn.buttonText.displayText,
        },
      }));
      
      const payload = {
        number: formattedPhone,
        title: 'Confirmação de Agendamento',
        description: message,
        footer: 'Sistema de Agendamentos',
        buttons: formattedButtons,
      };
      
      logger.info(`[EvolutionAPI] Payload de botões:`, payload);
      
      const response = await this.client.post(`/message/sendButtons/${instanceName}`, payload);
      
      logger.info(`[EvolutionAPI] Mensagem com botões enviada`, {
        status: response.status,
        instanceName,
        phone: formattedPhone,
      });
      
      return response.data;
    } catch (error: any) {
      // Se botões não funcionarem, tentar enviar texto simples
      logger.warn('[EvolutionAPI] Erro ao enviar com botões, tentando texto simples', {
        error: error.response?.data || error.message,
      });
      
      return this.sendTextMessage(instanceName, phone, message);
    }
  }

  async deleteAllInstances(): Promise<{ deleted: number; errors: string[] }> {
    try {
      logger.info('[EvolutionAPI] Iniciando limpeza de todas as instâncias');
      
      const instances = await this.fetchAllInstancesFromAPI();
      const errors: string[] = [];
      let deleted = 0;

      for (const instance of instances) {
        const instanceName = instance.instance?.instanceName || instance.instanceName;
        
        if (!instanceName) {
          logger.warn('[EvolutionAPI] Instância sem nome, pulando');
          continue;
        }

        try {
          await this.deleteInstance(instanceName);
          deleted++;
        } catch (error: any) {
          const errorMsg = `${instanceName}: ${error.message}`;
          errors.push(errorMsg);
          logger.error(`[EvolutionAPI] Erro ao deletar ${instanceName}`, {
            error: error.message,
          });
        }
      }

      logger.info('[EvolutionAPI] Limpeza concluída', {
        total: instances.length,
        deleted,
        errors: errors.length,
      });

      return { deleted, errors };
    } catch (error: any) {
      logger.error('[EvolutionAPI] Erro ao limpar instâncias', {
        error: error.message,
      });
      throw new Error('Erro ao limpar instâncias da Evolution API');
    }
  }
}

const evolutionApiService = new EvolutionApiService({
  baseURL: config.evolutionApiUrl,
  apiKey: config.evolutionApiKey,
});

export default evolutionApiService;
