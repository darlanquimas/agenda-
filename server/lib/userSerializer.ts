import { AuthUser } from '../types/express';
import { isSuperAdmin } from './tenantScope';

export interface SerializedUser extends AuthUser {
  is_super_admin: boolean;
}

export function serializeUser(user: AuthUser): SerializedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenant_id: user.tenant_id,
    tenant_slug: user.tenant_slug ?? null,
    tenant_name: user.tenant_name ?? null,
    active: user.active,
    is_super_admin: isSuperAdmin(user),
  };
}
