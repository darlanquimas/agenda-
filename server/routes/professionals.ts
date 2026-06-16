import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { createRouter } from '../lib/router';
import { tenantFilter, logActivity } from '../lib/tenantScope';
import { parseId, isValidEmail, validatePassword, sanitizePhone } from '../lib/validate';

const router = createRouter();

async function assertTenantIds(
  ids: number[],
  finder: (ids: number[]) => Promise<{ id: number }[]>,
): Promise<boolean> {
  if (!ids.length) return true;
  const found = await finder(ids);
  return found.length === ids.length;
}

async function enrichProfessional(id: number) {
  const p = await prisma.professional.findUnique({
    where: { id },
    include: {
      specialties: { include: { specialty: true } },
      services: { include: { service: true } },
      availability: { where: { active: true }, orderBy: { weekday: 'asc' } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!p) return null;
  return {
    ...p,
    specialties: p.specialties.map((ps) => ps.specialty),
    services: p.services.map((ps) => ps.service),
    availability: p.availability,
    user: p.user ?? null,
  };
}

async function applyUserLink(
  professionalId: number,
  tenantId: number,
  linkMode: 'none' | 'existing' | 'new',
  opts: { link_user_id?: number; user_email?: string; user_password?: string; professionalName?: string },
): Promise<{ error: string } | null> {
  const { link_user_id, user_email, user_password, professionalName } = opts;

  const currentLinked = await prisma.user.findFirst({ where: { professional_id: professionalId } });

  if (linkMode === 'none') {
    if (currentLinked) await prisma.user.update({ where: { id: currentLinked.id }, data: { professional_id: null } });
    return null;
  }

  if (linkMode === 'existing') {
    if (!link_user_id) return { error: 'Usuário não selecionado' };
    const target = await prisma.user.findFirst({ where: { id: link_user_id, tenant_id: tenantId } });
    if (!target) return { error: 'Usuário não encontrado' };
    if (target.professional_id && target.professional_id !== professionalId) return { error: 'Usuário já vinculado a outro profissional' };
    if (currentLinked && currentLinked.id !== link_user_id) {
      await prisma.user.update({ where: { id: currentLinked.id }, data: { professional_id: null } });
    }
    await prisma.user.update({ where: { id: link_user_id }, data: { professional_id: professionalId, role: 'professional' } });
    return null;
  }

  // linkMode === 'new'
  if (!user_email || !isValidEmail(user_email)) return { error: 'Email de acesso inválido' };
  if (!user_password) return { error: 'Senha de acesso obrigatória' };
  const pwErr = validatePassword(user_password);
  if (pwErr) return { error: pwErr };

  const existing = await prisma.user.findUnique({ where: { email: user_email.trim().toLowerCase() } });
  if (existing) return { error: 'Email de acesso já cadastrado' };

  if (currentLinked) await prisma.user.update({ where: { id: currentLinked.id }, data: { professional_id: null } });

  const hash = bcrypt.hashSync(user_password, 10);
  await prisma.user.create({
    data: {
      name: professionalName ?? 'Profissional',
      email: user_email.trim().toLowerCase(),
      password: hash,
      role: 'professional',
      tenant_id: tenantId,
      professional_id: professionalId,
    },
  });
  return null;
}

router.get('/', async (req, res) => {
  const { q } = req.query as Record<string, string>;
  const tf = tenantFilter(req.user);
  const where: Record<string, unknown> = { ...tf };
  if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }];

  const rows = await prisma.professional.findMany({ where, orderBy: { name: 'asc' } });
  const enriched = await Promise.all(rows.map((p) => enrichProfessional(p.id)));
  res.json(enriched);
});

router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id, 'Profissional');
  const tf = tenantFilter(req.user);
  const p = await prisma.professional.findFirst({ where: { id, ...tf } });
  if (!p) return res.status(404).json({ error: 'Profissional não encontrado' });
  res.json(await enrichProfessional(p.id));
});

router.post('/', async (req, res) => {
  if (req.user.role === 'professional') return res.status(403).json({ error: 'Acesso não permitido' });
  const {
    name, email, phone, bio,
    specialty_ids = [], service_ids = [], availability = [],
    link_mode = 'none', link_user_id, user_email, user_password,
  } = req.body as {
    name: string; email?: string; phone?: string; bio?: string;
    specialty_ids?: number[]; service_ids?: number[];
    availability?: { weekday: number; start_time: string; end_time: string }[];
    link_mode?: 'none' | 'existing' | 'new';
    link_user_id?: number; user_email?: string; user_password?: string;
  };

  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
  if (email && !isValidEmail(email)) return res.status(400).json({ error: 'Email inválido' });
  const tenantId = req.user.tenant_id;
  if (!tenantId) return res.status(403).json({ error: 'Operação não disponível para super admin nesta tela' });

  const [specValid, svcValid] = await Promise.all([
    assertTenantIds(specialty_ids, (ids) => prisma.specialty.findMany({ where: { id: { in: ids }, tenant_id: tenantId }, select: { id: true } })),
    assertTenantIds(service_ids, (ids) => prisma.service.findMany({ where: { id: { in: ids }, tenant_id: tenantId }, select: { id: true } })),
  ]);
  if (!specValid) return res.status(400).json({ error: 'Especialidade inválida' });
  if (!svcValid) return res.status(400).json({ error: 'Serviço inválido' });

  const p = await prisma.professional.create({ data: { tenant_id: tenantId, name, email: email ? email.trim().toLowerCase() : null, phone: sanitizePhone(phone), bio } });

  await Promise.all([
    specialty_ids.length && prisma.professionalSpecialty.createMany({
      data: specialty_ids.map((id) => ({ professional_id: p.id, specialty_id: id })),
      skipDuplicates: true,
    }),
    service_ids.length && prisma.professionalService.createMany({
      data: service_ids.map((id) => ({ professional_id: p.id, service_id: id })),
      skipDuplicates: true,
    }),
    availability.length && prisma.availability.createMany({
      data: availability.map((a) => ({ tenant_id: tenantId, professional_id: p.id, weekday: a.weekday, start_time: a.start_time, end_time: a.end_time })),
    }),
  ]);

  if (link_mode !== 'none') {
    const linkErr = await applyUserLink(p.id, tenantId, link_mode, { link_user_id, user_email, user_password, professionalName: name });
    if (linkErr) {
      await prisma.professional.delete({ where: { id: p.id } });
      return res.status(400).json(linkErr);
    }
  }

  await logActivity(req, 'create', 'professional', p.id, `Profissional cadastrado: ${name}${link_mode !== 'none' ? ' (com acesso ao sistema)' : ''}`);
  res.status(201).json(await enrichProfessional(p.id));
});

