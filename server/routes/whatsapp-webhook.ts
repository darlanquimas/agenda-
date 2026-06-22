import prisma from '../lib/prisma';
import { Router } from 'express';
import logger from '../lib/logger';
import * as evoManagerService from '../services/evoManagerService';
import { webhookAuth } from '../middleware/webhookAuth';
import {
  maskPhone,
  isValidPhoneFormat,
  sanitizeForLog,
} from '../lib/securityUtils';

const router = Router();

async function logSecurityEvent(eventType: string, req: any, details: any): Promise<void> {
  try {
    await prisma.securityLog.create({
      data: {
        event_type: eventType,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details: JSON.stringify(sanitizeForLog(details)),
      },
    });
  } catch (error: any) {
    logger.error('[SecurityLog] Erro ao registrar evento', { error: error.message, eventType });
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

async function reply(tenantId: number, instanceName: string, phone: string, message: string): Promise<void> {
  const whatsappConfig = await prisma.whatsAppConfig.findUnique({ where: { tenant_id: tenantId } });
  if (!whatsappConfig?.evo_client_id || !whatsappConfig?.evo_api_key) return;

  await evoManagerService.sendText(whatsappConfig.evo_client_id, whatsappConfig.evo_api_key, instanceName, phone, message);
}

// Endpoint de teste para verificar se o webhook está acessível
router.get('/:tenantId/test', (req, res) => {
  logger.info('[WhatsAppWebhook] Teste de conectividade recebido', {
    tenantId: req.params.tenantId,
    ip: req.ip,
  });

  res.json({ status: 'ok', message: 'Webhook está acessível e funcionando!', timestamp: new Date().toISOString() });
});

// Webhook para receber mensagens do Evo Manager Plus
router.post('/:tenantId', webhookAuth, async (req, res) => {
  const tenantId = Number(req.params.tenantId);
  const payload = req.body;

  try {
    logger.info('[WhatsAppWebhook] Evento recebido', { tenantId, event: payload.event });

    if (payload.event !== 'message.received' || payload.message?.type !== 'text') {
      return res.json({ success: true });
    }

    const phone = String(payload.phone ?? '');
    const instanceName = String(payload.instance ?? '');
    const text = String(payload.message?.text ?? '');

    if (!isValidPhoneFormat(phone)) {
      logger.warn('[WhatsAppWebhook] Telefone inválido', { tenantId });
      await logSecurityEvent('webhook_invalid_phone', req, { tenantId });
      return res.json({ success: true });
    }

    if (!text.trim()) {
      return res.json({ success: true });
    }

    logger.debug('[WhatsAppWebhook] Processando mensagem', {
      tenantId,
      from: maskPhone(phone),
      textLength: text.length,
    });

    // Buscar agendamento pendente do tenant pelo telefone
    // Comparação dígitos vs dígitos para tolerar qualquer formatação no banco
    const cleanIncoming = phone.replace(/\D/g, '');
    const last9 = cleanIncoming.slice(-9);

    const pendingAppointments = await prisma.appointment.findMany({
      where: { tenant_id: tenantId, status: 'pending' },
      orderBy: { scheduled_at: 'asc' },
      include: { service: true, professional: true },
    });

    const appointment = pendingAppointments.find((a) => {
      const cleanStored = (a.customer_phone ?? '').replace(/\D/g, '');
      return cleanStored.endsWith(last9);
    }) ?? null;

    if (!appointment) {
      logger.debug('[WhatsAppWebhook] Nenhum agendamento pendente para o telefone', { tenantId, from: maskPhone(phone) });
      return res.json({ success: true });
    }

    // Verificar se a mensagem é SIM ou NÃO
    const textUpper = text.toUpperCase().trim();
    const isConfirmation = textUpper.includes('SIM') || textUpper.includes('CONFIRMAR') || text.includes('✅');
    const isCancellation = textUpper.includes('NAO') || textUpper.includes('NÃO') || textUpper.includes('CANCELAR') || text.includes('❌');

    if (!isConfirmation && !isCancellation) {
      logger.debug('[WhatsAppWebhook] Resposta inválida, reenviando instruções', {
        tenantId,
        from: maskPhone(phone),
        appointmentId: appointment.id,
      });

      try {
        const reminderMsg =
          `⏰ *Confirmação de Agendamento Pendente*\n\n` +
          `📅 ${formatDate(appointment.scheduled_at)}\n` +
          `🕐 ${formatTime(appointment.scheduled_at)}\n` +
          (appointment.service?.name ? `📍 ${appointment.service.name}\n` : '') +
          (appointment.professional?.name ? `👤 ${appointment.professional.name}\n` : '') +
          `\nPor favor, responda *SIM* para confirmar ou *NÃO* para cancelar.`;
        await reply(tenantId, instanceName, phone, reminderMsg);
      } catch (err: any) {
        logger.error('[WhatsAppWebhook] Erro ao reenviar instruções', { error: err.message });
      }
      return res.json({ success: true });
    }

    logger.info('[WhatsAppWebhook] Processando confirmação via telefone', {
      tenantId,
      from: maskPhone(phone),
      appointmentId: appointment.id,
      isConfirmation,
      isCancellation,
    });

    // Verificar expiração do token de confirmação
    if (appointment.confirmation_token_expires_at && appointment.confirmation_token_expires_at < new Date()) {
      logger.warn('[WhatsAppWebhook] Token expirado', {
        appointmentId: appointment.id,
        expiresAt: appointment.confirmation_token_expires_at.toISOString(),
      });

      await logSecurityEvent('webhook_expired_token', req, {
        appointmentId: appointment.id,
        phone: maskPhone(phone),
        expiresAt: appointment.confirmation_token_expires_at.toISOString(),
      });

      try {
        await reply(tenantId, instanceName, phone, '❌ *Token Expirado*\n\nO código de confirmação expirou. Por favor, entre em contato conosco para reagendar.');
      } catch (error: any) {
        logger.error('[WhatsAppWebhook] Erro ao enviar mensagem de expiração', { error: error.message });
      }

      return res.json({ success: true });
    }

    const newStatus = isConfirmation ? 'scheduled' : 'cancelled';
    const responseMessage = isConfirmation
      ? `✅ *Agendamento Confirmado!*\n\nSeu agendamento foi confirmado com sucesso.\n\n📅 ${formatDate(appointment.scheduled_at)}\n🕐 ${formatTime(appointment.scheduled_at)}\n📍 ${appointment.service?.name}\n👤 ${appointment.professional?.name}\n\nNos vemos em breve! 🎉`
      : `❌ *Agendamento Cancelado*\n\nSeu agendamento foi cancelado.\nSe precisar reagendar, entre em contato conosco.`;

    await prisma.appointment.update({ where: { id: appointment.id }, data: { status: newStatus } });

    await prisma.activityLog.create({
      data: {
        tenant_id: appointment.tenant_id,
        action: 'update',
        entity: 'appointment',
        entity_id: appointment.id,
        details: `Status alterado para ${newStatus} via WhatsApp (telefone: ${maskPhone(phone)})`,
      },
    });

    await logSecurityEvent('webhook_confirmation_success', req, {
      appointmentId: appointment.id,
      phone: maskPhone(phone),
      action: isConfirmation ? 'confirm' : 'cancel',
      newStatus,
    });

    logger.info('[WhatsAppWebhook] Agendamento atualizado com sucesso', {
      appointmentId: appointment.id,
      oldStatus: 'pending',
      newStatus,
      phone: maskPhone(phone),
    });

    try {
      await reply(tenantId, instanceName, phone, responseMessage);
      logger.info('[WhatsAppWebhook] Mensagem de resposta enviada', { appointmentId: appointment.id, from: maskPhone(phone) });
    } catch (error: any) {
      logger.error('[WhatsAppWebhook] Erro ao enviar mensagem de resposta', { error: error.message, appointmentId: appointment.id });
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[WhatsAppWebhook] Erro ao processar webhook', { error: error.message, stack: error.stack });

    await logSecurityEvent('webhook_error', req, { error: error.message }).catch(() => {});

    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
