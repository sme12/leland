import { createServerFn } from '@tanstack/react-start';
import Decimal from 'decimal.js';

import { computeUnitCost } from '#/domain/cost';
import type { MaterialCategory, UnitOfMeasure } from '#/shared/enums';
import { materialIdSchema } from '#/shared/schemas/material';
import { formatDateOnly, parseDateOnly } from '#/shared/schemas/purchase';
import {
  visitCreateSchema,
  visitIdSchema,
  visitUpdateServerSchema,
} from '#/shared/schemas/visit';
import {
  visitDraftCreateSchema,
  visitDraftDiscardSchema,
  visitDraftIdSchema,
  visitDraftPublishSchema,
  visitDraftUpdateServerSchema,
} from '#/shared/schemas/visit-draft';
import type { getScopedDb } from './db';

type DecimalLike = { toString: () => string };
type ScopedDb = ReturnType<typeof getScopedDb>;

export type VisitCustomerDto = {
  id: string;
  name: string;
  comment: string | null;
  isArchived: boolean;
};

export type VisitServiceDto = {
  id: string;
  name: string;
  defaultPrice: string | null;
  displayOrder: number;
  isArchived: boolean;
};

export type VisitMaterialDto = {
  id: string;
  name: string;
  unitOfMeasure: UnitOfMeasure;
  category: MaterialCategory;
  isArchived: boolean;
};

export type VisitLineItemDto = {
  id: string;
  materialId: string;
  amount: string;
  unitCost: string;
  totalCost: string;
  material: VisitMaterialDto;
};

export type VisitDto = {
  id: string;
  customerId: string;
  serviceId: string;
  date: string;
  priceCharged: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  customer: VisitCustomerDto;
  service: VisitServiceDto;
  lineItems: Array<VisitLineItemDto>;
  totalCost: string;
  net: string;
};

export type VisitMaterialEstimateDto = {
  id: string;
  materialId: string;
  amount: string;
  material: VisitMaterialPickerDto;
};

export type VisitDraftDto = {
  id: string;
  customerId: string;
  serviceId: string;
  date: string;
  estimatedPrice: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  customer: VisitCustomerDto;
  service: VisitServiceDto;
  materialEstimates: Array<VisitMaterialEstimateDto>;
};

export type VisitListRowDto = VisitDto & {
  recordType: 'visit';
};

export type VisitDraftListRowDto = Omit<VisitDraftDto, 'materialEstimates'> & {
  recordType: 'draft';
};

export type VisitOrDraftListRowDto = VisitListRowDto | VisitDraftListRowDto;

export type VisitMaterialPickerDto = VisitMaterialDto & {
  hasPurchases: boolean;
};

export type VisitMaterialNeedsPurchaseError = {
  code: 'material_needs_purchase';
  materialId: string;
};

const MATERIAL_NEEDS_PURCHASE_PREFIX = 'visit.materialNeedsPurchase:';

export function parseVisitServerError(
  message: string,
): VisitMaterialNeedsPurchaseError | null {
  if (!message.startsWith(MATERIAL_NEEDS_PURCHASE_PREFIX)) {
    return null;
  }

  const materialId = message.slice(MATERIAL_NEEDS_PURCHASE_PREFIX.length);

  return materialId ? { code: 'material_needs_purchase', materialId } : null;
}

type VisitRecord = {
  id: string;
  customerId: string;
  serviceId: string;
  date: Date;
  priceCharged: DecimalLike;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer: {
    id: string;
    name: string;
    comment: string | null;
    isArchived: boolean;
  };
  service: {
    id: string;
    name: string;
    defaultPrice: DecimalLike | null;
    displayOrder: number;
    isArchived: boolean;
  };
  lineItems: Array<{
    id: string;
    materialId: string;
    amount: DecimalLike;
    unitCost: DecimalLike;
    totalCost: DecimalLike;
    material: {
      id: string;
      name: string;
      unitOfMeasure: string;
      category: string;
      isArchived: boolean;
    };
  }>;
};

