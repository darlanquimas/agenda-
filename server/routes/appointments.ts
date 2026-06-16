import prisma from '../lib/prisma';
import { createRouter } from '../lib/router';
import { tenantFilter, logActivity } from '../lib/tenantScope';
import { parseId, capLimit } from '../lib/validate';
import whatsappService from '../services/whatsappService';
import { generateUniqueToken } from '../lib/tokenGenerator';
import logger from '../lib/logger';

const router = createRouter();
const VALID_STATUS = ['pending', 'scheduled', 'running', 'finished', 'failed', 'cancelled'];
const BLOCKS_SLOT = ['scheduled', 'running', 'finished'];

async function checkProfessionalConflict(
  tenantId: number,
  professionalId: number,
  scheduledAt: Date,
  excludeId?: number,
): Promise<boolean> {
  const conflict = await prisma.appointment.findFirst({
    where: {
      tenant_id: tenantId,
      professional_id: professionalId,
      scheduled_at: scheduledAt,
      status: { in: BLOCKS_SLOT },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  return !!conflict;
}

router.get('/', async (req, res) => {
  const { q, status, page = '1', limit, from, to } = req.query as Record<string, string>;
  const pageN = Math.max(1, Number(page) || 1);
  const limitN = capLimit(limit, 20);
  const offset = (pageN - 1) * limitN;
  const tf = tenantFilter(req.user);

  const where: Record<string, unknown> = { ...tf };
  if (req.user.role === 'professional') {
    where.professional_id = req.user.professional_id ?? -1;
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { client: { name: { contains: q, mode: 'insensitive' } } },
      { professional: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }
  if (status) where.status = status;
  if (from) where.scheduled_at = { ...(where.scheduled_at as object ?? {}), gte: new Date(from) };
  if (to) where.scheduled_at = { ...(where.scheduled_at as object ?? {}), lte: new Date(to) };

  const [total, rows] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      include: {
        client: { select: { name: true, phone: true } },
        professional: { select: { id: true, name: true } },
      },
      orderBy: { scheduled_at: 'desc' },
      skip: offset,
      take: limitN,
    }),
  ]);

  const data = rows.map((a) => ({
    ...a,
    client_name: a.client.name,
    client_phone: a.client.phone,
    professional_name: a.professional?.name ?? null,
  }));
  res.json({ data, total, page: pageN, pages: Math.ceil(total / limitN) });
});

router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id, 'Agendamento');
  const tf = tenantFilter(req.user);
  const professionalFilter = req.user.role === 'professional'
    ? { professional_id: req.user.professional_id ?? -1 }
    : {};
  const row = await prisma.appointment.findFirst({
    where: { id, ...tf, ...professionalFilter },
    include: {
      client: { select: { name: true, phone: true, email: true } },
      professional: { select: { id: true, name: true } },
    },
  });
  if (!row) return res.status(404).json({ error: 'Agendamento não encontrado' });
  res.json({
    ...row,
    client_name: row.client.name,
    client_phone: row.client.phone,
    client_email: row.client.email,
    professional_name: row.professional?.name ?? null,
  });
});

