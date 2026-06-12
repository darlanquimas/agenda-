import rateLimit from 'express-rate-limit';
import config from '../config';

// TODO: antes de escalar para múltiplos processos/workers, trocar o store padrão (memória)
// por um Redis store (ex: rate-limit-redis). Hoje os contadores são independentes por processo.

const baseOptions = {
  windowMs: config.rateLimitWindowMs,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente mais tarde.' },
};

export const loginLimiter = rateLimit({ ...baseOptions, max: config.rateLimitMaxLogin });
export const bookingLimiter = rateLimit({ ...baseOptions, max: config.rateLimitMaxBooking });
export const apiLimiter = rateLimit({ ...baseOptions, max: config.rateLimitMaxApi });
export const twoFactorLimiter = rateLimit({ ...baseOptions, max: 10 });
