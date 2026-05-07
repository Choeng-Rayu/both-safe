import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bothsafe?schema=public' });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.deal.update({
    where: { publicId: 'pbzukdvk5d' },
    data: { amount: 0.5 }
  });
  console.log('Updated deal pbzukdvk5d to $0.50');
}
main().finally(() => prisma.$disconnect());
