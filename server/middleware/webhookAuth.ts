import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import config from '../config';
import logger from '../lib/logger';

function safeEqual(a: string, b: string): boolean {
  try {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Middleware de autenticação para webhooks da Evolution API.
 *
 * Aceita duas formas de autenticação (em ordem de preferência):
 * 1. Header x-api-key com o WEBHOOK_SECRET (configurado via webhook setup)
 * 2. Campo apikey no corpo da requisição com o EVOLUTION_API_KEY
 *    (enviado nativamente pela Evolution API em todas as chamadas)
 */
export function webhookAuth(req: Request, res: Response, next: NextFunction): void {
  // Método 1: header x-api-key com nosso WEBHOOK_SECRET
  const headerKey = req.headers['x-api-key'] as string | undefined;
  if (headerKey && config.webhookSecret) {
    if (safeEqual(headerKey, config.webhookSecret)) {
      logger.debug('[WebhookAuth] Autenticado via header x-api-key', { ip: req.ip });
      next();
      return;
    }
    logger.warn('[WebhookAuth] Header x-api-key inválido', { ip: req.ip, path: req.path });
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Método 2: campo apikey no body enviado nativamente pela Evolution API
  // Compara contra evolutionApiKey OU webhookSecret (ambos são candidatos válidos)
  const bodyApiKey = req.body?.apikey as string | undefined;
  if (bodyApiKey) {
    const matchesEvolutionKey = config.evolutionApiKey && safeEqual(bodyApiKey, config.evolutionApiKey);
    const matchesWebhookSecret = config.webhookSecret && safeEqual(bodyApiKey, config.webhookSecret);
    if (matchesEvolutionKey || matchesWebhookSecret) {
      logger.debug('[WebhookAuth] Autenticado via apikey no body', { ip: req.ip });
      next();
      return;
    }
    logger.warn('[WebhookAuth] apikey no body inválido', { ip: req.ip, path: req.path });
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  logger.warn('[WebhookAuth] Nenhuma credencial fornecida', {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    path: req.path,
  });
  res.status(401).json({ error: 'Unauthorized' });
}
