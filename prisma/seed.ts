import { PrismaNeon } from '@prisma/adapter-neon';
import Decimal from 'decimal.js';

import { PrismaClient } from '../src/generated/prisma/client';
import { computeUnitCost } from '../src/domain/cost';
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

const seedVisits = [
  {
    customerName: 'Anna Virtanen',
    serviceName: 'service.color',
    date: '2026-05-10',
    priceCharged: '85',
    note: 'Seed color visit',
    items: [
      { materialName: 'Color cream', amount: '80' },
      { materialName: 'Cream developer', amount: '120' },
    ],
  },
  {
    customerName: 'Maria Korhonen',
    serviceName: 'service.cut',
    date: '2026-05-12',
    priceCharged: '40',
    note: null,
    items: [],
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

      const customers = await prisma.customer.findMany({
        where: {
          userId,
          name: { in: seedVisits.map((visit) => visit.customerName) },
        },
        select: { id: true, name: true },
      });
      const services = await prisma.service.findMany({
        where: {
          userId,
          name: { in: seedVisits.map((visit) => visit.serviceName) },
        },
        select: { id: true, name: true },
      });
      const visitMaterialNames = seedVisits.flatMap((visit) =>
        visit.items.map((item) => item.materialName),
      );
      const visitMaterials = await prisma.material.findMany({
        where: { userId, name: { in: visitMaterialNames } },
        select: { id: true, name: true },
      });

      for (const visit of seedVisits) {
        const customer = customers.find(
          (item) => item.name === visit.customerName,
        );
        const service = services.find(
          (item) => item.name === visit.serviceName,
        );

        if (!customer || !service) {
          continue;
        }

        const date = parseSeedDate(visit.date);
        const existing = await prisma.visit.findFirst({
          where: {
            userId,
            customerId: customer.id,
            serviceId: service.id,
            date,
            priceCharged: visit.priceCharged,
          },
          select: { id: true },
        });

        if (existing) {
          continue;
        }

        const lineItems = [];

        for (const item of visit.items) {
          const material = visitMaterials.find(
            (candidate) => candidate.name === item.materialName,
          );

          if (!material) {
            continue;
          }

          const purchases = await prisma.purchase.findMany({
            where: { userId, materialId: material.id },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          });
          const unitCost = computeUnitCost(purchases).toDecimalPlaces(6);

          lineItems.push({
            materialId: material.id,
            amount: item.amount,
            unitCost,
            totalCost: new Decimal(item.amount)
              .mul(unitCost)
              .toDecimalPlaces(4),
          });
        }

        await prisma.visit.create({
          data: {
            userId,
            customerId: customer.id,
            serviceId: service.id,
            date,
            priceCharged: visit.priceCharged,
            note: visit.note,
            lineItems: { create: lineItems },
          },
        });
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

await main();