router.post('/', async (req, res) => {
  if (req.user.role === 'professional') return res.status(403).json({ error: 'Acesso não permitido' });
  const { client_id, title, description, scheduled_at, executor, professional_id } = req.body as Record<string, string>;
  if (!client_id || !title || !scheduled_at) {
    return res.status(400).json({ error: 'client_id, title e scheduled_at são obrigatórios' });
  }
  const tenantId = req.user.tenant_id;
  if (!tenantId) return res.status(403).json({ error: 'Operação não disponível para super admin nesta tela' });

  const client = await prisma.client.findFirst({ where: { id: Number(client_id), tenant_id: tenantId } });
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

  const scheduledAtDate = new Date(scheduled_at);
  if (scheduledAtDate <= new Date()) {
    return res.status(400).json({ error: 'Não é possível criar agendamentos em data/hora passada' });
  }

  if (professional_id) {
    const pid = Number(professional_id);
    const prof = await prisma.professional.findFirst({ where: { id: pid, tenant_id: tenantId } });
    if (!prof) return res.status(404).json({ error: 'Profissional não encontrado' });

    const hasConflict = await checkProfessionalConflict(tenantId, pid, scheduledAtDate);
    if (hasConflict) return res.status(409).json({ error: 'Profissional já possui agendamento neste horário' });
  }

  const r = await prisma.appointment.create({
    data: {
      tenant_id: tenantId,
      client_id: Number(client_id),
      professional_id: professional_id ? Number(professional_id) : null,
      title,
      description,
      scheduled_at: scheduledAtDate,
      executor,
    },
  });
  await logActivity(req, 'create', 'appointment', r.id, `Agendamento criado: ${title}`);
  res.status(201).json({ id: r.id });
});

router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id, 'Agendamento');
  const tf = tenantFilter(req.user);
  const app = await prisma.appointment.findFirst({ where: { id, ...tf } });
  if (!app) return res.status(404).json({ error: 'Agendamento não encontrado' });

  if (req.user.role === 'professional') {
    if (app.professional_id !== req.user.professional_id) {
      return res.status(403).json({ error: 'Você só pode editar seus próprios agendamentos' });
    }
  }

  const { title, description, scheduled_at, status, executor, result, professional_id } = req.body as Record<string, string>;
  if (status && !VALID_STATUS.includes(status)) return res.status(400).json({ error: 'Status inválido' });

  const newScheduledAt = scheduled_at ? new Date(scheduled_at) : app.scheduled_at;
  const dateActuallyChanged = scheduled_at != null && newScheduledAt.getTime() !== app.scheduled_at.getTime();
  if (dateActuallyChanged && newScheduledAt <= new Date()) {
    return res.status(400).json({ error: 'Não é possível agendar em data/hora passada' });
  }

  const newProfessionalId = professional_id !== undefined
    ? (professional_id ? Number(professional_id) : null)
    : app.professional_id;

  if (newProfessionalId) {
    const timeChanged = scheduled_at && new Date(scheduled_at).getTime() !== app.scheduled_at.getTime();
    const professionalChanged = professional_id !== undefined && Number(professional_id) !== app.professional_id;
    if (timeChanged || professionalChanged) {
      const tenantId = app.tenant_id;
      const hasConflict = await checkProfessionalConflict(tenantId, newProfessionalId, newScheduledAt, app.id);
      if (hasConflict) return res.status(409).json({ error: 'Profissional já possui agendamento neste horário' });
    }
  }

  // Verificar se houve alteração na data/hora
  const dateTimeChanged = dateActuallyChanged;
  
  // Se a data/hora mudou, voltar para status 'pending' e gerar novo token
  let newStatus = status ?? app.status;
  let confirmationToken = app.confirmation_token;
  
  if (dateTimeChanged) {
    newStatus = 'pending';
    // Gerar novo token se não existir
    if (!confirmationToken) {
      confirmationToken = await generateUniqueToken(async (token) => {
        const exists = await prisma.appointment.findUnique({
          where: { confirmation_token: token },
        });
        return !!exists;
      });
    }
  }

  const updatedAppointment = await prisma.appointment.update({
    where: { id: app.id },
    data: {
      title: title ?? app.title,
      description: description ?? app.description,
      scheduled_at: newScheduledAt,
      status: newStatus,
      executor: executor ?? app.executor,
      result: result ?? app.result,
      professional_id: newProfessionalId,
      confirmation_token: confirmationToken,
    },
    include: {
      client: true,
      service: true,
      professional: true,
    },
  });

  if (status && status !== app.status) {
    const labels: Record<string, string> = {
      pending: 'Pendente', scheduled: 'Agendado', running: 'Em Execução', finished: 'Finalizado',
      failed: 'Falhou', cancelled: 'Cancelado',
    };
    await logActivity(req, 'update', 'appointment', app.id, `Status alterado para ${labels[status]}`);
  }

  // Se a data/hora mudou, enviar nova mensagem de confirmação
  if (dateTimeChanged) {
    await logActivity(req, 'update', 'appointment', app.id, 'Data/hora alterada - nova confirmação enviada');
    
    // Enviar mensagem de WhatsApp (não-bloqueante)
    whatsappService.sendAppointmentConfirmation(app.tenant_id, {
      appointmentId: updatedAppointment.id,
      confirmationToken: confirmationToken!,
      clientName: updatedAppointment.client.name,
      clientPhone: updatedAppointment.client.phone,
      date: updatedAppointment.scheduled_at,
      serviceName: updatedAppointment.service?.name,
      professionalName: updatedAppointment.professional?.name,
    }, true).catch((err) => {
      // Log do erro mas não falha a requisição
      logger.error('[Appointments] Erro ao enviar WhatsApp após edição', {
        appointmentId: updatedAppointment.id,
        error: err.message,
      });
    });
  }
  
  res.json({ message: 'Agendamento atualizado' });
});