type VisitDraftBaseRecord = {
  id: string;
  customerId: string;
  serviceId: string;
  date: Date;
  estimatedPrice: DecimalLike | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer: {
    id: string;
    name: string;
    comment: string | null;
    isArchived: boolean;
  };
  service: {
    id: string;
    name: string;
    defaultPrice: DecimalLike | null;
    displayOrder: number;
    isArchived: boolean;
  };
};

type VisitDraftRecord = VisitDraftBaseRecord & {
  materialEstimates: Array<{
    id: string;
    materialId: string;
    amount: DecimalLike;
    material: {
      id: string;
      name: string;
      unitOfMeasure: string;
      category: string;
      isArchived: boolean;
      _count: { purchases: number };
    };
  }>;
};

const visitInclude = {
  customer: true,
  service: true,
  lineItems: {
    include: { material: true },
    orderBy: { createdAt: 'asc' },
  },
} as const;

const visitDraftListInclude = {
  customer: true,
  service: true,
} as const;

const visitDraftInclude = {
  customer: true,
  service: true,
  materialEstimates: {
    include: {
      material: {
        include: { _count: { select: { purchases: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} as const;

function toVisitDto(visit: VisitRecord): VisitDto {
  const totalCost = visit.lineItems.reduce(
    (total, item) => total.add(item.totalCost.toString()),
    new Decimal(0),
  );
  const priceCharged = new Decimal(visit.priceCharged.toString());

  return {
    id: visit.id,
    customerId: visit.customerId,
    serviceId: visit.serviceId,
    date: formatDateOnly(visit.date),
    priceCharged: visit.priceCharged.toString(),
    note: visit.note,
    createdAt: visit.createdAt.toISOString(),
    updatedAt: visit.updatedAt.toISOString(),
    customer: visit.customer,
    service: {
      ...visit.service,
      defaultPrice: visit.service.defaultPrice?.toString() ?? null,
    },
    lineItems: visit.lineItems.map((item) => ({
      id: item.id,
      materialId: item.materialId,
      amount: item.amount.toString(),
      unitCost: item.unitCost.toString(),
      totalCost: item.totalCost.toString(),
      material: {
        ...item.material,
        unitOfMeasure: item.material.unitOfMeasure as UnitOfMeasure,
        category: item.material.category as MaterialCategory,
      },
    })),
    totalCost: totalCost.toString(),
    net: priceCharged.minus(totalCost).toString(),
  };
}

function toVisitListRowDto(visit: VisitRecord): VisitListRowDto {
  return { ...toVisitDto(visit), recordType: 'visit' };
}

function toVisitDraftListRowDto(
  draft: VisitDraftBaseRecord,
): VisitDraftListRowDto {
  return {
    recordType: 'draft',
    id: draft.id,
    customerId: draft.customerId,
    serviceId: draft.serviceId,
    date: formatDateOnly(draft.date),
    estimatedPrice: draft.estimatedPrice?.toString() ?? null,
    note: draft.note,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
    customer: draft.customer,
    service: {
      ...draft.service,
      defaultPrice: draft.service.defaultPrice?.toString() ?? null,
    },
  };
}

function toVisitDraftDto(draft: VisitDraftRecord): VisitDraftDto {
  return {
    id: draft.id,
    customerId: draft.customerId,
    serviceId: draft.serviceId,
    date: formatDateOnly(draft.date),
    estimatedPrice: draft.estimatedPrice?.toString() ?? null,
    note: draft.note,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
    customer: draft.customer,
    service: {
      ...draft.service,
      defaultPrice: draft.service.defaultPrice?.toString() ?? null,
    },
    materialEstimates: draft.materialEstimates.map((item) => {
      const { _count, ...materialBase } = item.material;

      return {
        id: item.id,
        materialId: item.materialId,
        amount: item.amount.toString(),
        material: {
          ...materialBase,
          unitOfMeasure: materialBase.unitOfMeasure as UnitOfMeasure,
          category: materialBase.category as MaterialCategory,
          hasPurchases: _count.purchases > 0,
        },
      };
    }),
  };
}

function toPickerMaterialDto(material: {
  id: string;
  name: string;
  unitOfMeasure: string;
  category: string;
  isArchived: boolean;
  _count: { purchases: number };
}): VisitMaterialPickerDto {
  return {
    id: material.id,
    name: material.name,
    unitOfMeasure: material.unitOfMeasure as UnitOfMeasure,
    category: material.category as MaterialCategory,
    isArchived: material.isArchived,
    hasPurchases: material._count.purchases > 0,
  };
}

export const listVisits = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);
    const visits = (await db.visit.findMany({
      include: visitInclude,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })) as unknown as Array<VisitRecord>;

    return visits.map(toVisitDto);
  },
);

export const listVisitRows = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);
    const [visits, drafts] = await Promise.all([
      db.visit.findMany({
        include: visitInclude,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      db.visitDraft.findMany({
        include: visitDraftListInclude,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);
    const rows: Array<VisitOrDraftListRowDto> = [
      ...(visits as unknown as Array<VisitRecord>).map(toVisitListRowDto),
      ...(drafts as unknown as Array<VisitDraftBaseRecord>).map(
        toVisitDraftListRowDto,
      ),
    ];

    return rows.sort(compareVisitRows);
  },
);

export const getVisit = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => visitIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);
    const visit = (await db.visit.findFirst({
      where: { id: data.id },
      include: visitInclude,
    })) as unknown as VisitRecord | null;

    if (!visit) {
      throw new Error('visit.notFound');
    }

    return toVisitDto(visit);
  });

export const createVisitDraft = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => visitDraftCreateSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { withScopedTransaction } = await import('./db');
    const userId = await requireServerUserId();

    return withScopedTransaction(userId, async (db, tx) => {
      await ensureCustomer(db, data.customerId);
      await ensureService(db, data.serviceId);

      for (const item of data.items) {
        await ensureMaterial(db, item.materialId);
      }

      const draft = await db.visitDraft.create({
        data: {
          customerId: data.customerId,
          serviceId: data.serviceId,
          date: parseDateOnly(data.date),
          estimatedPrice: data.estimatedPrice,
          note: data.note ?? null,
        },
      });

      if (data.items.length > 0) {
        await tx.materialEstimate.createMany({
          data: data.items.map((item) => ({
            userId,
            visitDraftId: draft.id,
            materialId: item.materialId,
            amount: item.amount,
          })),
        });
      }

      const persisted = (await db.visitDraft.findFirst({
        where: { id: draft.id },
        include: visitDraftInclude,
      })) as unknown as VisitDraftRecord | null;

      if (!persisted) {
        throw new Error('visitDraft.notFound');
      }

      return toVisitDraftDto(persisted);
    });
  });

