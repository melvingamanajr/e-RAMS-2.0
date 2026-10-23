import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash, argon2id } from 'argon2';
const db = new PrismaClient();
async function seed() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) before seeding');
  await db.shift.upsert({ where: { name: 'Regular office hours' }, update: {}, create: { name: 'Regular office hours', startMinute: 480, endMinute: 1020, breakMinutes: 60, workDays: [1, 2, 3, 4, 5] } });
  await db.user.upsert({ where: { email }, update: {}, create: { email, name: 'System Administrator', role: 'ADMIN', passwordHash: await hash(password, { type: argon2id }) } });
  console.log('Initial administrator and regular shift are ready. Existing credentials were preserved.');
}
seed().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
