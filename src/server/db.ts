import { PrismaNeon } from '@prisma/adapter-neon';

import type { Prisma } from '#/generated/prisma/client';
import { PrismaClient } from '#/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV !== 'test') {
  throw new Error('DATABASE_URL is required');
}

const adapter = new PrismaNeon({ connectionString: connectionString ?? '' });

export const prisma = new PrismaClient({ adapter });

type DbClient = PrismaClient | Prisma.TransactionClient;
type CustomerWhere = Prisma.CustomerWhereInput;
type MaterialWhere = Prisma.MaterialWhereInput;
type PurchaseWhere = Prisma.PurchaseWhereInput;
type ServiceWhere = Prisma.ServiceWhereInput;
type VisitWhere = Prisma.VisitWhereInput;

function scopedCustomerWhere(userId: string, where?: CustomerWhere) {
  return {
    AND: [{ userId }, where ?? {}],
  };
}

function scopedMaterialWhere(userId: string, where?: MaterialWhere) {
  return {
    AND: [{ userId }, where ?? {}],
  };
}

function scopedPurchaseWhere(userId: string, where?: PurchaseWhere) {
  return {
    AND: [{ userId }, where ?? {}],
  };
}

function scopedServiceWhere(userId: string, where?: ServiceWhere) {
  return {
    AND: [{ userId }, where ?? {}],
  };
}

function scopedVisitWhere(userId: string, where?: VisitWhere) {
  return {
    AND: [{ userId }, where ?? {}],
  };
}

