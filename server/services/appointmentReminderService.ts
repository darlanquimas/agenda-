import cron from 'node-cron';
import prisma from '../lib/prisma';
import evolutionApiService from './evolutionApiService';
import logger from '../lib/logger';

export class AppointmentReminderService {
  private isRunning = false;

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
   * Verifica e envia lembretes para agendamentos pendentes
   */
  private async checkPendingAppointments(): Promise<void> {
    if (this.isRunning) {
      logger.debug('[ReminderService] Verificação já em execução, pulando...');
      return;
    }

    this.isRunning = true;
    
    try {
      // Buscar agendamentos pendentes há mais de 20 minutos
      const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
      
      const pendingAppointments = await prisma.appointment.findMany({
        where: {
          status: 'pending',
          created_at: {
            lte: twentyMinutesAgo,
          },
          // Verificar se já não foi enviado lembrete (podemos adicionar um campo reminder_sent_at se quiser)
        },
        include: {
          tenant: {
            include: {
              whatsapp_config: true,
            },
          },
          service: true,
          professional: true,
        },
        take: 50, // Limitar para não sobrecarregar
      });

      if (pendingAppointments.length === 0) {
        logger.debug('[ReminderService] Nenhum agendamento pendente encontrado');
        return;
      }

      logger.info('[ReminderService] Agendamentos pendentes encontrados', {
        count: pendingAppointments.length,
      });

      for (const appointment of pendingAppointments) {
        try {
          const config = appointment.tenant.whatsapp_config;
          
          if (!config || !config.send_confirmation) {
            continue;
          }

          // Buscar instância conectada
          let instance = null;
          
          if (config.default_instance_id) {
            instance = await prisma.whatsAppInstance.findFirst({
              where: {
                id: config.default_instance_id,
                tenant_id: appointment.tenant_id,
                status: 'open',
              },
            });
          }

          if (!instance) {
            instance = await prisma.whatsAppInstance.findFirst({
              where: {
                tenant_id: appointment.tenant_id,
                status: 'open',
              },
              orderBy: { connected_at: 'desc' },
            });
          }

          if (!instance) {
            logger.warn('[ReminderService] Nenhuma instância conectada', {
              tenantId: appointment.tenant_id,
              appointmentId: appointment.id,
            });
            continue;
          }

          // Montar mensagem de lembrete
          const message = `🔔 *Lembrete de Confirmação*\n\nOlá ${appointment.customer_name}!\n\nNotamos que você ainda não confirmou seu agendamento:\n\n📅 Data: ${this.formatDate(appointment.scheduled_at)}\n🕐 Horário: ${this.formatTime(appointment.scheduled_at)}\n📍 Serviço: ${appointment.service?.name || 'Não especificado'}\n👤 Profissional: ${appointment.professional?.name || 'Não especificado'}\n\n⚠️ *Por favor, confirme seu agendamento:*\nResponda esta mensagem com:\n✅ *SIM* - para confirmar\n❌ *NÃO* - para cancelar`;

          // Enviar lembrete
          await evolutionApiService.sendTextMessage(
            instance.instance_name,
            appointment.customer_phone,
            message
          );

          logger.info('[ReminderService] Lembrete enviado', {
            appointmentId: appointment.id,
            tenantId: appointment.tenant_id,
            clientPhone: appointment.customer_phone,
          });

          // Adicionar pequeno delay entre envios para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error: any) {
          logger.error('[ReminderService] Erro ao enviar lembrete', {
            appointmentId: appointment.id,
            error: error.message,
          });
        }
      }
    } catch (error: any) {
      logger.error('[ReminderService] Erro ao verificar agendamentos pendentes', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Inicia o serviço de lembretes
   * Executa a cada 5 minutos
   */
  start(): void {
    logger.info('[ReminderService] Iniciando serviço de lembretes automáticos');
    
    // Executar a cada 5 minutos
    cron.schedule('*/5 * * * *', () => {
      logger.debug('[ReminderService] Executando verificação de agendamentos pendentes');
      this.checkPendingAppointments();
    });

    logger.info('[ReminderService] Serviço iniciado - verificação a cada 5 minutos');
  }
}

const appointmentReminderService = new AppointmentReminderService();
export default appointmentReminderService;
