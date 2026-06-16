import prisma from '../lib/prisma';
import { createRouter } from '../lib/router';
import { tenantFilter, logActivity } from '../lib/tenantScope';
import { parseId, capLimit, isValidEmail, sanitizePhone } from '../lib/validate';

const router = createRouter();

router.get('/', async (req, res) => {
  const { q, page = '1', limit } = req.query as Record<string, string>;
  const pageN = Math.max(1, Number(page) || 1);
  const limitN = capLimit(limit);
  const offset = (pageN - 1) * limitN;
  const tf = tenantFilter(req.user);

  const where: Record<string, unknown> = { ...tf };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
      { document: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({ where, orderBy: { created_at: 'desc' }, skip: offset, take: limitN }),
  ]);

  res.json({ data: rows, total, page: pageN, pages: Math.ceil(total / limitN) });
});

router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id, 'Cliente');
  const tf = tenantFilter(req.user);
  const client = await prisma.client.findFirst({ where: { id, ...tf } });
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

  const appointments = await prisma.appointment.findMany({
    where: { client_id: client.id, tenant_id: client.tenant_id },
    orderBy: { scheduled_at: 'desc' },
  });
  res.json({ ...client, appointments });
});

router.post('/', async (req, res) => {
  if (req.user.role === 'professional') return res.status(403).json({ error: 'Acesso não permitido' });
  const { name, email, phone, document, address, notes } = req.body as Record<string, string>;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
  if (email && !isValidEmail(email)) return res.status(400).json({ error: 'Email inválido' });

  const tenantId = req.user.tenant_id;
  if (!tenantId) return res.status(403).json({ error: 'Super admin deve criar usuários pelo painel da plataforma' });

  const r = await prisma.client.create({
    data: { tenant_id: tenantId, name, email: email ? email.trim().toLowerCase() : null, phone: sanitizePhone(phone), document, address, notes },
  });
  await logActivity(req, 'create', 'client', r.id, `Cliente cadastrado: ${name}`);
  res.status(201).json(r);
});

router.put('/:id', async (req, res) => {
  if (req.user.role === 'professional') return res.status(403).json({ error: 'Acesso não permitido' });
  const id = parseId(req.params.id, 'Cliente');
  const tf = tenantFilter(req.user);
  const client = await prisma.client.findFirst({ where: { id, ...tf } });
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

  const { name, email, phone, document, address, notes, active } = req.body as Record<string, string | boolean>;
  if (email && !isValidEmail(String(email))) return res.status(400).json({ error: 'Email inválido' });

  await prisma.client.update({
    where: { id: client.id },
    data: {
      name: (name as string) ?? client.name,
      email: email !== undefined ? (email ? String(email).trim().toLowerCase() : null) : client.email,
      phone: phone !== undefined ? sanitizePhone(phone as string) : client.phone,
      document: (document as string) ?? client.document,
      address: (address as string) ?? client.address,
      notes: (notes as string) ?? client.notes,
      active: active !== undefined ? Boolean(active) : client.active,
    },
  });
  await logActivity(req, 'update', 'client', client.id, `Cliente atualizado: ${(name as string) ?? client.name}`);
  res.json({ message: 'Cliente atualizado' });
});

router.delete('/:id', async (req, res) => {
  if (req.user.role === 'professional') return res.status(403).json({ error: 'Acesso não permitido' });
  const id = parseId(req.params.id, 'Cliente');
  const tf = tenantFilter(req.user);
  const client = await prisma.client.findFirst({ where: { id, ...tf } });
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

  await prisma.client.update({ where: { id: client.id }, data: { active: false } });
  await logActivity(req, 'delete', 'client', client.id, `Cliente desativado: ${client.name}`);
  res.json({ message: 'Cliente desativado' });
});

export default router;