router.delete('/:id', async (req, res) => {
  if (req.user.role === 'professional') return res.status(403).json({ error: 'Acesso não permitido' });
  const id = parseId(req.params.id, 'Agendamento');
  const tf = tenantFilter(req.user);
  const app = await prisma.appointment.findFirst({ where: { id, ...tf } });
  if (!app) return res.status(404).json({ error: 'Agendamento não encontrado' });

  await prisma.appointment.delete({ where: { id: app.id } });
  await logActivity(req, 'delete', 'appointment', app.id, `Agendamento excluído: ${app.title}`);
  res.json({ message: 'Agendamento excluído' });
});

// Reenviar mensagem de confirmação WhatsApp
router.post('/:id/resend-whatsapp', async (req, res) => {
  const id = parseId(req.params.id, 'Agendamento');
  const tf = tenantFilter(req.user);

  try {
    const appointment = await prisma.appointment.findFirst({
      where: { id, ...tf },
      include: {
        client: true,
        service: true,
        professional: true,
      },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    if (req.user.role === 'professional' && appointment.professional_id !== req.user.professional_id) {
      return res.status(403).json({ error: 'Você só pode reenviar mensagens dos seus próprios agendamentos' });
    }

    // Verificar se tem telefone
    const phone = appointment.customer_phone || appointment.client?.phone;
    if (!phone) {
      return res.status(400).json({ error: 'Agendamento não possui telefone cadastrado' });
    }

    // Gerar novo token se não existir
    let confirmationToken = appointment.confirmation_token;
    if (!confirmationToken) {
      confirmationToken = await generateUniqueToken(async (token) => {
        const existing = await prisma.appointment.findUnique({
          where: { confirmation_token: token },
        });
        return !!existing;
      });
      
      // Atualizar agendamento com o novo token
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { confirmation_token: confirmationToken },
      });
    }

    // Enviar mensagem
    const sent = await whatsappService.sendAppointmentConfirmation(
      req.user.tenant_id!,
      {
        appointmentId: appointment.id,
        confirmationToken: confirmationToken,
        clientName: appointment.customer_name || appointment.client?.name || 'Cliente',
        clientPhone: phone,
        date: appointment.scheduled_at,
        serviceName: appointment.service?.name,
        professionalName: appointment.professional?.name,
      }
    );

    if (!sent) {
      return res.status(400).json({ 
        error: 'Não foi possível enviar a mensagem. Verifique se há uma instância WhatsApp conectada e se o envio está habilitado.' 
      });
    }

    await logActivity(
      req,
      'update',
      'appointment',
      appointment.id,
      `Mensagem WhatsApp reenviada para ${phone}`
    );

    res.json({ 
      message: 'Mensagem enviada com sucesso!',
      phone,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao enviar mensagem' });
  }
});

export default router;
