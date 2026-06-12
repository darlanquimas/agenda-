import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  console.log('🌱 Iniciando seed...');

  // Tenant Demo
  const demo = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: { name: 'Empresa Demo' },
    create: { name: 'Empresa Demo', slug: 'demo' },
  });
  console.log('✅ Tenant "Empresa Demo" criado');

  // Super Admin (sem tenant)
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
  console.log('✅ Super Admin criado (super@agendaplus.com / super123)');

  // Admin do tenant demo
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
  console.log('✅ Admin criado (admin@agendaplus.com / admin123)');

  console.log('\n🎉 Seed concluído com sucesso!');
  console.log('\n📋 Credenciais:');
  console.log('   Super Admin: super@agendaplus.com / super123');
  console.log('   Admin Demo:  admin@agendaplus.com / admin123');
}

main()
  .catch((error) => {
    console.error('❌ Erro ao executar seed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