export const updateVisitDraft = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => visitDraftUpdateServerSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { withScopedTransaction } = await import('./db');
    const userId = await requireServerUserId();

    return withScopedTransaction(userId, async (db, tx) => {
      const current = (await db.visitDraft.findFirst({
        where: { id: data.id },
        include: visitDraftInclude,
      })) as unknown as VisitDraftRecord | null;

      if (!current) {
        throw new Error('visitDraft.notFound');
      }

      await ensureCustomer(
        db,
        data.customerId,
        data.customerId === current.customerId,
      );
      await ensureService(
        db,
        data.serviceId,
        data.serviceId === current.serviceId,
      );

      const currentEstimatesById = new Map(
        current.materialEstimates.map((item) => [item.id, item]),
      );
      const nextEstimates: Array<{
        id?: string;
        materialId: string;
        amount: string;
      }> = [];

      for (const item of data.items) {
        const existing = item.id ? currentEstimatesById.get(item.id) : null;

        await ensureMaterial(
          db,
          item.materialId,
          Boolean(existing && existing.materialId === item.materialId),
        );
        nextEstimates.push({
          id: existing?.id,
          materialId: item.materialId,
          amount: item.amount,
        });
      }

      const retainedIds = nextEstimates
        .map((item) => item.id)
        .filter((id): id is string => Boolean(id));
      const updateResult = await db.visitDraft.updateMany({
        where: { id: data.id, updatedAt: new Date(data.expectedUpdatedAt) },
        data: {
          customerId: data.customerId,
          serviceId: data.serviceId,
          date: parseDateOnly(data.date),
          estimatedPrice: data.estimatedPrice,
          note: data.note ?? null,
        },
      });

      if (updateResult.count === 0) {
        throw new Error('visitDraft.concurrentModification');
      }

      await tx.materialEstimate.deleteMany({
        where: {
          userId,
          visitDraftId: data.id,
          ...(retainedIds.length > 0 ? { id: { notIn: retainedIds } } : {}),
        },
      });

      for (const item of nextEstimates) {
        if (item.id) {
          await tx.materialEstimate.updateMany({
            where: { id: item.id, userId, visitDraftId: data.id },
            data: {
              materialId: item.materialId,
              amount: item.amount,
            },
          });
        } else {
          await tx.materialEstimate.create({
            data: {
              userId,
              visitDraftId: data.id,
              materialId: item.materialId,
              amount: item.amount,
            },
          });
        }
      }

      const persisted = (await db.visitDraft.findFirst({
        where: { id: data.id },
        include: visitDraftInclude,
      })) as unknown as VisitDraftRecord | null;

      if (!persisted) {
        throw new Error('visitDraft.notFound');
      }

      return toVisitDraftDto(persisted);
    });
  });

