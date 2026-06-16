import prisma from '../lib/prisma';
import { createRouter } from '../lib/router';
import { tenantFilter, logActivity } from '../lib/tenantScope';
import { parseId } from '../lib/validate';
import evolutionApiService from '../services/evolutionApiService';
import logger from '../lib/logger';

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

router.post('/', async (req, res) => {
  if (req.user.role === 'professional') return res.status(403).json({ error: 'Acesso não permitido' });
  const { instance_name } = req.body as { instance_name: string };
  
  if (!instance_name || !instance_name.trim()) {
    return res.status(400).json({ error: 'Nome da instância é obrigatório' });
  }

  const tenantId = req.user.tenant_id;
  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant não identificado' });
  }

  try {
    const existingInstance = await prisma.whatsAppInstance.findUnique({
      where: {
        tenant_id_instance_name: {
          tenant_id: tenantId,
          instance_name: instance_name.trim(),
        },
      },
    });

    if (existingInstance) {
      return res.status(400).json({ error: 'Já existe uma instância com este nome' });
    }

    const apiInstanceName = `t${tenantId}_${instance_name.trim()}`;

    const evolutionResponse = await evolutionApiService.createInstance({
      instanceName: apiInstanceName,
      qrcode: true,
    });

    logger.info('[WhatsApp] Resposta da Evolution API', {
      hasInstance: !!evolutionResponse.instance,
      hasQrcode: !!evolutionResponse.qrcode,
      qrcodeBase64: evolutionResponse.qrcode?.base64 ? 'presente' : 'ausente',
      qrcodeCode: evolutionResponse.qrcode?.code ? 'presente' : 'ausente',
    });

    let qrCode = evolutionResponse.qrcode?.base64 || evolutionResponse.qrcode?.code || null;

    // Se não veio QR Code na criação, tenta buscar
    if (!qrCode) {
      logger.info('[WhatsApp] QR Code não retornado na criação, buscando...');
      try {
        const qrData = await evolutionApiService.fetchQrCode(apiInstanceName);
        qrCode = qrData.qrcode?.base64 || qrData.qrcode?.code || null;
        logger.info('[WhatsApp] QR Code obtido após criação', {
          hasQrCode: !!qrCode,
        });
      } catch (qrError: any) {
        logger.warn('[WhatsApp] Erro ao buscar QR Code após criação', {
          error: qrError.message,
        });
      }
    }

    const instanceData = await prisma.whatsAppInstance.create({
      data: {
        tenant_id: tenantId,
        instance_name: instance_name.trim(),
        api_instance_name: apiInstanceName,
        instance_id: evolutionResponse.instance?.instanceId,
        status: evolutionResponse.instance?.status || 'disconnected',
        qr_code: qrCode,
      },
    });

    await logActivity(
      req,
      'create',
      'whatsapp_instance',
      instanceData.id,
      `Instância WhatsApp criada: ${instance_name}`
    );

    logger.info(`[WhatsApp] Nova instância criada: ${instance_name} (tenant: ${tenantId})`, {
      hasQrCode: !!qrCode,
    });
    
    res.status(201).json(instanceData);
  } catch (error: any) {
    logger.error('[WhatsApp] Erro ao criar instância', {
      instanceName: instance_name,
      tenantId,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: error.message || 'Erro ao criar instância' });
  }
});

