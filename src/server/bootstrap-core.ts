import { SERVICE_SEED } from '#/shared/serviceSeed';

import { getScopedDb } from './db';

export async function ensureUserBootstrappedForUser(userId: string) {
  const db = getScopedDb(userId);
  const result = await db.service.createMany({
    data: SERVICE_SEED.map((service) => ({
      name: service.name,
      defaultPrice: service.defaultPrice,
      displayOrder: service.displayOrder,
    })),
    skipDuplicates: true,
  });

  return { inserted: result.count > 0 };
}