export function getScopedDb(userId: string, client: DbClient = prisma) {
  return {
    customer: {
      findMany: (args: Prisma.CustomerFindManyArgs = {}) =>
        client.customer.findMany({
          ...args,
          where: scopedCustomerWhere(userId, args.where),
        }),
      findFirst: (args: Prisma.CustomerFindFirstArgs = {}) =>
        client.customer.findFirst({
          ...args,
          where: scopedCustomerWhere(userId, args.where),
        }),
      create: (
        args: Omit<Prisma.CustomerCreateArgs, 'data'> & {
          data: Omit<Prisma.CustomerCreateInput, 'userId'>;
        },
      ) =>
        client.customer.create({
          ...args,
          data: { ...args.data, userId },
        }),
      update: (args: Prisma.CustomerUpdateArgs) =>
        client.customer.update({
          ...args,
          where: scopedCustomerWhere(
            userId,
            args.where as CustomerWhere,
          ) as any,
        }),
      delete: (args: Prisma.CustomerDeleteArgs) =>
        client.customer.delete({
          ...args,
          where: scopedCustomerWhere(
            userId,
            args.where as CustomerWhere,
          ) as any,
        }),
      upsert: (
        args: Omit<Prisma.CustomerUpsertArgs, 'create'> & {
          create: Omit<Prisma.CustomerCreateInput, 'userId'>;
        },
      ) =>
        client.customer.upsert({
          ...args,
          where: scopedCustomerWhere(
            userId,
            args.where as CustomerWhere,
          ) as any,
          create: { ...args.create, userId },
        }),
      updateMany: (args: Prisma.CustomerUpdateManyArgs) =>
        client.customer.updateMany({
          ...args,
          where: scopedCustomerWhere(userId, args.where),
        }),
      deleteMany: (args: Prisma.CustomerDeleteManyArgs = {}) =>
        client.customer.deleteMany({
          ...args,
          where: scopedCustomerWhere(userId, args.where),
        }),
    },
    material: {
      findMany: (args: Prisma.MaterialFindManyArgs = {}) =>
        client.material.findMany({
          ...args,
          where: scopedMaterialWhere(userId, args.where),
        }),
      findFirst: (args: Prisma.MaterialFindFirstArgs = {}) =>
        client.material.findFirst({
          ...args,
          where: scopedMaterialWhere(userId, args.where),
        }),
      create: (
        args: Omit<Prisma.MaterialCreateArgs, 'data'> & {
          data: Omit<Prisma.MaterialCreateInput, 'userId'>;
        },
      ) =>
        client.material.create({
          ...args,
          data: { ...args.data, userId },
        }),
      updateMany: (args: Prisma.MaterialUpdateManyArgs) =>
        client.material.updateMany({
          ...args,
          where: scopedMaterialWhere(userId, args.where),
        }),
      deleteMany: (args: Prisma.MaterialDeleteManyArgs = {}) =>
        client.material.deleteMany({
          ...args,
          where: scopedMaterialWhere(userId, args.where),
        }),
    },
    purchase: {
      findMany: (args: Prisma.PurchaseFindManyArgs = {}) =>
        client.purchase.findMany({
          ...args,
          where: scopedPurchaseWhere(userId, args.where),
        }),
      findFirst: (args: Prisma.PurchaseFindFirstArgs = {}) =>
        client.purchase.findFirst({
          ...args,
          where: scopedPurchaseWhere(userId, args.where),
        }),
      create: (
        args: Omit<Prisma.PurchaseCreateArgs, 'data'> & {
          data: Omit<Prisma.PurchaseUncheckedCreateInput, 'userId'>;
        },
      ) =>
        client.purchase.create({
          ...args,
          data: { ...args.data, userId },
        }),
      updateMany: (args: Prisma.PurchaseUpdateManyArgs) =>
        client.purchase.updateMany({
          ...args,
          where: scopedPurchaseWhere(userId, args.where),
        }),
      deleteMany: (args: Prisma.PurchaseDeleteManyArgs = {}) =>
        client.purchase.deleteMany({
          ...args,
          where: scopedPurchaseWhere(userId, args.where),
        }),
    },
    service: {
      findMany: (args: Prisma.ServiceFindManyArgs = {}) =>
        client.service.findMany({
          ...args,
          where: scopedServiceWhere(userId, args.where),
        }),
      findFirst: (args: Prisma.ServiceFindFirstArgs = {}) =>
        client.service.findFirst({
          ...args,
          where: scopedServiceWhere(userId, args.where),
        }),
      createMany: (
        args: Omit<Prisma.ServiceCreateManyArgs, 'data'> & {
          data:
            | Omit<Prisma.ServiceCreateManyInput, 'userId'>
            | Array<Omit<Prisma.ServiceCreateManyInput, 'userId'>>;
        },
      ) => {
        const rows = Array.isArray(args.data) ? args.data : [args.data];
        return client.service.createMany({
          ...args,
          data: rows.map((row) => ({ ...row, userId })),
        });
      },
      updateMany: (args: Prisma.ServiceUpdateManyArgs) =>
        client.service.updateMany({
          ...args,
          where: scopedServiceWhere(userId, args.where),
        }),
      deleteMany: (args: Prisma.ServiceDeleteManyArgs = {}) =>
        client.service.deleteMany({
          ...args,
          where: scopedServiceWhere(userId, args.where),
        }),
    },
    visit: {
      findMany: (args: Prisma.VisitFindManyArgs = {}) =>
        client.visit.findMany({
          ...args,
          where: scopedVisitWhere(userId, args.where),
        }),
      findFirst: (args: Prisma.VisitFindFirstArgs = {}) =>
        client.visit.findFirst({
          ...args,
          where: scopedVisitWhere(userId, args.where),
        }),
      create: (
        args: Omit<Prisma.VisitCreateArgs, 'data'> & {
          data: Omit<Prisma.VisitUncheckedCreateInput, 'userId' | 'lineItems'>;
        },
      ) =>
        client.visit.create({
          ...args,
          data: { ...args.data, userId },
        }),
      updateMany: (args: Prisma.VisitUpdateManyArgs) =>
        client.visit.updateMany({
          ...args,
          where: scopedVisitWhere(userId, args.where),
        }),
      deleteMany: (args: Prisma.VisitDeleteManyArgs = {}) =>
        client.visit.deleteMany({
          ...args,
          where: scopedVisitWhere(userId, args.where),
        }),
    },
  };
}

export function withScopedTransaction<T>(
  userId: string,
  callback: (
    db: ReturnType<typeof getScopedDb>,
    tx: Prisma.TransactionClient,
  ) => Promise<T>,
) {
  return prisma.$transaction((tx) => callback(getScopedDb(userId, tx), tx));
}
