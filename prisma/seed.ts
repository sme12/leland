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

const seedPurchases = [
  {
    materialName: 'Color cream',
    totalQuantity: '500',
    totalPrice: '58',
    date: '2026-05-01',
  },
  {
    materialName: 'Cream developer',
    totalQuantity: '1000',
    totalPrice: '24',
    date: '2026-05-02',
  },
  {
    materialName: 'Lightening powder',
    totalQuantity: '450',
    totalPrice: '32',
    date: '2026-05-03',
  },
  {
    materialName: 'Tint brush',
    totalQuantity: '3',
    totalPrice: '12',
    date: '2026-05-04',
  },
];

function parseSeedDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

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

      await prisma.material.createMany({
        data: MATERIAL_SEED.map((material) => ({
          userId,
          name: material.name,
          category: material.category,
          unitOfMeasure: material.unitOfMeasure,
        })),
        skipDuplicates: true,
      });

      const materials = await prisma.material.findMany({
        where: {
          userId,
          name: { in: seedPurchases.map((purchase) => purchase.materialName) },
        },
        select: { id: true, name: true },
      });

      for (const purchase of seedPurchases) {
        const material = materials.find(
          (item) => item.name === purchase.materialName,
        );

        if (!material) {
          continue;
        }

        const date = parseSeedDate(purchase.date);
        const existing = await prisma.purchase.findFirst({
          where: {
            userId,
            materialId: material.id,
            date,
            totalQuantity: purchase.totalQuantity,
            totalPrice: purchase.totalPrice,
          },
          select: { id: true },
        });

        if (!existing) {
          await prisma.purchase.create({
            data: {
              userId,
              materialId: material.id,
              totalQuantity: purchase.totalQuantity,
              totalPrice: purchase.totalPrice,
              date,
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
