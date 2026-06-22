import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

const MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60;

function safeEqual(a: string, b: string): boolean {
  try {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Middleware de autenticação para o webhook do Evo Manager Plus.
 *
 * Cada tenant tem seu próprio signing secret (whsec_..., cadastrado nas
 * configurações do WhatsApp). A assinatura é HMAC-SHA256 sobre
 * "{timestamp}.{corpo bruto da requisição}", conforme a documentação do gateway.
 * Por isso precisa rodar dentro da rota /:tenantId (não como app.use global) —
 * só ali req.params.tenantId já está disponível para buscar o secret certo.
 */
export async function webhookAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const tenantId = Number(req.params.tenantId);
  if (!tenantId || Number.isNaN(tenantId)) {
    res.status(404).json({ error: 'Não encontrado' });
    return;
  }

  const whatsappConfig = await prisma.whatsAppConfig.findUnique({ where: { tenant_id: tenantId } });
  if (!whatsappConfig?.webhook_signing_secret) {
    logger.warn('[WebhookAuth] Tenant sem webhook configurado', { tenantId, ip: req.ip });
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const timestampHeader = req.headers['x-webhook-timestamp'] as string | undefined;
  const signatureHeader = req.headers['x-webhook-signature'] as string | undefined;

  if (!timestampHeader || !signatureHeader) {
    logger.warn('[WebhookAuth] Headers de assinatura ausentes', { tenantId, ip: req.ip });
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const age = Math.abs(Date.now() / 1000 - Number(timestampHeader));
  if (!Number.isFinite(age) || age > MAX_TIMESTAMP_SKEW_SECONDS) {
    logger.warn('[WebhookAuth] Timestamp fora da janela aceita', { tenantId, ip: req.ip, age });
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const rawBody = req.rawBody ? req.rawBody.toString('utf8') : '';
  const expected = 'sha256=' + crypto
    .createHmac('sha256', whatsappConfig.webhook_signing_secret)
    .update(`${timestampHeader}.${rawBody}`)
    .digest('hex');

  if (!safeEqual(signatureHeader, expected)) {
    logger.warn('[WebhookAuth] Assinatura inválida', { tenantId, ip: req.ip });
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
