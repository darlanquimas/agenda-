import prisma from '../lib/prisma';
import { createRouter } from '../lib/router';
import { tenantFilter, logActivity } from '../lib/tenantScope';
import logger from '../lib/logger';
import * as evoManagerService from '../services/evoManagerService';
import config from '../config';

const router = createRouter();

// Buscar configuração
router.get('/', async (req, res) => {
  const tf = tenantFilter(req.user);

  if (!req.user.tenant_id) {
    return res.status(403).json({ error: 'Tenant não identificado' });
  }

  let whatsappConfig = await prisma.whatsAppConfig.findUnique({
    where: { tenant_id: req.user.tenant_id },
  });

  if (!whatsappConfig) {
    whatsappConfig = await prisma.whatsAppConfig.create({
      data: { tenant_id: req.user.tenant_id },
    });
  }

  const instances = await prisma.whatsAppInstance.findMany({
    where: { ...tf },
    orderBy: { created_at: 'desc' },
  });

  const { evo_api_key, webhook_signing_secret, ...safeConfig } = whatsappConfig;

  res.json({
    config: {
      ...safeConfig,
      has_api_key: !!evo_api_key,
      has_webhook_secret: !!webhook_signing_secret,
    },
    instances,
    webhook_url: `${config.webhookBaseUrl}/webhook/whatsapp/${req.user.tenant_id}`,
  });
});

// Atualizar configuração
router.put('/', async (req, res) => {
  if (req.user.role === 'professional') return res.status(403).json({ error: 'Acesso não permitido' });
  if (!req.user.tenant_id) {
    return res.status(403).json({ error: 'Tenant não identificado' });
  }

  const {
    confirmation_message,
    send_confirmation,
    default_instance_id,
    evo_client_id,
    evo_api_key,
    webhook_signing_secret,
  } = req.body;

  const data: any = {};

  if (confirmation_message !== undefined) data.confirmation_message = confirmation_message;
  if (send_confirmation !== undefined) data.send_confirmation = Boolean(send_confirmation);

  if (default_instance_id !== undefined) {
    if (default_instance_id) {
      const instance = await prisma.whatsAppInstance.findFirst({
        where: { id: default_instance_id, tenant_id: req.user.tenant_id },
      });
      if (!instance) return res.status(404).json({ error: 'Instância não encontrada' });
    }
    data.default_instance_id = default_instance_id;
  }

  // Client ID não é secreto e pode ser limpo/atualizado livremente.
  if (evo_client_id !== undefined) data.evo_client_id = evo_client_id || null;

  // API Key e webhook secret: só sobrescreve quando vier um valor não vazio,
  // para não obrigar o admin a recolar o secret a cada vez que salva a tela.
  if (typeof evo_api_key === 'string' && evo_api_key.trim()) data.evo_api_key = evo_api_key.trim();
  if (typeof webhook_signing_secret === 'string' && webhook_signing_secret.trim()) {
    data.webhook_signing_secret = webhook_signing_secret.trim();
  }

  const whatsappConfig = await prisma.whatsAppConfig.upsert({
    where: { tenant_id: req.user.tenant_id },
    update: data,
    create: { tenant_id: req.user.tenant_id, ...data },
  });

  await logActivity(req, 'update', 'whatsapp_config', whatsappConfig.id, 'Configuração do WhatsApp atualizada');

  const { evo_api_key: _key, webhook_signing_secret: _secret, ...safeConfig } = whatsappConfig;
  res.json({
    ...safeConfig,
    has_api_key: !!whatsappConfig.evo_api_key,
    has_webhook_secret: !!whatsappConfig.webhook_signing_secret,
  });
});

// Testar credenciais e sincronizar instâncias conectadas no Evo Manager
router.post('/test-connection', async (req, res) => {
  if (req.user.role === 'professional') return res.status(403).json({ error: 'Acesso não permitido' });
  if (!req.user.tenant_id) {
    return res.status(403).json({ error: 'Tenant não identificado' });
  }

  const whatsappConfig = await prisma.whatsAppConfig.findUnique({
    where: { tenant_id: req.user.tenant_id },
  });

  if (!whatsappConfig?.evo_client_id || !whatsappConfig?.evo_api_key) {
    return res.status(400).json({ error: 'Configure o Client ID e a API Key antes de testar a conexão' });
  }

  try {
    const me = await evoManagerService.getMe(whatsappConfig.evo_client_id, whatsappConfig.evo_api_key);

    const seenNames = me.connected_instances.map((i) => i.instance_name);

    for (const remote of me.connected_instances) {
      await prisma.whatsAppInstance.upsert({
        where: {
          tenant_id_instance_name: {
            tenant_id: req.user.tenant_id,
            instance_name: remote.instance_name,
          },
        },
        update: {
          phone_number: remote.phone_number,
          status: remote.status,
          connected_at: remote.status === 'open' ? new Date() : undefined,
        },
        create: {
          tenant_id: req.user.tenant_id,
          instance_name: remote.instance_name,
          phone_number: remote.phone_number,
          status: remote.status,
          connected_at: remote.status === 'open' ? new Date() : null,
        },
      });
    }

    await prisma.whatsAppInstance.updateMany({
      where: {
        tenant_id: req.user.tenant_id,
        instance_name: { notIn: seenNames },
      },
      data: { status: 'disconnected' },
    });

    const instances = await prisma.whatsAppInstance.findMany({
      where: { tenant_id: req.user.tenant_id },
      orderBy: { created_at: 'desc' },
    });

    await logActivity(req, 'update', 'whatsapp_config', whatsappConfig.id, 'Conexão com Evo Manager testada e instâncias sincronizadas');

    res.json({ success: true, tenant: me.tenant, instances });
  } catch (error: any) {
    logger.error('[WhatsAppConfig] Erro ao testar conexão com Evo Manager', {
      tenantId: req.user.tenant_id,
      error: error.message,
    });
    res.status(400).json({ error: error.message || 'Erro ao conectar ao Evo Manager' });
  }
});

export default router;
