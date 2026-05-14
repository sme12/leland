import { PrismaNeon } from '@prisma/adapter-neon';

import type { Prisma } from '#/generated/prisma/client';
import { PrismaClient } from '#/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV !== 'test') {
  console.warn('DATABASE_URL is not set; database calls will fail.');
}

const adapter = new PrismaNeon({ connectionString: connectionString ?? '' });

export const prisma = new PrismaClient({ adapter });

type DbClient = PrismaClient | Prisma.TransactionClient;
type CustomerWhere = Prisma.CustomerWhereInput;
type ServiceWhere = Prisma.ServiceWhereInput;

function scopedCustomerWhere(userId: string, where?: CustomerWhere) {
  return {
    AND: [{ userId }, where ?? {}],
  };
}

function scopedServiceWhere(userId: string, where?: ServiceWhere) {
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