export const getVisitDraft = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => visitDraftIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);
    const draft = (await db.visitDraft.findFirst({
      where: { id: data.id },
      include: visitDraftInclude,
    })) as unknown as VisitDraftRecord | null;

    if (!draft) {
      throw new Error('visitDraft.notFound');
    }

    return toVisitDraftDto(draft);
  });

export const discardVisitDraft = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => visitDraftDiscardSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);
    const result = await db.visitDraft.deleteMany({
      where: { id: data.id, updatedAt: new Date(data.expectedUpdatedAt) },
    });

    if (result.count === 0) {
      throw new Error('visitDraft.notFound');
    }

    return { ok: true };
  });

export const publishVisitDraft = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => visitDraftPublishSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { withScopedTransaction } = await import('./db');
    const userId = await requireServerUserId();

    return withScopedTransaction(userId, async (db, tx) => {
      const draft = (await db.visitDraft.findFirst({
        where: { id: data.id },
        include: visitDraftInclude,
      })) as unknown as VisitDraftRecord | null;

      if (!draft) {
        throw new Error('visitDraft.notFound');
      }

      const visitInput = visitCreateSchema.parse({
        customerId: data.customerId,
        serviceId: data.serviceId,
        date: data.date,
        priceCharged: data.estimatedPrice,
        note: data.note,
        items: data.items.map((item) => ({
          materialId: item.materialId,
          amount: item.amount,
        })),
      });
      await ensureCustomer(
        db,
        visitInput.customerId,
        visitInput.customerId === draft.customerId,
      );
      await ensureService(
        db,
        visitInput.serviceId,
        visitInput.serviceId === draft.serviceId,
      );

      const currentEstimatesById = new Map(
        draft.materialEstimates.map((item) => [item.id, item]),
      );
      const lineItems: Array<{
        materialId: string;
        amount: string;
        unitCost: string;
        totalCost: string;
      }> = [];

      for (const item of data.items) {
        const existing = item.id ? currentEstimatesById.get(item.id) : null;

        lineItems.push({
          materialId: item.materialId,
          amount: item.amount,
          ...(await computeLockedCosts(db, item.materialId, item.amount, {
            allowArchived: Boolean(
              existing && existing.materialId === item.materialId,
            ),
          })),
        });
      }

      const visit = await db.visit.create({
        data: {
          customerId: visitInput.customerId,
          serviceId: visitInput.serviceId,
          date: parseDateOnly(visitInput.date),
          priceCharged: visitInput.priceCharged,
          note: visitInput.note ?? null,
        },
      });

      if (lineItems.length > 0) {
        await tx.visitLineItem.createMany({
          data: lineItems.map((item) => ({
            visitId: visit.id,
            materialId: item.materialId,
            amount: item.amount,
            unitCost: item.unitCost,
            totalCost: item.totalCost,
          })),
        });
      }

      const deleteResult = await db.visitDraft.deleteMany({
        where: {
          id: draft.id,
          updatedAt: new Date(data.expectedUpdatedAt),
        },
      });

      if (deleteResult.count === 0) {
        throw new Error('visitDraft.concurrentModification');
      }

      const persisted = (await db.visit.findFirst({
        where: { id: visit.id },
        include: visitInclude,
      })) as unknown as VisitRecord | null;

      if (!persisted) {
        throw new Error('visit.notFound');
      }

      return toVisitDto(persisted);
    });
  });

