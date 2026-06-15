import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import config from '../config';
import logger from '../lib/logger';

/**
 * Middleware de autenticação para webhooks
 * Valida API Key e assinatura HMAC
 */
export function webhookAuth(req: Request, res: Response, next: NextFunction): void {
  const webhookSecret = config.webhookSecret;

  if (!webhookSecret) {
    logger.error('[WebhookAuth] WEBHOOK_SECRET não configurado');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  // 1. Validar API Key no header
  const apiKey = req.headers['x-api-key'] as string | undefined;
  
  if (!apiKey) {
    logger.warn('[WebhookAuth] API Key não fornecida', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.path,
    });
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Comparação segura (timing-safe)
  const isValidApiKey = crypto.timingSafeEqual(
    Buffer.from(apiKey),
    Buffer.from(webhookSecret)
  );

  if (!isValidApiKey) {
    logger.warn('[WebhookAuth] API Key inválida', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.path,
      providedKeyLength: apiKey.length,
    });
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // 2. Validar assinatura HMAC (opcional, se Evolution API suportar)
  const signature = req.headers['x-evolution-signature'] as string | undefined;
  
  if (signature) {
    const rawBody = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');
    
    const isValidSignature = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValidSignature) {
      logger.warn('[WebhookAuth] Assinatura HMAC inválida', {
        ip: req.ip,
        path: req.path,
      });
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
  }

  logger.debug('[WebhookAuth] Autenticação bem-sucedida', {
    ip: req.ip,
    path: req.path,
  });

  next();
}
