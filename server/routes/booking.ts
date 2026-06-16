import prisma from '../lib/prisma';
import { createRouter } from '../lib/router';
import { markPublic } from '../middleware/publicRoute';
import { getAvailableSlots, validateBookingRequest } from '../services/bookingValidation';
import whatsappService from '../services/whatsappService';
import { generateUniqueToken } from '../lib/tokenGenerator';
import { sanitizePhone } from '../lib/validate';
import config from '../config';

const router = createRouter();

router.get('/professionals', ...markPublic(async (req, res) => {
  const tenantId = req.tenantId;
  const rows = await prisma.professional.findMany({
    where: { tenant_id: tenantId, active: true },
    orderBy: { name: 'asc' },
  });
  const result = await Promise.all(rows.map(async (p) => {
    const specialties = await prisma.specialty.findMany({
      where: { professionals: { some: { professional_id: p.id } }, tenant_id: tenantId },
      select: { id: true, name: true, description: true },
    });
    return { id: p.id, name: p.name, bio: p.bio, specialties };
  }));
  res.json(result);
}));

router.get('/professionals/:id/services', ...markPublic(async (req, res) => {
  const tenantId = req.tenantId;
  const p = await prisma.professional.findFirst({ where: { id: Number(req.params.id), tenant_id: tenantId, active: true } });
  if (!p) return res.status(404).json({ error: 'Profissional não encontrado' });

  const services = await prisma.service.findMany({
    where: { professionals: { some: { professional_id: p.id } }, tenant_id: tenantId, active: true },
    orderBy: { name: 'asc' },
  });
  res.json(services);
}));

router.get('/professionals/:id/availability', ...markPublic(async (req, res) => {
  const tenantId = req.tenantId;
  const p = await prisma.professional.findFirst({ where: { id: Number(req.params.id), tenant_id: tenantId, active: true } });
  if (!p) return res.status(404).json({ error: 'Profissional não encontrado' });

  const avail = await prisma.availability.findMany({ where: { professional_id: p.id, active: true }, select: { weekday: true } });
  res.json([...new Set(avail.map((a) => a.weekday))]);
}));

router.get('/slots', ...markPublic(async (req, res) => {
  const { professionalId, serviceId, date } = req.query as Record<string, string>;
  if (!professionalId || !serviceId || !date) {
    return res.status(400).json({ error: 'professionalId, serviceId e date são obrigatórios' });
  }
  const result = await getAvailableSlots(prisma, req.tenantId, professionalId, serviceId, date);
  if (result.error) return res.status(result.status!).json({ error: result.error });
  res.json(result.slots);
}));

router.post('/', ...markPublic(async (req, res) => {
  const tenantId = req.tenantId;
  const { professional_id, service_id, date, time, customer_name, customer_email, customer_phone, notes } = req.body as Record<string, string | number>;

  if (!professional_id || !service_id || !date || !time || !customer_name) {
    return res.status(400).json({ error: 'professional_id, service_id, date, time e customer_name são obrigatórios' });
  }

  const validation = await validateBookingRequest(prisma, tenantId, { professional_id, service_id, date: String(date), time: String(time) });
  if (validation.error) return res.status(validation.status!).json({ error: validation.error });

  const { professional, service, normalizedTime } = validation;
  const scheduled_at = new Date(`${date}T${normalizedTime}:00`);
  const title = `${service!.name} — ${customer_name}`;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const slotCheck = await validateBookingRequest(tx as any, tenantId, {
        professional_id,
        service_id,
        date: String(date),
        time: normalizedTime!,
      });
      if (slotCheck.error) {
        const err = new Error(slotCheck.error) as Error & { status: number };
        err.status = slotCheck.status!;
        throw err;
      }

      const sanitizedPhone = sanitizePhone(customer_phone ? String(customer_phone) : null);

      let client = sanitizedPhone
        ? await tx.client.findFirst({ where: { phone: sanitizedPhone, tenant_id: tenantId } })
        : null;

      if (!client && customer_email) {
        client = await tx.client.findFirst({ where: { email: String(customer_email), tenant_id: tenantId } });
      }

      if (!client) {
        client = await tx.client.create({
          data: { tenant_id: tenantId, name: String(customer_name), email: customer_email ? String(customer_email) : null, phone: sanitizedPhone },
        });
      }

      // Gerar token único para confirmação
      const confirmationToken = await generateUniqueToken(async (token) => {
        const existing = await tx.appointment.findUnique({
          where: { confirmation_token: token },
        });
        return !!existing;
      });

      // Calcular data de expiração do token (padrão: 48h)
      const tokenExpiresAt = new Date();
      tokenExpiresAt.setHours(tokenExpiresAt.getHours() + config.confirmationTokenExpirationHours);

      const appt = await tx.appointment.create({
        data: {
          tenant_id: tenantId,
          client_id: client.id,
          professional_id: Number(professional_id),
          service_id: Number(service_id),
          title,
          description: notes ? String(notes) : null,
          scheduled_at,
          status: 'pending', // Agendamento pendente de confirmação
          customer_name: String(customer_name),
          customer_email: customer_email ? String(customer_email) : null,
          customer_phone: customer_phone ? String(customer_phone) : null,
          confirmation_token: confirmationToken,
          confirmation_token_expires_at: tokenExpiresAt,
        },
      });

      await tx.activityLog.create({
        data: { tenant_id: tenantId, action: 'create', entity: 'appointment', entity_id: appt.id, details: `Agendamento público: ${title}` },
      });

      return { 
        id: appt.id, 
        scheduled_at: appt.scheduled_at,
        confirmation_token: appt.confirmation_token,
      };
    });

    // Enviar mensagem de confirmação via WhatsApp (não bloqueia o fluxo)
    if (customer_phone) {
      whatsappService.sendAppointmentConfirmation(tenantId, {
        appointmentId: result.id,
        confirmationToken: result.confirmation_token!,
        clientName: String(customer_name),
        clientPhone: String(customer_phone),
        date: scheduled_at,
        serviceName: service!.name,
        professionalName: professional!.name,
      }).catch((error) => {
        console.error('[Booking] Erro ao enviar confirmação WhatsApp:', error);
      });
    }

    res.status(201).json({
      id: result.id,
      professional: professional!.name,
      service: service!.name,
      scheduled_at: result.scheduled_at,
      customer_name,
    });
  } catch (err: any) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
}));

export default router;
