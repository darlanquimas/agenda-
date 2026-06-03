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

export default async function auth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as { sub?: number; id?: number };
    const userId = payload.sub ?? payload.id;
    if (!userId) return res.status(401).json({ error: 'Token inválido' });

    const row = await prisma.user.findUnique({ where: { id: Number(userId) }, select: USER_SELECT });
    if (!row || !row.active) return res.status(401).json({ error: 'Usuário inválido ou inativo' });
    if (row.role !== 'super_admin' && !row.tenant_id) {
      return res.status(401).json({ error: 'Usuário sem organização vinculada' });
    }

    req.user = rowToAuthUser(row);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}
