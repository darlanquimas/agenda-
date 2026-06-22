import { PrismaClient } from '../generated/prisma/client';

// O servidor (container) roda em UTC, mas agendamentos usam horário de Brasília
// como horário "ingênuo" (sem timezone). Sem isso, `new Date()` fica até 3h
// adiantado em relação ao horário local, escondendo horários futuros do dia atual.
const BUSINESS_TIMEZONE = process.env.BUSINESS_TIMEZONE || 'America/Sao_Paulo';

const nowInBusinessTz = (): Date => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
};

const toMin = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const toStr = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const bookedStartMin = (scheduledAt: Date): number => {
  const d = scheduledAt instanceof Date ? scheduledAt : new Date(String(scheduledAt));
  return d.getHours() * 60 + d.getMinutes();
};

const localDateStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface SlotResult {
  slots?: string[];
  service?: { id: number; name: string; duration_minutes: number; price: unknown };
  professional?: { id: number; name: string };
  error?: string;
  status?: number;
}

export interface ValidationResult {
  professional?: { id: number; name: string };
  service?: { id: number; name: string; duration_minutes: number; price: unknown };
  normalizedTime?: string;
  error?: string;
  status?: number;
}

export async function getAvailableSlots(
  prisma: PrismaClient,
  tenantId: number,
  professionalId: number | string,
  serviceId: number | string,
  date: string,
): Promise<SlotResult> {
  const pid = Number(professionalId);
  const sid = Number(serviceId);

  const now = nowInBusinessTz();

  if (date < localDateStr(now)) return { slots: [] };

  const service = await prisma.service.findFirst({ where: { id: sid, tenant_id: tenantId, active: true } });
  if (!service) return { error: 'Serviço não encontrado', status: 404 };

  const professional = await prisma.professional.findFirst({ where: { id: pid, tenant_id: tenantId, active: true } });
  if (!professional) return { error: 'Profissional não encontrado', status: 404 };

  const link = await prisma.professionalService.findFirst({ where: { professional_id: pid, service_id: sid } });
  if (!link) return { error: 'Serviço não disponível para este profissional', status: 400 };

  const weekday = new Date(date + 'T12:00:00').getDay();
  const periods = await prisma.availability.findMany({ where: { professional_id: pid, weekday, active: true } });
  if (!periods.length) return { slots: [] };

  const booked = await prisma.appointment.findMany({
    where: {
      tenant_id: tenantId,
      professional_id: pid,
      scheduled_at: {
        gte: new Date(date + 'T00:00:00'),
        lt: new Date(date + 'T23:59:59.999'),
      },
      status: { notIn: ['failed', 'cancelled'] },
    },
    include: { service: { select: { duration_minutes: true } } },
  });

  const dur = service.duration_minutes;
  const isToday = date === localDateStr(now);
  const currentMin = isToday ? now.getHours() * 60 + now.getMinutes() : -1;
  const slots: string[] = [];

  for (const period of periods) {
    const start = toMin(period.start_time);
    const end = toMin(period.end_time);
    for (let t = start; t + dur <= end; t += dur) {
      if (t <= currentMin) continue;
      const slotEnd = t + dur;
      const conflict = booked.some((b) => {
        const bs = bookedStartMin(b.scheduled_at);
        const be = bs + (b.service?.duration_minutes ?? 60);
        return t < be && slotEnd > bs;
      });
      if (!conflict) slots.push(toStr(t));
    }
  }

  return { slots, service, professional };
}

export async function validateBookingRequest(
  prisma: PrismaClient,
  tenantId: number,
  opts: { professional_id: number | string; service_id: number | string; date: string; time: string },
): Promise<ValidationResult> {
  const now = nowInBusinessTz();
  const scheduledAt = new Date(`${opts.date}T${opts.time}:00`);
  if (scheduledAt <= now) {
    return { error: 'Não é possível agendar em data/hora passada', status: 400 };
  }

  const slotResult = await getAvailableSlots(prisma, tenantId, opts.professional_id, opts.service_id, opts.date);
  if (slotResult.error) return { error: slotResult.error, status: slotResult.status };

  const normalizedTime = opts.time.length === 5 ? opts.time : opts.time.slice(0, 5);
  if (!slotResult.slots!.includes(normalizedTime)) {
    return { error: 'Horário indisponível', status: 409 };
  }

  return { professional: slotResult.professional, service: slotResult.service, normalizedTime };
}

export { toMin, toStr };
