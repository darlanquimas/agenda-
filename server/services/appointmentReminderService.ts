import cron from 'node-cron';
import prisma from '../lib/prisma';
import * as evoManagerService from './evoManagerService';
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

  private async resolveInstance(tenantId: number, defaultInstanceId: number | null) {
    let instance = null;
    if (defaultInstanceId) {
      instance = await prisma.whatsAppInstance.findFirst({
        where: { id: defaultInstanceId, tenant_id: tenantId, status: 'open' },
      });
    }
    if (!instance) {
      instance = await prisma.whatsAppInstance.findFirst({
        where: { tenant_id: tenantId, status: 'open' },
        orderBy: { connected_at: 'desc' },
      });
    }
    return instance;
  }

  /**
   * Verifica agendamentos pendentes:
   * - Cancela e notifica os que estão a 1h ou menos do horário sem confirmação
   * - Envia lembrete para os demais criados há mais de 20 minutos
   */
  private async checkPendingAppointments(): Promise<void> {
    if (this.isRunning) {
      logger.debug('[ReminderService] Verificação já em execução, pulando...');
      return;
    }

    this.isRunning = true;

    try {
      const now = new Date();
      const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      const pendingAppointments = await prisma.appointment.findMany({
        where: { status: 'pending' },
        include: {
          tenant: { include: { whatsapp_config: true } },
          service: true,
          professional: true,
        },
        take: 50,
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
          const isWithinOneHour = appointment.scheduled_at <= oneHourFromNow;
          const isOldEnoughForReminder = appointment.created_at <= twentyMinutesAgo;

          if (isWithinOneHour) {
            // Cancelar automaticamente por não confirmação
            await prisma.appointment.update({
              where: { id: appointment.id },
              data: { status: 'cancelled' },
            });

            logger.info('[ReminderService] Agendamento cancelado por não confirmação', {
              appointmentId: appointment.id,
              tenantId: appointment.tenant_id,
              scheduledAt: appointment.scheduled_at,
            });

            if (config?.send_confirmation && appointment.customer_phone && config.evo_client_id && config.evo_api_key) {
              const instance = await this.resolveInstance(appointment.tenant_id, config.default_instance_id);
              if (instance) {
                const msg = `❌ *Agendamento Cancelado*\n\nOlá ${appointment.customer_name}!\n\nSeu agendamento não foi confirmado e foi cancelado automaticamente pois faltava menos de 1 hora para o horário marcado.\n\n📅 Data: ${this.formatDate(appointment.scheduled_at)}\n🕐 Horário: ${this.formatTime(appointment.scheduled_at)}\n📍 Serviço: ${appointment.service?.name || 'Não especificado'}\n\nSe desejar reagendar, entre em contato conosco.`;
                await evoManagerService.sendText(
                  config.evo_client_id,
                  config.evo_api_key,
                  instance.instance_name,
                  appointment.customer_phone,
                  msg
                );
                logger.info('[ReminderService] Notificação de cancelamento automático enviada', {
                  appointmentId: appointment.id,
                });
              }
            }
          } else if (isOldEnoughForReminder) {
            // Enviar lembrete de confirmação
            if (!config?.send_confirmation || !appointment.customer_phone) continue;
            if (!config.evo_client_id || !config.evo_api_key) continue;

            const instance = await this.resolveInstance(appointment.tenant_id, config.default_instance_id);
            if (!instance) {
              logger.warn('[ReminderService] Nenhuma instância conectada', {
                tenantId: appointment.tenant_id,
                appointmentId: appointment.id,
              });
              continue;
            }

            const message = `🔔 *Lembrete de Confirmação*\n\nOlá ${appointment.customer_name}!\n\nNotamos que você ainda não confirmou seu agendamento:\n\n📅 Data: ${this.formatDate(appointment.scheduled_at)}\n🕐 Horário: ${this.formatTime(appointment.scheduled_at)}\n📍 Serviço: ${appointment.service?.name || 'Não especificado'}\n👤 Profissional: ${appointment.professional?.name || 'Não especificado'}\n\n⚠️ *Por favor, confirme seu agendamento:*\nResponda esta mensagem com:\n✅ *SIM* - para confirmar\n❌ *NÃO* - para cancelar`;

            await evoManagerService.sendText(
              config.evo_client_id,
              config.evo_api_key,
              instance.instance_name,
              appointment.customer_phone,
              message
            );

            logger.info('[ReminderService] Lembrete enviado', {
              appointmentId: appointment.id,
              tenantId: appointment.tenant_id,
            });
          }

          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error: any) {
          logger.error('[ReminderService] Erro ao processar agendamento pendente', {
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
