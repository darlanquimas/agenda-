import prisma from '../lib/prisma';
import { createRouter } from '../lib/router';
import { tenantFilter } from '../lib/tenantScope';
import { parseId } from '../lib/validate';

const router = createRouter();

router.get('/', async (req, res) => {
  const tf = tenantFilter(req.user);
  const rows = await prisma.service.findMany({
    where: tf,
    orderBy: { name: 'asc' },
    include: { specialties: { select: { specialty_id: true } } },
  });
  res.json(rows.map((s) => ({ ...s, specialty_ids: s.specialties.map((ss) => ss.specialty_id), specialties: undefined })));
});

router.post('/', async (req, res) => {
  const { name, description, duration_minutes = 60, price = 0, specialty_ids = [] } = req.body as Record<string, string | number | number[]>;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
  const tenantId = req.user.tenant_id;
  if (!tenantId) return res.status(403).json({ error: 'Operação não disponível para super admin nesta tela' });

  const r = await prisma.service.create({
    data: {
      tenant_id: tenantId,
      name: String(name),
      description: description ? String(description) : null,
      duration_minutes: Number(duration_minutes),
      price: Number(price),
    },
  });

  const ids = Array.isArray(specialty_ids) ? specialty_ids as number[] : [];
  if (ids.length) {
    await prisma.specialtyService.createMany({
      data: ids.map((specialty_id) => ({ specialty_id, service_id: r.id })),
      skipDuplicates: true,
    });
  }

  res.status(201).json({ ...r, specialty_ids: ids });
});

router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id, 'Serviço');
  const tf = tenantFilter(req.user);
  const s = await prisma.service.findFirst({ where: { id, ...tf } });
  if (!s) return res.status(404).json({ error: 'Serviço não encontrado' });

  const { name, description, duration_minutes, price, active, specialty_ids } = req.body as Record<string, string | number | boolean | number[]>;
  await prisma.service.update({
    where: { id: s.id },
    data: {
      name: (name as string) ?? s.name,
      description: description !== undefined ? (description as string) : s.description,
      duration_minutes: duration_minutes !== undefined ? Number(duration_minutes) : s.duration_minutes,
      price: price !== undefined ? Number(price) : s.price,
      active: active !== undefined ? Boolean(active) : s.active,
    },
  });

  if (specialty_ids !== undefined) {
    const ids = Array.isArray(specialty_ids) ? specialty_ids as number[] : [];
    await prisma.specialtyService.deleteMany({ where: { service_id: s.id } });
    if (ids.length) {
      await prisma.specialtyService.createMany({
        data: ids.map((specialty_id) => ({ specialty_id, service_id: s.id })),
        skipDuplicates: true,
      });
    }
  }

  res.json({ message: 'Atualizado' });
});

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id, 'Serviço');
  const tf = tenantFilter(req.user);
  const s = await prisma.service.findFirst({ where: { id, ...tf } });
  if (!s) return res.status(404).json({ error: 'Serviço não encontrado' });

  await prisma.service.update({ where: { id: s.id }, data: { active: false } });
  res.json({ message: 'Serviço desativado' });
});

export default router;
