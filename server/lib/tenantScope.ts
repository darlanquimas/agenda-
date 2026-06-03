import { Request, Response, NextFunction } from 'express';
import { AuthUser } from '../types/express';
import prisma from './prisma';

export function isSuperAdmin(user: AuthUser): boolean {
  return user?.role === 'super_admin';
}

export function tenantFilter(user: AuthUser): { tenant_id?: number } {
  if (isSuperAdmin(user)) return {};
  if (!user?.tenant_id) return { tenant_id: -1 };
  return { tenant_id: user.tenant_id };
}

export function tenantIdForWrite(user: AuthUser, bodyTenantId?: number | null): number | null {
  if (isSuperAdmin(user)) {
    return bodyTenantId != null ? Number(bodyTenantId) : null;
  }
  return user.tenant_id;
}

export function canAccessRow(user: AuthUser, row: { tenant_id: number | null } | null): boolean {
  if (!row) return false;
  if (isSuperAdmin(user)) return true;
  return row.tenant_id === user.tenant_id;
}

export async function logActivity(
  req: Request,
  action: string,
  entity: string,
  entityId: number,
  details: string,
): Promise<void> {
  await prisma.activityLog.create({
    data: {
      tenant_id: req.user.tenant_id ?? null,
      user_id: req.user.id,
      action,
      entity,
      entity_id: entityId,
      details,
    },
  });
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!isSuperAdmin(req.user)) {
    res.status(403).json({ error: 'Acesso restrito a super administradores' });
    return;
  }
  next();
}
