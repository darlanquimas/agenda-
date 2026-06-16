import prisma from '../lib/prisma';
import { createRouter } from '../lib/router';
import requireTenantAdmin from '../middleware/requireTenantAdmin';
import * as usersService from '../services/usersService';

const router = createRouter();

router.get('/', requireTenantAdmin, async (req, res) => {
  res.json(await usersService.listUsers({ tenantId: req.user.tenant_id! }));
});

router.post('/', requireTenantAdmin, async (req, res) => {
  try {
    const { name, email, password, active = true, professional_id } = req.body;
    const tenantId = req.user.tenant_id!;
    const proId = professional_id != null ? Number(professional_id) : null;

    if (proId !== null) {
      const pro = await prisma.professional.findFirst({ where: { id: proId, tenant_id: tenantId } });
      if (!pro) return res.status(400).json({ error: 'Profissional não encontrado' });
      const existing = await prisma.user.findFirst({ where: { professional_id: proId } });
      if (existing) return res.status(400).json({ error: 'Profissional já possui usuário vinculado' });
    }

    const user = await usersService.createUser({
      name, email, password, tenant_id: tenantId, active,
      role: proId !== null ? 'professional' : 'admin',
      professional_id: proId,
    });
    res.status(201).json(user);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.put('/:id', requireTenantAdmin, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { professional_id, ...rest } = req.body;

    const user = await usersService.updateUser(req.params.id, rest, {
      scopeTenantId: tenantId,
      allowTenantChange: false,
    });

    if ('professional_id' in req.body) {
      const proId = professional_id != null ? Number(professional_id) : null;
      if (proId !== null) {
        const pro = await prisma.professional.findFirst({ where: { id: proId, tenant_id: tenantId! } });
        if (!pro) return res.status(400).json({ error: 'Profissional não encontrado' });
        await prisma.user.updateMany({
          where: { professional_id: proId, id: { not: Number(req.params.id) } },
          data: { professional_id: null },
        });
      }
      await prisma.user.update({
        where: { id: Number(req.params.id) },
        data: { professional_id: proId, ...(proId !== null ? { role: 'professional' } : {}) },
      });
    }

    res.json(user);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
