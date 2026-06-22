import axios from 'axios';
import config from '../config';
import logger from '../lib/logger';

export interface ConnectedInstance {
  id: number;
  instance_name: string;
  phone_number: string | null;
  status: string;
}

export interface MeResponse {
  tenant: { id: number; name: string; slug: string; active: boolean };
  credential: { client_id: string; description: string };
  connected_instances: ConnectedInstance[];
}

function client(clientId: string, apiKey: string) {
  return axios.create({
    baseURL: config.evoManagerApiUrl,
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Id': clientId,
      'X-Api-Key': apiKey,
    },
    timeout: 30000,
    validateStatus: (status) => status < 600,
  });
}

/**
 * Valida as credenciais e retorna o tenant do Evo Manager com as instâncias conectadas.
 */
export async function getMe(clientId: string, apiKey: string): Promise<MeResponse> {
  const response = await client(clientId, apiKey).get<MeResponse & { error?: string }>('/me');

  if (response.status !== 200) {
    logger.warn('[EvoManager] Falha ao validar credenciais', {
      status: response.status,
      error: response.data?.error,
    });
    throw new Error(response.data?.error || 'Erro ao validar credenciais do Evo Manager');
  }

  return response.data;
}

/**
 * Envia uma mensagem de texto via instância conectada do tenant no Evo Manager.
 */
export async function sendText(
  clientId: string,
  apiKey: string,
  instance: string,
  phone: string,
  message: string,
): Promise<void> {
  const cleanPhone = phone.replace(/\D/g, '');

  const response = await client(clientId, apiKey).post<{ error?: string }>('/messages/text', {
    instance,
    phone: cleanPhone,
    message,
  });

  if (response.status !== 201) {
    logger.error('[EvoManager] Erro ao enviar mensagem', {
      instance,
      status: response.status,
      error: response.data?.error,
    });
    throw new Error(response.data?.error || 'Erro ao enviar mensagem WhatsApp');
  }

  logger.info('[EvoManager] Mensagem enviada', { instance, phone: cleanPhone });
}
