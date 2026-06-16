import { Tenant } from '../generated/prisma/client';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  tenant_id: number | null;
  professional_id: number | null;
  active: boolean;
  tenant_slug: string | null;
  tenant_name: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user: AuthUser;
      tenant: Tenant;
      tenantId: number;
    }
  }
}