router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id, 'Profissional');
  const tf = tenantFilter(req.user);
  const p = await prisma.professional.findFirst({ where: { id, ...tf } });
  if (!p) return res.status(404).json({ error: 'Profissional não encontrado' });

  if (req.user.role === 'professional') {
    if (req.user.professional_id !== id) {
      return res.status(403).json({ error: 'Você só pode editar seu próprio perfil profissional' });
    }
    if (link_mode !== undefined) {
      return res.status(403).json({ error: 'Você não pode alterar vínculos de usuário' });
    }
  }

  const { name, email, phone, bio, active, specialty_ids, service_ids, availability, link_mode, link_user_id, user_email, user_password } = req.body as {
    name?: string; email?: string; phone?: string; bio?: string; active?: boolean;
    specialty_ids?: number[]; service_ids?: number[];
    availability?: { weekday: number; start_time: string; end_time: string }[];
    link_mode?: 'none' | 'existing' | 'new';
    link_user_id?: number; user_email?: string; user_password?: string;
  };

  await prisma.professional.update({
    where: { id: p.id },
    data: { name: name ?? p.name, email: email ?? p.email, phone: phone !== undefined ? sanitizePhone(phone) : p.phone, bio: bio ?? p.bio, active: active ?? p.active },
  });

  if (specialty_ids !== undefined) {
    if (specialty_ids.length) {
      const valid = await assertTenantIds(specialty_ids, (ids) =>
        prisma.specialty.findMany({ where: { id: { in: ids }, tenant_id: p.tenant_id }, select: { id: true } }),
      );
      if (!valid) return res.status(400).json({ error: 'Especialidade inválida' });
    }
    await prisma.professionalSpecialty.deleteMany({ where: { professional_id: p.id } });
    if (specialty_ids.length) await prisma.professionalSpecialty.createMany({
      data: specialty_ids.map((id) => ({ professional_id: p.id, specialty_id: id })),
      skipDuplicates: true,
    });
  }
  if (service_ids !== undefined) {
    if (service_ids.length) {
      const valid = await assertTenantIds(service_ids, (ids) =>
        prisma.service.findMany({ where: { id: { in: ids }, tenant_id: p.tenant_id }, select: { id: true } }),
      );
      if (!valid) return res.status(400).json({ error: 'Serviço inválido' });
    }
    await prisma.professionalService.deleteMany({ where: { professional_id: p.id } });
    if (service_ids.length) await prisma.professionalService.createMany({
      data: service_ids.map((id) => ({ professional_id: p.id, service_id: id })),
      skipDuplicates: true,
    });
  }
  if (availability !== undefined) {
    await prisma.availability.deleteMany({ where: { professional_id: p.id } });
    if (availability.length) await prisma.availability.createMany({
      data: availability.map((a) => ({ tenant_id: p.tenant_id, professional_id: p.id, weekday: a.weekday, start_time: a.start_time, end_time: a.end_time })),
    });
  }

  if (link_mode !== undefined) {
    const tenantId = p.tenant_id;
    const linkErr = await applyUserLink(p.id, tenantId, link_mode, { link_user_id, user_email, user_password, professionalName: name ?? p.name });
    if (linkErr) return res.status(400).json(linkErr);
  }

  await logActivity(req, 'update', 'professional', p.id, `Profissional atualizado: ${name ?? p.name}`);
  res.json(await enrichProfessional(p.id));
});

router.delete('/:id', async (req, res) => {
  if (req.user.role === 'professional') return res.status(403).json({ error: 'Acesso não permitido' });
  const id = parseId(req.params.id, 'Profissional');
  const tf = tenantFilter(req.user);
  const p = await prisma.professional.findFirst({ where: { id, ...tf } });
  if (!p) return res.status(404).json({ error: 'Profissional não encontrado' });

  await prisma.professional.update({ where: { id: p.id }, data: { active: false } });
  await logActivity(req, 'delete', 'professional', p.id, `Profissional desativado: ${p.name}`);
  res.json({ message: 'Profissional desativado' });
});

export default router;
