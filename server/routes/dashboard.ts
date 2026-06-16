import { Prisma } from '../generated/prisma/client';
import prisma from '../lib/prisma';
import { createRouter } from '../lib/router';
import { tenantFilter, isSuperAdmin } from '../lib/tenantScope';
import { capLimit } from '../lib/validate';

const router = createRouter();

router.get('/stats', async (req, res) => {
  const tf = tenantFilter(req.user);
  const superAdmin = isSuperAdmin(req.user);
  const tenantId = req.user.tenant_id;

  const [totalClients, totalAppointments, byStatus] = await Promise.all([
    prisma.client.count({ where: { ...tf, active: true } }),
    prisma.appointment.count({ where: tf }),
    prisma.appointment.groupBy({ by: ['status'], where: tf, _count: { status: true } }),
  ]);

  const statusMap: Record<string, number> = { scheduled: 0, running: 0, finished: 0, failed: 0 };
  byStatus.forEach((r) => { statusMap[r.status] = r._count.status; });

  type DayCount = { day: string; count: bigint };
  const thirty_days_ago = new Date(Date.now() - 30 * 86_400_000);
  const tenantWhere = superAdmin
    ? Prisma.sql``
    : Prisma.sql`AND tenant_id = ${tenantId}`;

  const last30: DayCount[] = await prisma.$queryRaw`
    SELECT DATE(scheduled_at)::text as day, COUNT(*)::bigint as count
    FROM appointments
    WHERE scheduled_at >= ${thirty_days_ago} ${tenantWhere}
    GROUP BY DATE(scheduled_at)
    ORDER BY day ASC
  `;

  const isProfessional = req.user.role === 'professional';
  const upcomingWhere = isProfessional && req.user.professional_id
    ? { ...tf, status: 'scheduled', scheduled_at: { gte: new Date() }, professional_id: req.user.professional_id }
    : { ...tf, status: 'scheduled', scheduled_at: { gte: new Date() } };

  const [recentActivity, upcomingAppointments] = await Promise.all([
    isProfessional
      ? Promise.resolve([])
      : prisma.activityLog.findMany({
          where: tf,
          include: { user: { select: { name: true } } },
          orderBy: { created_at: 'desc' },
          take: 10,
        }),
    prisma.appointment.findMany({
      where: upcomingWhere,
      include: { client: { select: { name: true } } },
      orderBy: { scheduled_at: 'asc' },
      take: 5,
    }),
  ]);

  res.json({
    totalClients,
    totalAppointments,
    scheduled: statusMap.scheduled,
    running: statusMap.running,
    finished: statusMap.finished,
    failed: statusMap.failed,
    last30Days: last30.map((r) => ({ day: r.day, count: Number(r.count) })),
    recentActivity: (recentActivity as any[]).map((l) => ({ ...l, user_name: l.user?.name ?? null })),
    upcomingAppointments: upcomingAppointments.map((a) => ({ ...a, client_name: a.client.name })),
  });
});

router.get('/activity', async (req, res) => {
  if (req.user.role === 'professional') return res.status(403).json({ error: 'Acesso não permitido' });
  const { page = '1', limit } = req.query as Record<string, string>;
  const pageN = Math.max(1, Number(page) || 1);
  const limitN = capLimit(limit, 20);
  const tf = tenantFilter(req.user);

  const [total, rows] = await Promise.all([
    prisma.activityLog.count({ where: tf }),
    prisma.activityLog.findMany({
      where: tf,
      include: { user: { select: { name: true } } },
      orderBy: { created_at: 'desc' },
      skip: (pageN - 1) * limitN,
      take: limitN,
    }),
  ]);

  const data = rows.map((l) => ({ ...l, user_name: l.user?.name ?? null }));
  res.json({ data, total, page: pageN, pages: Math.ceil(total / limitN) });
});

export default router;
