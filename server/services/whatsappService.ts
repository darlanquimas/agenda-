import prisma from '../lib/prisma';
import * as evoManagerService from './evoManagerService';
import logger from '../lib/logger';

interface AppointmentData {
  appointmentId: number;
  confirmationToken: string;
  clientName: string;
  clientPhone: string;
  date: Date;
  serviceName?: string;
  professionalName?: string;
}

export class WhatsAppService {
  /**
   * Formata a data para o formato brasileiro
   */
  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  /**
   * Formata a hora para o formato brasileiro
   */
  private formatTime(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  /**
   * Substitui variáveis no template da mensagem
   */
  private replaceVariables(template: string, data: AppointmentData): string {
    return template
      .replace(/\{\{cliente\}\}/g, data.clientName)
      .replace(/\{\{data\}\}/g, this.formatDate(data.date))
      .replace(/\{\{horario\}\}/g, this.formatTime(data.date))
      .replace(/\{\{servico\}\}/g, data.serviceName || 'Não especificado')
      .replace(/\{\{profissional\}\}/g, data.professionalName || 'Não especificado');
  }

  /**
   * Envia mensagem de confirmação de agendamento
   */
  async sendAppointmentConfirmation(
    tenantId: number, 
    appointmentData: AppointmentData, 
    isUpdate: boolean = false
  ): Promise<boolean> {
    try {
      // Buscar configuração do WhatsApp
      const config = await prisma.whatsAppConfig.findUnique({
        where: { tenant_id: tenantId },
      });

      // Se não houver configuração ou envio estiver desabilitado
      if (!config || !config.send_confirmation) {
        logger.info('[WhatsApp] Envio de confirmação desabilitado ou não configurado', {
          tenantId,
          hasConfig: !!config,
          sendEnabled: config?.send_confirmation,
        });
        return false;
      }

      // Buscar instância padrão ou primeira conectada
      let instance;
      
      if (config.default_instance_id) {
        instance = await prisma.whatsAppInstance.findFirst({
          where: {
            id: config.default_instance_id,
            tenant_id: tenantId,
            status: 'open',
          },
        });
      }

      // Se não encontrou pela padrão, pega a primeira conectada
      if (!instance) {
        instance = await prisma.whatsAppInstance.findFirst({
          where: {
            tenant_id: tenantId,
            status: 'open',
          },
          orderBy: { connected_at: 'desc' },
        });
      }

      if (!instance) {
        logger.warn('[WhatsApp] Nenhuma instância conectada encontrada', { tenantId });
        return false;
      }

      if (!config.evo_client_id || !config.evo_api_key) {
        logger.warn('[WhatsApp] Credenciais do Evo Manager não configuradas', { tenantId });
        return false;
      }

      // Substituir variáveis no template
      let message = this.replaceVariables(config.confirmation_message, appointmentData);
      
      // Se for atualização, adicionar aviso
      if (isUpdate) {
        message = `⚠️ *Alteração de Agendamento*\n\nOlá ${appointmentData.clientName}!\n\nSeu agendamento foi ALTERADO:\n\n📅 Nova Data: ${this.formatDate(appointmentData.date)}\n🕐 Novo Horário: ${this.formatTime(appointmentData.date)}\n📍 Serviço: ${appointmentData.serviceName || 'Não especificado'}\n👤 Profissional: ${appointmentData.professionalName || 'Não especificado'}\n\n📌 *Por favor, confirme a nova data:*\nResponda esta mensagem com:\n✅ *SIM* - para confirmar\n❌ *NÃO* - para cancelar`;
      } else {
        message += `\n\n📌 *Para confirmar seu agendamento, responda:*\n✅ *SIM* - para confirmar\n❌ *NÃO* - para cancelar`;
      }

      await evoManagerService.sendText(
        config.evo_client_id,
        config.evo_api_key,
        instance.instance_name,
        appointmentData.clientPhone,
        message
      );

      logger.info('[WhatsApp] Confirmação de agendamento enviada', {
        tenantId,
        appointmentId: appointmentData.appointmentId,
        instanceName: instance.instance_name,
        clientPhone: appointmentData.clientPhone,
      });

      return true;
    } catch (error: any) {
      logger.error('[WhatsApp] Erro ao enviar confirmação de agendamento', {
        tenantId,
        error: error.message,
        stack: error.stack,
      });
      // Não lançar erro para não quebrar o fluxo de agendamento
      return false;
    }
  }

  /**
   * Envia mensagem de cancelamento de agendamento
   */
  async sendAppointmentCancellation(
    tenantId: number,
    appointmentData: AppointmentData
  ): Promise<boolean> {
    try {
      const config = await prisma.whatsAppConfig.findUnique({
        where: { tenant_id: tenantId },
      });

      if (!config || !config.send_confirmation) {
        logger.info('[WhatsApp] Envio de cancelamento desabilitado ou não configurado', {
          tenantId,
          hasConfig: !!config,
          sendEnabled: config?.send_confirmation,
        });
        return false;
      }

      let instance;
      if (config.default_instance_id) {
        instance = await prisma.whatsAppInstance.findFirst({
          where: { id: config.default_instance_id, tenant_id: tenantId, status: 'open' },
        });
      }
      if (!instance) {
        instance = await prisma.whatsAppInstance.findFirst({
          where: { tenant_id: tenantId, status: 'open' },
          orderBy: { connected_at: 'desc' },
        });
      }

      if (!instance) {
        logger.warn('[WhatsApp] Nenhuma instância conectada encontrada', { tenantId });
        return false;
      }

      if (!config.evo_client_id || !config.evo_api_key) {
        logger.warn('[WhatsApp] Credenciais do Evo Manager não configuradas', { tenantId });
        return false;
      }

      const message = `❌ *Agendamento Cancelado*\n\nOlá ${appointmentData.clientName}!\n\nSeu agendamento foi CANCELADO:\n\n📅 Data: ${this.formatDate(appointmentData.date)}\n🕐 Horário: ${this.formatTime(appointmentData.date)}\n📍 Serviço: ${appointmentData.serviceName || 'Não especificado'}\n👤 Profissional: ${appointmentData.professionalName || 'Não especificado'}\n\nSe desejar reagendar, entre em contato conosco.`;

      await evoManagerService.sendText(
        config.evo_client_id,
        config.evo_api_key,
        instance.instance_name,
        appointmentData.clientPhone,
        message
      );

      logger.info('[WhatsApp] Cancelamento de agendamento enviado', {
        tenantId,
        appointmentId: appointmentData.appointmentId,
        instanceName: instance.instance_name,
        clientPhone: appointmentData.clientPhone,
      });

      return true;
    } catch (error: any) {
      logger.error('[WhatsApp] Erro ao enviar cancelamento de agendamento', {
        tenantId,
        error: error.message,
        stack: error.stack,
      });
      return false;
    }
  }
}

const whatsappService = new WhatsAppService();
export default whatsappService;
