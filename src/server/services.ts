import { createServerFn } from '@tanstack/react-start';

import { updateServiceDefaultPriceSchema } from '#/shared/schemas/service';

export type ServiceDto = {
  id: string;
  name: string;
  defaultPrice: string | null;
  displayOrder: number;
};

function toServiceDto(service: {
  id: string;
  name: string;
  defaultPrice: { toString: () => string } | null;
  displayOrder: number;
}): ServiceDto {
  return {
    id: service.id,
    name: service.name,
    defaultPrice: service.defaultPrice?.toString() ?? null,
    displayOrder: service.displayOrder,
  };
}

export const listServices = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { requireServerUserId } = await import('./auth');
    const { ensureUserBootstrappedForUser } = await import('./bootstrap-core');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    await ensureUserBootstrappedForUser(userId);
    const db = getScopedDb(userId);
    const services = await db.service.findMany({
      where: { isArchived: false },
      orderBy: { displayOrder: 'asc' },
    });

    return services.map(toServiceDto);
  },
);

export const updateServiceDefaultPrice = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    updateServiceDefaultPriceSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { withScopedTransaction } = await import('./db');
    const userId = await requireServerUserId();

    return withScopedTransaction(userId, async (db) => {
      const current = await db.service.findFirst({
        where: { id: data.id, isArchived: false },
        select: { defaultPrice: true },
      });

      if (!current) {
        throw new Error('service.notFound');
      }

      const result = await db.service.updateMany({
        where: { id: data.id, isArchived: false },
        data: { defaultPrice: data.price },
      });

      if (result.count === 0) {
        throw new Error('service.notFound');
      }

      const service = await db.service.findFirst({
        where: { id: data.id },
      });

      if (!service) {
        throw new Error('service.notFound');
      }

      return {
        service: toServiceDto(service),
        previousPrice: current.defaultPrice?.toString() ?? null,
      };
    });
  });
