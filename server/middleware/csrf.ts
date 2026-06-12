import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import config from '../config';

export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';

const MUTATIONS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

export function setCsrfCookie(res: Response): void {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false, // JS precisa ler para enviar no header
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    domain: config.cookieDomain,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function csrfCheck(req: Request, res: Response, next: NextFunction): void {
  if (!config.enableCsrf || !MUTATIONS.has(req.method)) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;

  if (
    !cookieToken ||
    !headerToken ||
    cookieToken.length !== headerToken.length ||
    !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    res.status(403).json({ error: 'Token CSRF inválido' });
    return;
  }

  next();
}
