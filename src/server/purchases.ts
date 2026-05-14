import { createServerFn } from '@tanstack/react-start';

import type { MaterialCategory, UnitOfMeasure } from '#/shared/enums';
import {
  formatDateOnly,
  parseDateOnly,
  purchaseCreateSchema,
  purchaseIdSchema,
  purchaseUpdateSchema,
} from '#/shared/schemas/purchase';

export type PurchaseMaterialDto = {
  id: string;
  name: string;
  category: MaterialCategory;
  unitOfMeasure: UnitOfMeasure;
  isArchived: boolean;
};

export type PurchaseDto = {
  id: string;
  materialId: string;
  totalQuantity: string;
  totalPrice: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  material: PurchaseMaterialDto;
};

type PurchaseWithMaterial = {
  id: string;
  materialId: string;
  totalQuantity: { toString: () => string };
  totalPrice: { toString: () => string };
  date: Date;
  createdAt: Date;
  updatedAt: Date;
  material: {
    id: string;
    name: string;
    category: string;
    unitOfMeasure: string;
    isArchived: boolean;
  };
};

function toPurchaseDto(purchase: PurchaseWithMaterial): PurchaseDto {
  return {
    id: purchase.id,
    materialId: purchase.materialId,
    totalQuantity: purchase.totalQuantity.toString(),
    totalPrice: purchase.totalPrice.toString(),
    date: formatDateOnly(purchase.date),
    createdAt: purchase.createdAt.toISOString(),
    updatedAt: purchase.updatedAt.toISOString(),
    material: {
      id: purchase.material.id,
      name: purchase.material.name,
      category: purchase.material.category as MaterialCategory,
      unitOfMeasure: purchase.material.unitOfMeasure as UnitOfMeasure,
      isArchived: purchase.material.isArchived,
    },
  };
}

export const listPurchases = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);
    const purchases = (await db.purchase.findMany({
      include: { material: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })) as unknown as Array<PurchaseWithMaterial>;

    return purchases.map(toPurchaseDto);
  },
);

export const getPurchase = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => purchaseIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);
    const purchase = (await db.purchase.findFirst({
      where: { id: data.id },
      include: { material: true },
    })) as PurchaseWithMaterial | null;

    if (!purchase) {
      throw new Error('purchase.notFound');
    }

    return toPurchaseDto(purchase);
  });

export const createPurchase = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => purchaseCreateSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);
    const material = await db.material.findFirst({
      where: { id: data.materialId, isArchived: false },
      select: { id: true },
    });

    if (!material) {
      throw new Error('material.notFound');
    }

    const purchase = (await db.purchase.create({
      data: {
        materialId: data.materialId,
        totalQuantity: data.totalQuantity,
        totalPrice: data.totalPrice,
        date: parseDateOnly(data.date),
      },
      include: { material: true },
    })) as unknown as PurchaseWithMaterial;

    return toPurchaseDto(purchase);
  });

export const updatePurchase = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => purchaseUpdateSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { withScopedTransaction } = await import('./db');
    const userId = await requireServerUserId();

    return withScopedTransaction(userId, async (db) => {
      const current = await db.purchase.findFirst({
        where: { id: data.id },
        include: { material: true },
      });

      if (!current) {
        throw new Error('purchase.notFound');
      }

      if (data.materialId !== current.materialId) {
        const nextMaterial = await db.material.findFirst({
          where: { id: data.materialId, isArchived: false },
          select: { id: true },
        });

        if (!nextMaterial) {
          throw new Error('material.notFound');
        }
      }

      const result = await db.purchase.updateMany({
        where: { id: data.id },
        data: {
          materialId: data.materialId,
          totalQuantity: data.totalQuantity,
          totalPrice: data.totalPrice,
          date: parseDateOnly(data.date),
        },
      });

      if (result.count === 0) {
        throw new Error('purchase.notFound');
      }

      const purchase = (await db.purchase.findFirst({
        where: { id: data.id },
        include: { material: true },
      })) as PurchaseWithMaterial | null;

      if (!purchase) {
        throw new Error('purchase.notFound');
      }

      return toPurchaseDto(purchase);
    });
  });

export const deletePurchase = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => purchaseIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);
    const result = await db.purchase.deleteMany({ where: { id: data.id } });

    if (result.count === 0) {
      throw new Error('purchase.notFound');
    }

    return { ok: true };
  });
