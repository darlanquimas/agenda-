import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export default async function resolveTenant(req: Request, res: Response, next: NextFunction) {
  const slug = req.params.tenantSlug;
  if (!slug) return res.status(400).json({ error: 'Organização não informada' });

  const tenant = await prisma.tenant.findFirst({ where: { slug, active: true } });
  if (!tenant) return res.status(404).json({ error: 'Organização não encontrada' });

  req.tenant = tenant;
  req.tenantId = tenant.id;
  next();
}