export const listMaterialsForPicker = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);
    const materials = (await db.material.findMany({
      where: { isArchived: false },
      include: { _count: { select: { purchases: true } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
    })) as unknown as Array<Parameters<typeof toPickerMaterialDto>[0]>;

    return materials.map(toPickerMaterialDto);
  },
);

export const getCurrentUnitCost = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => materialIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);

    return getUnitCostForMaterial(db, data.id);
  });

export const createVisit = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => visitCreateSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { withScopedTransaction } = await import('./db');
    const userId = await requireServerUserId();

    return withScopedTransaction(userId, async (db, tx) => {
      await ensureCustomer(db, data.customerId);
      await ensureService(db, data.serviceId);

      const lineItems: Array<{
        materialId: string;
        amount: string;
        unitCost: string;
        totalCost: string;
      }> = [];

      for (const item of data.items) {
        lineItems.push({
          materialId: item.materialId,
          amount: item.amount,
          ...(await computeLockedCosts(db, item.materialId, item.amount)),
        });
      }

      const visit = await db.visit.create({
        data: {
          customerId: data.customerId,
          serviceId: data.serviceId,
          date: parseDateOnly(data.date),
          priceCharged: data.priceCharged,
          note: data.note ?? null,
        },
      });

      if (lineItems.length > 0) {
        // visit_line_items has no user_id column; ownership is enforced
        // transitively via the just-created scoped visit row.
        await tx.visitLineItem.createMany({
          data: lineItems.map((item) => ({
            visitId: visit.id,
            materialId: item.materialId,
            amount: item.amount,
            unitCost: item.unitCost,
            totalCost: item.totalCost,
          })),
        });
      }

      const persisted = (await db.visit.findFirst({
        where: { id: visit.id },
        include: visitInclude,
      })) as unknown as VisitRecord | null;

      if (!persisted) {
        throw new Error('visit.notFound');
      }

      return toVisitDto(persisted);
    });
  });

export const updateVisit = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => visitUpdateServerSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { withScopedTransaction } = await import('./db');
    const userId = await requireServerUserId();

    return withScopedTransaction(userId, async (db, tx) => {
      const current = (await db.visit.findFirst({
        where: { id: data.id },
        include: visitInclude,
      })) as unknown as VisitRecord | null;

      if (!current) {
        throw new Error('visit.notFound');
      }

      await ensureCustomer(
        db,
        data.customerId,
        data.customerId === current.customerId,
      );
      await ensureService(
        db,
        data.serviceId,
        data.serviceId === current.serviceId,
      );

      const currentItemsById = new Map(
        current.lineItems.map((item) => [item.id, item]),
      );
      const nextItems: Array<{
        id?: string;
        materialId: string;
        amount: string;
        unitCost: string;
        totalCost: string;
      }> = [];

      for (const item of data.items) {
        const existing = item.id ? currentItemsById.get(item.id) : null;

        if (existing && existing.materialId === item.materialId) {
          const unitCost = existing.unitCost.toString();

          nextItems.push({
            id: existing.id,
            materialId: item.materialId,
            amount: item.amount,
            unitCost,
            totalCost: computeTotalCost(item.amount, unitCost),
          });
          continue;
        }

        nextItems.push({
          id: existing?.id,
          materialId: item.materialId,
          amount: item.amount,
          ...(await computeLockedCosts(db, item.materialId, item.amount)),
        });
      }
      const retainedIds = nextItems
        .map((item) => item.id)
        .filter((id): id is string => Boolean(id));

      const updateResult = await db.visit.updateMany({
        where: { id: data.id, updatedAt: new Date(data.expectedUpdatedAt) },
        data: {
          customerId: data.customerId,
          serviceId: data.serviceId,
          date: parseDateOnly(data.date),
          priceCharged: data.priceCharged,
          note: data.note ?? null,
        },
      });

      if (updateResult.count === 0) {
        throw new Error('visit.concurrentModification');
      }

      // tx.visitLineItem.* operates directly against the transaction client
      // because line items have no user_id column. Ownership is enforced via
      // the visitId filter against the already-verified scoped visit row.
      await tx.visitLineItem.deleteMany({
        where: {
          visitId: data.id,
          ...(retainedIds.length > 0 ? { id: { notIn: retainedIds } } : {}),
        },
      });

      for (const item of nextItems) {
        if (item.id) {
          await tx.visitLineItem.updateMany({
            where: { id: item.id, visitId: data.id },
            data: {
              materialId: item.materialId,
              amount: item.amount,
              unitCost: item.unitCost,
              totalCost: item.totalCost,
            },
          });
        } else {
          await tx.visitLineItem.create({
            data: {
              visitId: data.id,
              materialId: item.materialId,
              amount: item.amount,
              unitCost: item.unitCost,
              totalCost: item.totalCost,
            },
          });
        }
      }

      const persisted = (await db.visit.findFirst({
        where: { id: data.id },
        include: visitInclude,
      })) as unknown as VisitRecord | null;

      if (!persisted) {
        throw new Error('visit.notFound');
      }

      return toVisitDto(persisted);
    });
  });

