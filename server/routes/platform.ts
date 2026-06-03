import prisma from '../lib/prisma';
import { createRouter } from '../lib/router';
import { requireSuperAdmin } from '../lib/tenantScope';
import * as usersService from '../services/usersService';

const router = createRouter();

const slugify = (s: string): string =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

router.get('/tenants', requireSuperAdmin, async (_req, res) => {
  const rows = await prisma.tenant.findMany({ orderBy: { name: 'asc' } });
  const enriched = await Promise.all(rows.map(async (t) => {
    const [user_count, client_count] = await Promise.all([
      prisma.user.count({ where: { tenant_id: t.id } }),
      prisma.client.count({ where: { tenant_id: t.id } }),
    ]);
    return { ...t, user_count, client_count };
  }));
  res.json(enriched);
});

router.post('/tenants', requireSuperAdmin, async (req, res) => {
  const { name, slug, active = true } = req.body as Record<string, string | boolean>;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
  const finalSlug = slugify(String(slug || name));
  if (!finalSlug) return res.status(400).json({ error: 'Slug inválido' });

  try {
    const t = await prisma.tenant.create({ data: { name: String(name), slug: finalSlug, active: Boolean(active) } });
    res.status(201).json(t);
  } catch {
    res.status(409).json({ error: 'Slug já em uso' });
  }
});

router.put('/tenants/:id', requireSuperAdmin, async (req, res) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: Number(req.params.id) } });
  if (!tenant) return res.status(404).json({ error: 'Organização não encontrada' });

  const { name, slug, active } = req.body as Record<string, string | boolean>;
  const finalSlug = slug != null ? slugify(String(slug)) : tenant.slug;

  try {
    const t = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { name: (name as string) ?? tenant.name, slug: finalSlug, active: active !== undefined ? Boolean(active) : tenant.active },
    });
    res.json(t);
  } catch {
    res.status(409).json({ error: 'Slug já em uso' });
  }
});

router.get('/users', requireSuperAdmin, async (req, res) => {
  const { tenant_id } = req.query as Record<string, string>;
  res.json(await usersService.listUsers({ tenantIdFilter: tenant_id ? Number(tenant_id) : undefined }));
});

router.post('/users', requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, password, tenant_id, active = true } = req.body;
    const user = await usersService.createUser({ name, email, password, tenant_id, active });
    res.status(201).json(user);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.put('/users/:id', requireSuperAdmin, async (req, res) => {
  try {
    const user = await usersService.updateUser(req.params.id, req.body, { scopeTenantId: null, allowTenantChange: true });
    res.json(user);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
