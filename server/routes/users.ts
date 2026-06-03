import { createRouter } from '../lib/router';
import requireTenantAdmin from '../middleware/requireTenantAdmin';
import * as usersService from '../services/usersService';

const router = createRouter();

router.get('/', requireTenantAdmin, async (req, res) => {
  res.json(await usersService.listUsers({ tenantId: req.user.tenant_id! }));
});

router.post('/', requireTenantAdmin, async (req, res) => {
  try {
    const { name, email, password, active = true } = req.body;
    const user = await usersService.createUser({ name, email, password, tenant_id: req.user.tenant_id!, active });
    res.status(201).json(user);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.put('/:id', requireTenantAdmin, async (req, res) => {
  try {
    const user = await usersService.updateUser(req.params.id, req.body, {
      scopeTenantId: req.user.tenant_id,
      allowTenantChange: false,
    });
    res.json(user);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
