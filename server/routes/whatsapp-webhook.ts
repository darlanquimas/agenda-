import prisma from '../lib/prisma';
import { Router } from 'express';
import logger from '../lib/logger';
import config from '../config';
import evolutionApiService from '../services/evolutionApiService';
import { 
  maskPhone, 
  maskToken, 
  isValidWhatsAppOrigin, 
  extractPhoneFromJid,
  isValidTokenFormat,
  sanitizeForLog,
} from '../lib/securityUtils';

const router = Router();

/**
 * Registra evento de segurança suspeito
 */
async function logSecurityEvent(
  eventType: string,
  req: any,
  details: any
): Promise<void> {
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
    logger.error('[SecurityLog] Erro ao registrar evento', {
      error: error.message,
      eventType,
    });
  }
}

/**
 * Formata data no formato brasileiro
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Formata hora no formato brasileiro
 */
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
    headers: sanitizeForLog(req.headers),
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
    });

    // Processar apenas mensagens de texto recebidas
    if (payload.event === 'messages.upsert' && payload.data?.message) {
      const message = payload.data;
      const from = message.key?.remoteJid;

      // VALIDAÇÃO 1: Verificar origem da mensagem
      if (!isValidWhatsAppOrigin(from)) {
        logger.warn('[WhatsAppWebhook] Origem inválida detectada', {
          from: from || 'undefined',
        });
        
        await logSecurityEvent('webhook_invalid_origin', req, { from });
        
        // Resposta genérica (não expõe detalhes)
        return res.json({ success: true });
      }

      const phone = extractPhoneFromJid(from);
      
      if (!phone) {
        logger.warn('[WhatsAppWebhook] Não foi possível extrair telefone', { from });
        return res.json({ success: true });
      }

      const text = message.message?.conversation || 
                   message.message?.extendedTextMessage?.text ||
                   message.message?.buttonsResponseMessage?.selectedDisplayText ||
                   '';

      logger.debug('[WhatsAppWebhook] Processando mensagem', {
        from: maskPhone(phone),
        textLength: text.length,
        messageType: Object.keys(message.message || {})[0],
      });

      // VALIDAÇÃO 2: Verificar se é uma resposta de confirmação
      const textUpper = text.toUpperCase().trim();
      const isConfirmation = textUpper.includes('SIM') || textUpper.includes('CONFIRMAR') || text.includes('✅');
      const isCancellation = textUpper.includes('NAO') || textUpper.includes('NÃO') || textUpper.includes('CANCELAR') || text.includes('❌');
      
      if (!isConfirmation && !isCancellation) {
        logger.debug('[WhatsAppWebhook] Mensagem não é uma confirmação', { 
          from: maskPhone(phone),
        });
        return res.json({ success: true });
      }

      // VALIDAÇÃO 3: Extrair e validar token (OBRIGATÓRIO)
      const tokenMatch = text.match(/\b([A-Z0-9]{8})\b/i);
      
      if (!tokenMatch || !tokenMatch[1]) {
        logger.warn('[WhatsAppWebhook] Token não encontrado na mensagem', {
          from: maskPhone(phone),
          textLength: text.length,
        });
        
        await logSecurityEvent('webhook_missing_token', req, {
          phone: maskPhone(phone),
          textLength: text.length,
        });
        
        // Resposta genérica (não expõe que token está faltando)
        return res.json({ success: true });
      }

      const confirmationToken = tokenMatch[1].toUpperCase();

      // VALIDAÇÃO 4: Validar formato do token
      if (!isValidTokenFormat(confirmationToken)) {
        logger.warn('[WhatsAppWebhook] Formato de token inválido', {
          token: maskToken(confirmationToken),
          from: maskPhone(phone),
        });
        
        await logSecurityEvent('webhook_invalid_token_format', req, {
          token: maskToken(confirmationToken),
          phone: maskPhone(phone),
        });
        
        return res.json({ success: true });
      }

      logger.info('[WhatsAppWebhook] Processando confirmação', {
        token: maskToken(confirmationToken),
        from: maskPhone(phone),
        isConfirmation,
        isCancellation,
      });
      
      // VALIDAÇÃO 5: Buscar agendamento com DUPLA validação (token + telefone)
      const appointment = await prisma.appointment.findFirst({
        where: {
          confirmation_token: confirmationToken,  // ✅ TOKEN OBRIGATÓRIO
          customer_phone: {
            contains: phone.slice(-9), // Últimos 9 dígitos
          },
          status: 'pending',
        },
        include: {
          tenant: true,
          service: true,
          professional: true,
        },
      });

      if (!appointment) {
        logger.warn('[WhatsAppWebhook] Agendamento não encontrado ou já processado', { 
          token: maskToken(confirmationToken),
          from: maskPhone(phone),
        });
        
        await logSecurityEvent('webhook_invalid_token', req, {
          token: maskToken(confirmationToken),
          phone: maskPhone(phone),
          action: isConfirmation ? 'confirm' : 'cancel',
        });
        
        // Resposta genérica (não expõe detalhes)
        return res.json({ success: true });
      }

      // VALIDAÇÃO 6: Verificar expiração do token
      if (appointment.confirmation_token_expires_at) {
        const now = new Date();
        if (appointment.confirmation_token_expires_at < now) {
          logger.warn('[WhatsAppWebhook] Token expirado', {
            appointmentId: appointment.id,
            token: maskToken(confirmationToken),
            expiresAt: appointment.confirmation_token_expires_at.toISOString(),
          });
          
          await logSecurityEvent('webhook_expired_token', req, {
            appointmentId: appointment.id,
            token: maskToken(confirmationToken),
            phone: maskPhone(phone),
            expiresAt: appointment.confirmation_token_expires_at.toISOString(),
          });
          
          // Enviar mensagem ao cliente informando expiração
          try {
            const instance = await prisma.whatsAppInstance.findFirst({
              where: {
                tenant_id: appointment.tenant_id,
                status: 'open',
              },
              orderBy: { connected_at: 'desc' },
            });

            if (instance) {
              await evolutionApiService.sendTextMessage(
                instance.instance_name,
                appointment.customer_phone,
                '❌ *Token Expirado*\n\nO código de confirmação expirou. Por favor, entre em contato conosco para reagendar.'
              );
            }
          } catch (error: any) {
            logger.error('[WhatsAppWebhook] Erro ao enviar mensagem de expiração', {
              error: error.message,
            });
          }
          
          return res.json({ success: true });
        }
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
            details: `Status alterado para ${newStatus} via WhatsApp (token: ${maskToken(confirmationToken)})`,
          },
        });

        // Registrar evento de segurança (sucesso)
        await logSecurityEvent('webhook_confirmation_success', req, {
          appointmentId: appointment.id,
          token: maskToken(confirmationToken),
          phone: maskPhone(phone),
          action: isConfirmation ? 'confirm' : 'cancel',
          newStatus,
        });

        logger.info('[WhatsAppWebhook] Agendamento atualizado com sucesso', {
          appointmentId: appointment.id,
          oldStatus: 'pending',
          newStatus,
          token: maskToken(confirmationToken),
        });

        // Enviar mensagem de resposta ao cliente
        try {
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
              from: maskPhone(phone),
            });
          }
        } catch (error: any) {
          logger.error('[WhatsAppWebhook] Erro ao enviar mensagem de resposta', {
            error: error.message,
            appointmentId: appointment.id,
          });
          // Não lançar erro para não quebrar o fluxo
        }
      }
    }

    // Sempre retornar resposta genérica de sucesso
    res.json({ success: true });
  } catch (error: any) {
    logger.error('[WhatsAppWebhook] Erro ao processar webhook', {
      error: error.message,
      stack: error.stack,
    });
    
    // Registrar erro de segurança
    await logSecurityEvent('webhook_error', req, {
      error: error.message,
    }).catch(() => {
      // Ignorar erros no log de segurança
    });
    
    // Resposta genérica mesmo em caso de erro (não expõe detalhes)
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
