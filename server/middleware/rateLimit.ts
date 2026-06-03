import rateLimit from 'express-rate-limit';
import config from '../config';

const baseOptions = {
  windowMs: config.rateLimitWindowMs,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente mais tarde.' },
};

export const loginLimiter = rateLimit({ ...baseOptions, max: config.rateLimitMaxLogin });
export const bookingLimiter = rateLimit({ ...baseOptions, max: config.rateLimitMaxBooking });
export const apiLimiter = rateLimit({ ...baseOptions, max: config.rateLimitMaxApi });
