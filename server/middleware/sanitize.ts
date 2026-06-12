import { Request, Response, NextFunction } from 'express';
import { sanitizeObject } from '../lib/sanitizer';

/**
 * Middleware para sanitizar automaticamente req.body, req.query e req.params
 * Previne ataques XSS removendo conteúdo perigoso
 */
export function sanitizeMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query as Record<string, any>);
  }

  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }

  next();
}
