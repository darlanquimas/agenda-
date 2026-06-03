import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { USER_SELECT, rowToAuthUser } from '../middleware/auth';
import { serializeUser, SerializedUser } from '../lib/userSerializer';
import { isValidEmail, validatePassword } from '../lib/validate';

const LIST_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  tenant_id: true,
  active: true,
  created_at: true,
  tenant: { select: { name: true, slug: true } },
} as const;

function makeAppError(message: string, status: number): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

export async function listUsers(opts: { tenantId?: number; tenantIdFilter?: number } = {}): Promise<unknown[]> {
  const where: Record<string, unknown> = { role: { not: 'super_admin' } };
  if (opts.tenantId != null) where.tenant_id = opts.tenantId;
  else if (opts.tenantIdFilter != null) where.tenant_id = opts.tenantIdFilter;

  const rows = await prisma.user.findMany({
    where,
    select: LIST_SELECT,
    orderBy: { name: 'asc' },
  });

  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    tenant_id: u.tenant_id,
    active: u.active,
    created_at: u.created_at,
    tenant_name: u.tenant?.name ?? null,
    tenant_slug: u.tenant?.slug ?? null,
  }));
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  tenant_id: number;
  active?: boolean | number;
}): Promise<SerializedUser> {
  const { name, email, password, tenant_id, active = true } = data;
  if (!name || !email || !password || !tenant_id) {
    throw makeAppError('name, email, password e tenant_id são obrigatórios', 400);
  }
  if (!isValidEmail(email)) throw makeAppError('Email inválido', 400);

  const pwErr = validatePassword(password);
  if (pwErr) throw makeAppError(pwErr, 400);

  const tenant = await prisma.tenant.findUnique({ where: { id: Number(tenant_id) } });
  if (!tenant) throw makeAppError('Organização não encontrada', 404);

  const hash = bcrypt.hashSync(password, 10);
  const isActive = active === 1 || active === true;

  try {
    const row = await prisma.user.create({
      data: { name, email: email.trim().toLowerCase(), password: hash, role: 'admin', tenant_id: Number(tenant_id), active: isActive },
      select: USER_SELECT,
    });
    return serializeUser(rowToAuthUser(row));
  } catch {
    throw makeAppError('Email já cadastrado', 409);
  }
}

export async function updateUser(
  id: number | string,
  data: { name?: string; email?: string; password?: string; tenant_id?: number; active?: boolean | number },
  opts: { scopeTenantId?: number | null; allowTenantChange?: boolean } = {},
): Promise<SerializedUser> {
  const { scopeTenantId = null, allowTenantChange = false } = opts;

  const row = await prisma.user.findUnique({ where: { id: Number(id) } });
  if (!row || row.role === 'super_admin') throw makeAppError('Usuário não encontrado', 404);
  if (scopeTenantId != null && row.tenant_id !== scopeTenantId) throw makeAppError('Usuário não encontrado', 404);

  if (data.email && !isValidEmail(data.email)) throw makeAppError('Email inválido', 400);
  if (data.password) {
    const pwErr = validatePassword(data.password);
    if (pwErr) throw makeAppError(pwErr, 400);
  }

  let targetTenantId = row.tenant_id;
  if (allowTenantChange && data.tenant_id != null) {
    const tenant = await prisma.tenant.findUnique({ where: { id: Number(data.tenant_id) } });
    if (!tenant) throw makeAppError('Organização não encontrada', 404);
    targetTenantId = Number(data.tenant_id);
  } else if (data.tenant_id != null && data.tenant_id !== row.tenant_id) {
    throw makeAppError('Não é permitido alterar a organização do usuário', 403);
  }

  const hash = data.password ? bcrypt.hashSync(data.password, 10) : row.password;
  const isActive = data.active === undefined ? row.active : (data.active === 1 || data.active === true);

  try {
    const updated = await prisma.user.update({
      where: { id: row.id },
      data: {
        name: data.name ?? row.name,
        email: data.email ? data.email.trim().toLowerCase() : row.email,
        password: hash,
        tenant_id: targetTenantId,
        active: isActive,
      },
      select: USER_SELECT,
    });
    return serializeUser(rowToAuthUser(updated));
  } catch {
    throw makeAppError('Email já cadastrado', 409);
  }
}
