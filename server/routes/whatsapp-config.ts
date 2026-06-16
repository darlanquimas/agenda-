import prisma from '../lib/prisma';
import { createRouter } from '../lib/router';
import { tenantFilter, logActivity } from '../lib/tenantScope';
import logger from '../lib/logger';
import evolutionApiService from '../services/evolutionApiService';
import config from '../config';
import axios from 'axios';

const router = createRouter();

// Buscar configuração
router.get('/', async (req, res) => {
  const tf = tenantFilter(req.user);
  
  if (!req.user.tenant_id) {
    return res.status(403).json({ error: 'Tenant não identificado' });
  }

  try {
    let config = await prisma.whatsAppConfig.findUnique({
      where: { tenant_id: req.user.tenant_id },
    });

    // Se não existir, criar com valores padrão
    if (!config) {
      config = await prisma.whatsAppConfig.create({
        data: {
          tenant_id: req.user.tenant_id,
        },
      });
    }

    // Buscar instâncias disponíveis
    const instances = await prisma.whatsAppInstance.findMany({
      where: { ...tf },
      select: {
        id: true,
        instance_name: true,
        status: true,
      },
      orderBy: { created_at: 'desc' },
    });

    res.json({
      config,
      instances,
    });
  } catch (error: any) {
    logger.error('[WhatsAppConfig] Erro ao buscar configuração', {
      error: error.message,
    });
    res.status(500).json({ error: 'Erro ao buscar configuração' });
  }
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
  } = req.body;

  try {
    const data: any = {};
    
    if (confirmation_message !== undefined) {
      data.confirmation_message = confirmation_message;
    }
    
    if (send_confirmation !== undefined) {
      data.send_confirmation = Boolean(send_confirmation);
    }
    
    if (default_instance_id !== undefined) {
      // Verificar se a instância pertence ao tenant
      if (default_instance_id) {
        const instance = await prisma.whatsAppInstance.findFirst({
          where: {
            id: default_instance_id,
            tenant_id: req.user.tenant_id,
          },
        });

        if (!instance) {
          return res.status(404).json({ error: 'Instância não encontrada' });
        }
      }
      
      data.default_instance_id = default_instance_id;
    }

    const config = await prisma.whatsAppConfig.upsert({
      where: { tenant_id: req.user.tenant_id },
      update: data,
      create: {
        tenant_id: req.user.tenant_id,
        ...data,
      },
    });

    await logActivity(
      req,
      'update',
      'whatsapp_config',
      config.id,
      'Configuração do WhatsApp atualizada'
    );

    logger.info('[WhatsAppConfig] Configuração atualizada', {
      tenantId: req.user.tenant_id,
      changes: Object.keys(data),
    });

    res.json(config);
  } catch (error: any) {
    logger.error('[WhatsAppConfig] Erro ao atualizar configuração', {
      error: error.message,
    });
    res.status(500).json({ error: 'Erro ao atualizar configuração' });
  }
});

// Configurar webhook para uma instância
router.post('/webhook/setup/:instanceId', async (req, res) => {
  if (req.user.role === 'professional') return res.status(403).json({ error: 'Acesso não permitido' });
  const tf = tenantFilter(req.user);
  const instanceId = parseInt(req.params.instanceId);

  if (!req.user.tenant_id) {
    return res.status(403).json({ error: 'Tenant não identificado' });
  }

  try {
    // Buscar instância
    const instance = await prisma.whatsAppInstance.findFirst({
      where: {
        id: instanceId,
        ...tf,
      },
    });

    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    const apiInstanceName = instance.api_instance_name ?? instance.instance_name;
    const webhookUrl = `${config.webhookBaseUrl}/webhook/whatsapp/${apiInstanceName}`;

    logger.info('[WhatsAppConfig] Configurando webhook', {
      tenantId: req.user.tenant_id,
      instanceName: apiInstanceName,
      webhookUrl,
    });

    // Configurar webhook na Evolution API
    const response = await axios.post(
      `${config.evolutionApiUrl}/webhook/set/${apiInstanceName}`,
      {
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          events: ['MESSAGES_UPSERT'],
        },
      },
      {
        headers: {
          apikey: config.evolutionApiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    await logActivity(
      req,
      'update',
      'whatsapp_instance',
      instance.id,
      `Webhook configurado: ${webhookUrl}`
    );

    logger.info('[WhatsAppConfig] Webhook configurado com sucesso', {
      tenantId: req.user.tenant_id,
      instanceName: instance.instance_name,
    });

    res.json({
      success: true,
      webhookUrl,
      response: response.data,
    });
  } catch (error: any) {
    logger.error('[WhatsAppConfig] Erro ao configurar webhook', {
      error: error.response?.data || error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: 'Erro ao configurar webhook',
      details: error.response?.data || error.message,
    });
  }
});

// Limpar todas as instâncias da Evolution API
router.delete('/cleanup', async (req, res) => {
  if (req.user.role === 'professional') return res.status(403).json({ error: 'Acesso não permitido' });
  const tf = tenantFilter(req.user);

  if (!req.user.tenant_id) {
    return res.status(403).json({ error: 'Tenant não identificado' });
  }

  try {
    logger.info('[WhatsAppConfig] Iniciando limpeza de instâncias', {
      tenantId: req.user.tenant_id,
      userId: req.user.id,
    });

    // Deletar todas as instâncias da Evolution API
    const result = await evolutionApiService.deleteAllInstances();

    // Deletar registros do banco de dados
    const deletedFromDb = await prisma.whatsAppInstance.deleteMany({
      where: { ...tf },
    });

    await logActivity(
      req,
      'delete',
      'whatsapp_instances',
      0,
      `Limpeza de instâncias: ${result.deleted} deletadas da API, ${deletedFromDb.count} do banco`
    );

    logger.info('[WhatsAppConfig] Limpeza concluída', {
      tenantId: req.user.tenant_id,
      deletedFromApi: result.deleted,
      deletedFromDb: deletedFromDb.count,
      errors: result.errors.length,
    });

    res.json({
      success: true,
      deletedFromApi: result.deleted,
      deletedFromDb: deletedFromDb.count,
      errors: result.errors,
    });
  } catch (error: any) {
    logger.error('[WhatsAppConfig] Erro ao limpar instâncias', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Erro ao limpar instâncias' });
  }
});

export default router;
