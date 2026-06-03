import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const demo = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { name: 'Demonstração', slug: 'demo' },
  });

  await prisma.user.upsert({
    where: { email: 'super@agendaplus.com' },
    update: { role: 'super_admin', tenant_id: null, active: true },
    create: {
      name: 'Super Admin',
      email: 'super@agendaplus.com',
      password: bcrypt.hashSync('super123', 10),
      role: 'super_admin',
      active: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@agendaplus.com' },
    update: { role: 'admin', tenant_id: demo.id, active: true },
    create: {
      name: 'Administrador',
      email: 'admin@agendaplus.com',
      password: bcrypt.hashSync('admin123', 10),
      role: 'admin',
      tenant_id: demo.id,
      active: true,
    },
  });

  const clientCount = await prisma.client.count({ where: { tenant_id: demo.id } });
  if (clientCount > 0) return;

  const [c1, c2, c3, c4, c5] = await Promise.all([
    prisma.client.create({ data: { tenant_id: demo.id, name: 'João Silva', email: 'joao@email.com', phone: '(11) 99999-1111', document: '123.456.789-00' } }),
    prisma.client.create({ data: { tenant_id: demo.id, name: 'Maria Souza', email: 'maria@email.com', phone: '(21) 98888-2222', document: '987.654.321-00' } }),
    prisma.client.create({ data: { tenant_id: demo.id, name: 'Carlos Oliveira', email: 'carlos@email.com', phone: '(31) 97777-3333', document: '111.222.333-44' } }),
    prisma.client.create({ data: { tenant_id: demo.id, name: 'Ana Lima', email: 'ana@email.com', phone: '(41) 96666-4444', document: '555.666.777-88' } }),
    prisma.client.create({ data: { tenant_id: demo.id, name: 'Pedro Santos', email: 'pedro@email.com', phone: '(51) 95555-5555', document: '999.888.777-66' } }),
  ]);

  const [s1, s2, s3, s4] = await Promise.all([
    prisma.specialty.create({ data: { tenant_id: demo.id, name: 'Desenvolvimento Web', description: 'Criação e manutenção de sites e sistemas web' } }),
    prisma.specialty.create({ data: { tenant_id: demo.id, name: 'Design Gráfico', description: 'Identidade visual, UI/UX e materiais gráficos' } }),
    prisma.specialty.create({ data: { tenant_id: demo.id, name: 'Marketing Digital', description: 'Estratégias de marketing em canais digitais' } }),
    prisma.specialty.create({ data: { tenant_id: demo.id, name: 'Consultoria em TI', description: 'Análise e consultoria de infraestrutura e processos' } }),
  ]);

  const [sv1, sv2, sv3, sv4, sv5] = await Promise.all([
    prisma.service.create({ data: { tenant_id: demo.id, name: 'Consultoria Inicial', description: 'Reunião de análise de necessidades e proposta', duration_minutes: 60, price: 150 } }),
    prisma.service.create({ data: { tenant_id: demo.id, name: 'Desenvolvimento de Site', description: 'Criação ou reforma de site institucional', duration_minutes: 120, price: 350 } }),
    prisma.service.create({ data: { tenant_id: demo.id, name: 'Design de Identidade', description: 'Criação de logo, paleta e tipografia', duration_minutes: 90, price: 250 } }),
    prisma.service.create({ data: { tenant_id: demo.id, name: 'Gestão de Redes Sociais', description: 'Planejamento e criação de conteúdo mensal', duration_minutes: 60, price: 200 } }),
    prisma.service.create({ data: { tenant_id: demo.id, name: 'Treinamento e Capacitação', description: 'Treinamento presencial ou remoto por sessão', duration_minutes: 120, price: 300 } }),
  ]);

  const [p1, p2, p3] = await Promise.all([
    prisma.professional.create({ data: { tenant_id: demo.id, name: 'Ana Rodrigues', email: 'ana.rodrigues@agendaplus.com', phone: '(11) 91111-0001', bio: 'Desenvolvedora full-stack com 8 anos de experiência em projetos web escaláveis.' } }),
    prisma.professional.create({ data: { tenant_id: demo.id, name: 'Carlos Mendes', email: 'carlos.mendes@agendaplus.com', phone: '(11) 91111-0002', bio: 'Designer criativo especializado em branding e experiências digitais memoráveis.' } }),
    prisma.professional.create({ data: { tenant_id: demo.id, name: 'Paula Costa', email: 'paula.costa@agendaplus.com', phone: '(11) 91111-0003', bio: 'Especialista em marketing digital com foco em crescimento orgânico e campanhas de alto impacto.' } }),
  ]);

  await prisma.professionalSpecialty.createMany({
    data: [
      { professional_id: p1.id, specialty_id: s1.id },
      { professional_id: p1.id, specialty_id: s4.id },
      { professional_id: p2.id, specialty_id: s2.id },
      { professional_id: p2.id, specialty_id: s1.id },
      { professional_id: p3.id, specialty_id: s3.id },
      { professional_id: p3.id, specialty_id: s4.id },
    ],
  });

  await prisma.professionalService.createMany({
    data: [
      { professional_id: p1.id, service_id: sv1.id },
      { professional_id: p1.id, service_id: sv2.id },
      { professional_id: p1.id, service_id: sv5.id },
      { professional_id: p2.id, service_id: sv1.id },
      { professional_id: p2.id, service_id: sv3.id },
      { professional_id: p3.id, service_id: sv1.id },
      { professional_id: p3.id, service_id: sv4.id },
      { professional_id: p3.id, service_id: sv5.id },
    ],
  });

  const weekdays = [1, 2, 3, 4, 5];
  for (const pid of [p1.id, p2.id, p3.id]) {
    await prisma.availability.createMany({
      data: weekdays.map((wd) => ({ tenant_id: demo.id, professional_id: pid, weekday: wd, start_time: '08:00', end_time: '18:00' })),
    });
  }

  const now = new Date();
  const d = (offsetDays: number) => new Date(now.getTime() + offsetDays * 86_400_000);
  await prisma.appointment.createMany({
    data: [
      { tenant_id: demo.id, client_id: c1.id, title: 'Manutenção Preventiva', description: 'Revisão completa', scheduled_at: d(-3), status: 'finished', executor: 'Técnico A' },
      { tenant_id: demo.id, client_id: c2.id, title: 'Atualização de Software', description: 'Deploy versão 2.1', scheduled_at: d(-2), status: 'finished', executor: 'Técnico B' },
      { tenant_id: demo.id, client_id: c3.id, title: 'Instalação de Equipamento', description: 'Novo servidor', scheduled_at: d(-1), status: 'failed', executor: 'Técnico C' },
      { tenant_id: demo.id, client_id: c4.id, title: 'Consulta Técnica', description: 'Análise de infra', scheduled_at: d(0), status: 'running', executor: 'Técnico A' },
      { tenant_id: demo.id, client_id: c5.id, title: 'Backup de Dados', description: 'Backup mensal', scheduled_at: d(1), status: 'scheduled' },
      { tenant_id: demo.id, client_id: c1.id, title: 'Treinamento', description: 'Capacitação', scheduled_at: d(2), status: 'scheduled' },
      { tenant_id: demo.id, client_id: c2.id, title: 'Suporte Remoto', description: 'Chamado #445', scheduled_at: d(3), status: 'scheduled' },
    ],
  });

  console.log('Seed concluído.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
