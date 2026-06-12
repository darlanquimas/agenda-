import prisma from '../lib/prisma';
import { Router } from 'express';
import logger from '../lib/logger';
import config from '../config';
import evolutionApiService from '../services/evolutionApiService';

const router = Router();

// Funções auxiliares para formatação
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// Endpoint de teste para verificar se o webhook está acessível
router.get('/test', (req, res) => {
  logger.info('[WhatsAppWebhook] Teste de conectividade recebido', {
    ip: req.ip,
    headers: req.headers,
  });
  
  res.json({
    status: 'ok',
    message: 'Webhook está acessível e funcionando!',
    timestamp: new Date().toISOString(),
    webhookUrl: `${config.webhookBaseUrl}/webhook/whatsapp/:instanceName`,
  });
});

// Webhook para receber mensagens do WhatsApp
router.post('/:instanceName', async (req, res) => {
  const { instanceName } = req.params;
  const payload = req.body;

  try {
    logger.info('[WhatsAppWebhook] Mensagem recebida', {
      instanceName,
      event: payload.event,
      from: payload.data?.key?.remoteJid,
    });

    // Processar apenas mensagens de texto recebidas
    if (payload.event === 'messages.upsert' && payload.data?.message) {
      const message = payload.data;
      const from = message.key?.remoteJid;
      const text = message.message?.conversation || 
                   message.message?.extendedTextMessage?.text ||
                   message.message?.buttonsResponseMessage?.selectedDisplayText ||
                   '';

      // Extrair número de telefone
      const phone = from?.replace('@s.whatsapp.net', '').replace(/\D/g, '');

      logger.info('[WhatsAppWebhook] Processando mensagem', {
        from: phone,
        text,
        messageType: Object.keys(message.message || {})[0],
      });

      // Verificar se é uma resposta de confirmação
      const textUpper = text.toUpperCase().trim();
      
      // Verificar se é uma resposta válida (SIM, NÃO, CONFIRMAR, CANCELAR)
      const isConfirmation = textUpper.includes('SIM') || textUpper.includes('CONFIRMAR') || text.includes('✅');
      const isCancellation = textUpper.includes('NAO') || textUpper.includes('NÃO') || textUpper.includes('CANCELAR') || text.includes('❌');
      
      if (!isConfirmation && !isCancellation) {
        logger.info('[WhatsAppWebhook] Mensagem não é uma confirmação', { phone, text });
        return res.json({ success: true, message: 'Not a confirmation message' });
      }
      
      logger.info('[WhatsAppWebhook] Processando confirmação', {
        phone,
        isConfirmation,
        isCancellation,
      });
      
      // Buscar o agendamento pendente mais recente deste telefone
      const appointment = await prisma.appointment.findFirst({
        where: {
          customer_phone: {
            contains: phone?.slice(-9) || '', // Últimos 9 dígitos
          },
          status: 'pending',
        },
        include: {
          tenant: true,
          service: true,
          professional: true,
        },
        orderBy: {
          created_at: 'desc', // Mais recente primeiro
        },
      });

      if (!appointment) {
        logger.warn('[WhatsAppWebhook] Nenhum agendamento pendente encontrado', { 
          phone,
        });
        return res.json({ success: true, message: 'No pending appointment found' });
      }

      // Processar resposta baseado nas palavras-chave
      let newStatus: string | null = null;
      let responseMessage = '';

      if (isConfirmation) {
        newStatus = 'scheduled';
        responseMessage = `✅ *Agendamento Confirmado!*\n\nSeu agendamento foi confirmado com sucesso.\n\n📅 ${formatDate(appointment.scheduled_at)}\n🕐 ${formatTime(appointment.scheduled_at)}\n📍 ${appointment.service?.name}\n👤 ${appointment.professional?.name}\n\nNos vemos em breve! 🎉`;
      } else if (isCancellation) {
        newStatus = 'cancelled';
        responseMessage = `❌ *Agendamento Cancelado*\n\nSeu agendamento foi cancelado.\nSe precisar reagendar, entre em contato conosco.`;
      }

      if (newStatus) {
        // Atualizar status do agendamento
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { status: newStatus },
        });

        // Registrar atividade
        await prisma.activityLog.create({
          data: {
            tenant_id: appointment.tenant_id,
            action: 'update',
            entity: 'appointment',
            entity_id: appointment.id,
            details: `Status alterado para ${newStatus} via WhatsApp`,
          },
        });

        logger.info('[WhatsAppWebhook] Agendamento atualizado', {
          appointmentId: appointment.id,
          oldStatus: 'pending',
          newStatus,
          phone,
        });

        // Enviar mensagem de resposta ao cliente
        try {
          // Buscar instância do WhatsApp
          const whatsappConfig = await prisma.whatsAppConfig.findUnique({
            where: { tenant_id: appointment.tenant_id },
          });

          let instance = null;
          
          if (whatsappConfig?.default_instance_id) {
            instance = await prisma.whatsAppInstance.findFirst({
              where: {
                id: whatsappConfig.default_instance_id,
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

          if (instance) {
            await evolutionApiService.sendTextMessage(
              instance.instance_name,
              appointment.customer_phone,
              responseMessage
            );
            
            logger.info('[WhatsAppWebhook] Mensagem de resposta enviada', {
              appointmentId: appointment.id,
              phone,
            });
          }
        } catch (error: any) {
          logger.error('[WhatsAppWebhook] Erro ao enviar mensagem de resposta', {
            error: error.message,
          });
          // Não lançar erro para não quebrar o fluxo
        }
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[WhatsAppWebhook] Erro ao processar webhook', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