router.post('/:id/reconnect', async (req, res) => {
  if (req.user.role === 'professional') return res.status(403).json({ error: 'Acesso não permitido' });
  const id = parseId(req.params.id, 'Instância');
  const tf = tenantFilter(req.user);
  
  const instance = await prisma.whatsAppInstance.findFirst({
    where: { id, ...tf },
  });
  
  if (!instance) {
    return res.status(404).json({ error: 'Instância não encontrada' });
  }

  try {
    const qrData = await evolutionApiService.fetchQrCode(instance.api_instance_name ?? instance.instance_name);

    const qrCode = qrData.qrcode?.base64 || qrData.qrcode?.code;

    logger.info('[WhatsApp] QR Code obtido para reconexão', {
      instanceName: instance.instance_name,
      hasQrCode: !!qrCode,
      qrCodeType: qrData.qrcode?.base64 ? 'base64' : qrData.qrcode?.code ? 'code' : 'none',
    });

    await prisma.whatsAppInstance.update({
      where: { id: instance.id },
      data: {
        qr_code: qrCode,
        status: 'connecting',
      },
    });

    await logActivity(
      req,
      'update',
      'whatsapp_instance',
      instance.id,
      `Solicitada reconexão: ${instance.instance_name}`
    );

    logger.info(`[WhatsApp] Reconexão solicitada: ${instance.instance_name}`);
    
    res.json({ 
      message: 'QR Code gerado com sucesso',
      qr_code: qrCode,
    });
  } catch (error: any) {
    logger.error('[WhatsApp] Erro ao reconectar instância', {
      instanceId: id,
      error: error.message,
    });
    res.status(500).json({ error: error.message || 'Erro ao gerar QR Code' });
  }
});

router.get('/:id/status', async (req, res) => {
  const id = parseId(req.params.id, 'Instância');
  const tf = tenantFilter(req.user);
  
  const instance = await prisma.whatsAppInstance.findFirst({
    where: { id, ...tf },
  });
  
  if (!instance) {
    return res.status(404).json({ error: 'Instância não encontrada' });
  }

  try {
    const statusData = await evolutionApiService.getConnectionStatus(instance.api_instance_name ?? instance.instance_name);
    
    const newStatus = statusData.instance?.state || 'disconnected';
    
    await prisma.whatsAppInstance.update({
      where: { id: instance.id },
      data: {
        status: newStatus,
        connected_at: newStatus === 'open' ? new Date() : instance.connected_at,
      },
    });

    res.json({ 
      status: newStatus,
      instance_name: instance.instance_name,
    });
  } catch (error: any) {
    logger.error('[WhatsApp] Erro ao consultar status', {
      instanceId: id,
      error: error.message,
    });
    res.status(500).json({ error: error.message || 'Erro ao consultar status' });
  }
});

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

  try {
    await evolutionApiService.deleteInstance(instance.api_instance_name ?? instance.instance_name);

    await prisma.whatsAppInstance.delete({
      where: { id: instance.id },
    });

    await logActivity(
      req,
      'delete',
      'whatsapp_instance',
      instance.id,
      `Instância WhatsApp deletada: ${instance.instance_name}`
    );

    logger.info(`[WhatsApp] Instância deletada: ${instance.instance_name}`);
    
    res.json({ message: 'Instância deletada com sucesso' });
  } catch (error: any) {
    logger.error('[WhatsApp] Erro ao deletar instância', {
      instanceId: id,
      error: error.message,
    });
    res.status(500).json({ error: error.message || 'Erro ao deletar instância' });
  }
});

router.post('/:id/disconnect', async (req, res) => {
  if (req.user.role === 'professional') return res.status(403).json({ error: 'Acesso não permitido' });
  const id = parseId(req.params.id, 'Instância');
  const tf = tenantFilter(req.user);
  
  const instance = await prisma.whatsAppInstance.findFirst({
    where: { id, ...tf },
  });
  
  if (!instance) {
    return res.status(404).json({ error: 'Instância não encontrada' });
  }

  try {
    await evolutionApiService.logoutInstance(instance.api_instance_name ?? instance.instance_name);

    await prisma.whatsAppInstance.update({
      where: { id: instance.id },
      data: {
        status: 'disconnected',
        qr_code: null,
      },
    });

    await logActivity(
      req,
      'update',
      'whatsapp_instance',
      instance.id,
      `Instância WhatsApp desconectada: ${instance.instance_name}`
    );

    logger.info(`[WhatsApp] Instância desconectada: ${instance.instance_name}`);
    
    res.json({ message: 'Instância desconectada com sucesso' });
  } catch (error: any) {
    logger.error('[WhatsApp] Erro ao desconectar instância', {
      instanceId: id,
      error: error.message,
    });
    res.status(500).json({ error: error.message || 'Erro ao desconectar instância' });
  }
});

export default router;
