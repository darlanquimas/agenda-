import prisma from '../lib/prisma';
import { createRouter } from '../lib/router';
import { tenantFilter } from '../lib/tenantScope';
import { parseId } from '../lib/validate';

const router = createRouter();

router.get('/', async (req, res) => {
  const tf = tenantFilter(req.user);
  res.json(await prisma.specialty.findMany({ where: tf, orderBy: { name: 'asc' } }));
});

router.post('/', async (req, res) => {
  const { name, description } = req.body as Record<string, string>;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
  const tenantId = req.user.tenant_id;
  if (!tenantId) return res.status(403).json({ error: 'Operação não disponível para super admin nesta tela' });

  try {
    const r = await prisma.specialty.create({ data: { tenant_id: tenantId, name, description } });
    res.status(201).json(r);
  } catch {
    res.status(409).json({ error: 'Especialidade já existe' });
  }
});

router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id, 'Especialidade');
  const tf = tenantFilter(req.user);
  const s = await prisma.specialty.findFirst({ where: { id, ...tf } });
  if (!s) return res.status(404).json({ error: 'Especialidade não encontrada' });

  const { name, description } = req.body as Record<string, string>;
  try {
    await prisma.specialty.update({ where: { id: s.id }, data: { name: name ?? s.name, description: description ?? s.description } });
    res.json({ message: 'Atualizado' });
  } catch {
    res.status(409).json({ error: 'Especialidade já existe' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id, 'Especialidade');
  const tf = tenantFilter(req.user);
  const s = await prisma.specialty.findFirst({ where: { id, ...tf } });
  if (!s) return res.status(404).json({ error: 'Especialidade não encontrada' });

  await prisma.specialty.delete({ where: { id: s.id } });
  res.json({ message: 'Excluído' });
});

export default router;
