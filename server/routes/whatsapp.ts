import prisma from '../lib/prisma';
import { createRouter } from '../lib/router';
import { tenantFilter, logActivity } from '../lib/tenantScope';
import { parseId } from '../lib/validate';

const router = createRouter();

router.get('/', async (req, res) => {
  const tf = tenantFilter(req.user);

  const instances = await prisma.whatsAppInstance.findMany({
    where: { ...tf },
    orderBy: { created_at: 'desc' },
  });

  res.json({ data: instances });
});

router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id, 'Instância');
  const tf = tenantFilter(req.user);

  const instance = await prisma.whatsAppInstance.findFirst({
    where: { id, ...tf },
  });

  if (!instance) {
    return res.status(404).json({ error: 'Instância não encontrada' });
  }

  res.json(instance);
});

// Remove apenas o registro local em cache; a instância no Evo Manager não é afetada.
// Se ainda estiver conectada lá, a próxima sincronização (testar conexão) a recria.
router.delete('/:id', async (req, res) => {
  if (req.user.role === 'professional') return res.status(403).json({ error: 'Acesso não permitido' });
  const id = parseId(req.params.id, 'Instância');
  const tf = tenantFilter(req.user);

  const instance = await prisma.whatsAppInstance.findFirst({
    where: { id, ...tf },
  });

  if (!instance) {
    return res.status(404).json({ error: 'Instância não encontrada' });
  }

  await prisma.whatsAppInstance.delete({ where: { id: instance.id } });

  await logActivity(
    req,
    'delete',
    'whatsapp_instance',
    instance.id,
    `Instância WhatsApp removida do cache local: ${instance.instance_name}`
  );

  res.json({ message: 'Instância removida' });
});

export default router;
