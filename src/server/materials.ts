import { createServerFn } from '@tanstack/react-start';

import type { MaterialCategory, UnitOfMeasure } from '#/shared/enums';
import {
  materialArchiveSchema,
  materialCreateSchema,
  materialIdSchema,
  materialListQuerySchema,
  materialUpdateSchema,
} from '#/shared/schemas/material';
import { computeMaterialStockFields } from './material-stock';
import type {
  MaterialStockFields,
  MaterialStockSource,
} from './material-stock';

export type MaterialDto = {
  id: string;
  name: string;
  unitOfMeasure: UnitOfMeasure;
  category: MaterialCategory;
  isArchived: boolean;
  stock: MaterialStockFields;
  createdAt: string;
  updatedAt: string;
};

const materialStockInclude = {
  purchases: { select: { materialId: true, totalQuantity: true } },
  lineItems: { select: { materialId: true, amount: true } },
} as const;

function toMaterialDto(
  material: {
    id: string;
    name: string;
    unitOfMeasure: string;
    category: string;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
  } & Partial<MaterialStockSource>,
): MaterialDto {
  const stock = computeMaterialStockFields(material);

  return {
    id: material.id,
    name: material.name,
    isArchived: material.isArchived,
    unitOfMeasure: material.unitOfMeasure as UnitOfMeasure,
    category: material.category as MaterialCategory,
    stock,
    createdAt: material.createdAt.toISOString(),
    updatedAt: material.updatedAt.toISOString(),
  };
}

export const listMaterials = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => materialListQuerySchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);
    const materials = await db.material.findMany({
      where: { isArchived: data?.archived ?? false },
      include: materialStockInclude,
      orderBy: [{ category: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
    });

    return materials.map(toMaterialDto);
  });

export const getMaterial = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => materialIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);
    const material = await db.material.findFirst({
      where: { id: data.id, isArchived: false },
      include: materialStockInclude,
    });

    if (!material) {
      throw new Error('material.notFound');
    }

    return toMaterialDto(material);
  });

export const createMaterial = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => materialCreateSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);
    const material = await db.material.create({
      data: {
        name: data.name,
        unitOfMeasure: data.unitOfMeasure,
        category: data.category,
      },
    });

    return toMaterialDto(material);
  });

export const updateMaterial = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => materialUpdateSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);
    const result = await db.material.updateMany({
      where: { id: data.id, isArchived: false },
      data: {
        name: data.name,
        category: data.category,
      },
    });

    if (result.count === 0) {
      throw new Error('material.notFound');
    }

    const material = await db.material.findFirst({
      where: { id: data.id, isArchived: false },
      include: materialStockInclude,
    });

    if (!material) {
      throw new Error('material.notFound');
    }

    return toMaterialDto(material);
  });

export const setMaterialArchived = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => materialArchiveSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);
    const result = await db.material.updateMany({
      where: { id: data.id },
      data: { isArchived: data.isArchived },
    });

    if (result.count === 0) {
      throw new Error('material.notFound');
    }

    return { ok: true };
  });