export const deleteVisit = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => visitIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireServerUserId } = await import('./auth');
    const { getScopedDb } = await import('./db');
    const userId = await requireServerUserId();
    const db = getScopedDb(userId);
    const result = await db.visit.deleteMany({ where: { id: data.id } });

    if (result.count === 0) {
      throw new Error('visit.notFound');
    }

    return { ok: true };
  });

async function ensureCustomer(db: ScopedDb, id: string, allowArchived = false) {
  const customer = await db.customer.findFirst({
    where: allowArchived ? { id } : { id, isArchived: false },
    select: { id: true },
  });

  if (!customer) {
    throw new Error('customer.notFound');
  }
}

async function ensureService(db: ScopedDb, id: string, allowArchived = false) {
  const service = await db.service.findFirst({
    where: allowArchived ? { id } : { id, isArchived: false },
    select: { id: true },
  });

  if (!service) {
    throw new Error('service.notFound');
  }
}

async function ensureMaterial(db: ScopedDb, id: string, allowArchived = false) {
  const material = await db.material.findFirst({
    where: allowArchived ? { id } : { id, isArchived: false },
    select: { id: true },
  });

  if (!material) {
    throw new Error('material.notFound');
  }
}

async function computeLockedCosts(
  db: ScopedDb,
  materialId: string,
  amount: string,
  options: { allowArchived?: boolean } = {},
) {
  const unitCost = await getUnitCostForMaterial(db, materialId, {
    allowArchived: options.allowArchived,
    requirePurchases: true,
  });

  return {
    unitCost,
    totalCost: computeTotalCost(amount, unitCost),
  };
}

async function getUnitCostForMaterial(
  db: ScopedDb,
  materialId: string,
  options: { allowArchived?: boolean; requirePurchases?: boolean } = {},
) {
  const material = await db.material.findFirst({
    where: options.allowArchived
      ? { id: materialId }
      : { id: materialId, isArchived: false },
    select: { id: true },
  });

  if (!material) {
    throw new Error('material.notFound');
  }

  const purchases = await db.purchase.findMany({
    where: { materialId },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });

  if (options.requirePurchases && purchases.length === 0) {
    throw new Error(`visit.materialNeedsPurchase:${materialId}`);
  }

  return computeUnitCost(purchases).toDecimalPlaces(6).toString();
}

function computeTotalCost(amount: string, unitCost: string) {
  return new Decimal(amount).mul(unitCost).toDecimalPlaces(4).toString();
}

function compareVisitRows(
  left: VisitOrDraftListRowDto,
  right: VisitOrDraftListRowDto,
) {
  const dateComparison = right.date.localeCompare(left.date);

  return dateComparison === 0
    ? right.createdAt.localeCompare(left.createdAt)
    : dateComparison;
}
