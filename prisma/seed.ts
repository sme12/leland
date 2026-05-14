import { PrismaNeon } from '@prisma/adapter-neon';

import { PrismaClient } from '../src/generated/prisma/client';
import { MATERIAL_SEED } from '../src/shared/materialSeed';
import { SERVICE_SEED } from '../src/shared/serviceSeed';

const userIds = (process.env.SEED_USER_IDS ?? '')
  .split(',')
  .map((userId) => userId.trim())
  .filter(Boolean);

const seedCustomers = [
  { name: 'Anna Virtanen', comment: 'Opening stock test client' },
  { name: 'Maria Korhonen', comment: null },
  { name: 'Elena Petrova', comment: 'Prefers evening visits' },
];

async function main() {
  if (userIds.length === 0) {
    console.log('SEED_USER_IDS is not set; no Leland seed data inserted.');
    return;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required to seed Leland data.');
  }

  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    for (const userId of userIds) {
      for (const customer of seedCustomers) {
        const existing = await prisma.customer.findFirst({
          where: { userId, name: customer.name },
          select: { id: true },
        });

        if (!existing) {
          await prisma.customer.create({
            data: {
              userId,
              name: customer.name,
              comment: customer.comment,
            },
          });
        }
      }

      for (const service of SERVICE_SEED) {
        await prisma.service.upsert({
          where: {
            userId_name: {
              userId,
              name: service.name,
            },
          },
          update: {},
          create: {
            userId,
            name: service.name,
            defaultPrice: service.defaultPrice,
            displayOrder: service.displayOrder,
          },
        });
      }

      for (const material of MATERIAL_SEED) {
        const existing = await prisma.material.findFirst({
          where: {
            userId,
            name: material.name,
            category: material.category,
            unitOfMeasure: material.unitOfMeasure,
          },
          select: { id: true },
        });

        if (!existing) {
          await prisma.material.create({
            data: {
              userId,
              name: material.name,
              category: material.category,
              unitOfMeasure: material.unitOfMeasure,
            },
          });
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

await main();
