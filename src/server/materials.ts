import { createServerFn } from '@tanstack/react-start';

import type { MaterialCategory, UnitOfMeasure } from '#/shared/enums';
import {
  materialArchiveSchema,
  materialCreateSchema,
  materialIdSchema,
  materialListQuerySchema,
  materialUpdateSchema,
} from '#/shared/schemas/material';

export type MaterialDto = {
  id: string;
  name: string;
  unitOfMeasure: UnitOfMeasure;
  category: MaterialCategory;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

function toMaterialDto(material: {
  id: string;
  name: string;
  unitOfMeasure: string;
  category: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}): MaterialDto {
  return {
    ...material,
    unitOfMeasure: material.unitOfMeasure as UnitOfMeasure,
    category: material.category as MaterialCategory,
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
