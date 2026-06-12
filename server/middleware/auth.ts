import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import prisma from '../lib/prisma';
import { AuthUser } from '../types/express';

export const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  tenant_id: true,
  active: true,
  account_locked: true,
  locked_until: true,
  two_factor_enabled: true,
  tenant: { select: { slug: true, name: true } },
} as const;

export function rowToAuthUser(row: {
  id: number;
  name: string;
  email: string;
  role: string;
  tenant_id: number | null;
  active: boolean;
  tenant: { slug: string; name: string } | null;
}): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    tenant_id: row.tenant_id,
    active: row.active,
    tenant_slug: row.tenant?.slug ?? null,
    tenant_name: row.tenant?.name ?? null,
  };
}

/**
 * Middleware de autenticação
 * Suporta tanto cookies (preferencial) quanto Authorization header (backward compatibility)
 */
export default async function auth(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;

  // Prioridade 1: Cookie (httpOnly, mais seguro)
  token = req.cookies?.access_token;

  // Prioridade 2: Authorization header (backward compatibility)
  if (!token) {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      token = header.slice(7);
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub?: number; id?: number; type?: string };
    const userId = payload.sub ?? payload.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Verificar se é um access token
    if (payload.type && payload.type !== 'access') {
      return res.status(401).json({ error: 'Tipo de token inválido' });
    }

    const row = await prisma.user.findUnique({ where: { id: Number(userId) }, select: USER_SELECT });
    
    if (!row || !row.active) {
      return res.status(401).json({ error: 'Usuário inválido ou inativo' });
    }

    // Verificar se a conta está bloqueada
    if (row.account_locked || (row.locked_until && new Date(row.locked_until) > new Date())) {
      return res.status(403).json({ error: 'Conta bloqueada' });
    }

    if (row.role !== 'super_admin' && !row.tenant_id) {
      return res.status(401).json({ error: 'Usuário sem organização vinculada' });
    }

    req.user = rowToAuthUser(row);
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}
