import { Request, Response, NextFunction } from 'express';

export default function requireTenantAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user.role !== 'admin' || !req.user.tenant_id) {
    return res.status(403).json({ error: 'Acesso restrito a administradores da organização' });
  }
  next();
}
