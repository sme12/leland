import { createServerFn } from '@tanstack/react-start';

import {
  customerArchiveSchema,
  customerIdSchema,
  customerListQuerySchema,
  customerMutationSchema,
} from '#/shared/schemas/customer';

export type CustomerDto = {
  id: string;
  name: string;
  comment: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

function toCustomerDto(customer: {
  id: string;
  name: string;
  comment: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CustomerDto {
  return {
    ...customer,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

export const listCustomers = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => customerListQuerySchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);
    const customers = await db.customer.findMany({
      where: { isArchived: data?.archived ?? false },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });

    return customers.map(toCustomerDto);
  });

export const getCustomer = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => customerIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);
    const customer = await db.customer.findFirst({
      where: { id: data.id },
    });

    if (!customer) {
      throw new Error('customer.notFound');
    }

    return toCustomerDto(customer);
  });

export const createCustomer = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => customerMutationSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);
    const customer = await db.customer.create({
      data: {
        name: data.name,
        comment: data.comment ?? null,
      },
    });

    return toCustomerDto(customer);
  });

export const updateCustomer = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    customerMutationSchema.required({ id: true }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);
    const result = await db.customer.updateMany({
      where: { id: data.id },
      data: {
        name: data.name,
        comment: data.comment ?? null,
      },
    });

    if (result.count === 0) {
      throw new Error('customer.notFound');
    }

    const customer = await db.customer.findFirst({ where: { id: data.id } });

    if (!customer) {
      throw new Error('customer.notFound');
    }

    return toCustomerDto(customer);
  });

export const setCustomerArchived = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => customerArchiveSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);
    const result = await db.customer.updateMany({
      where: { id: data.id },
      data: { isArchived: data.isArchived },
    });

    if (result.count === 0) {
      throw new Error('customer.notFound');
    }

    return { ok: true };
  });
