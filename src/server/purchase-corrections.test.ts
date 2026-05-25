import Decimal from 'decimal.js';
import { describe, expect, it, vi } from 'vitest';

import type { UnitOfMeasure } from '#/shared/enums';
import type {
  CorrectPurchaseInput,
  PurchaseCorrectionValues,
} from '#/shared/schemas/purchase-correction';
import type { CorrectPurchaseDb } from './purchase-corrections';
import {
  PurchaseCorrectionError,
  correctPurchaseWithDependencies,
} from './purchase-corrections';

const USER_ID = 'user-stylist';

type MaterialFixture = {
  id: string;
  name: string;
  unitOfMeasure: UnitOfMeasure;
  isArchived: boolean;
};

type PurchaseFixture = {
  id: string;
  materialId: string;
  totalQuantity: string;
  totalPrice: string;
  date: string;
};

type HarnessLogger = {
  info: ReturnType<
    typeof vi.fn<(message?: unknown, ...optionalParams: unknown[]) => void>
  >;
};

type HarnessOptions = {
  beforeUpdateMany?: (api: HarnessApi) => void;
};

type HarnessApi = {
  updatePurchaseDirectly: (
    purchaseId: string,
    values: Partial<Omit<PurchaseFixture, 'id'>>,
  ) => void;
};

function material(overrides: Partial<MaterialFixture> & { id: string }) {
  return {
    name: overrides.id,
    unitOfMeasure: 'ml',
    isArchived: false,
    ...overrides,
  } satisfies MaterialFixture;
}

function purchase(overrides: Partial<PurchaseFixture> & { id: string }) {
  return {
    materialId: 'mat-color',
    totalQuantity: '360',
    totalPrice: '60.00',
    date: '2026-05-15',
    ...overrides,
  } satisfies PurchaseFixture;
}

function values(
  overrides: Partial<PurchaseCorrectionValues> = {},
): PurchaseCorrectionValues {
  return {
    materialId: 'mat-color',
    totalQuantity: '360',
    totalPrice: '60.00',
    date: '2026-05-15',
    ...overrides,
  };
}

function input(overrides: Partial<CorrectPurchaseInput> = {}) {
  return {
    purchaseId: 'p-1',
    expected: values(),
    replacement: values({ totalPrice: '74.40' }),
    ...overrides,
  } satisfies CorrectPurchaseInput;
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function decimalEquals(a: string, b: string) {
  return new Decimal(a).eq(b);
}

function createHarness(
  initialMaterials: Array<MaterialFixture> = [
    material({ id: 'mat-color', name: 'Koleston 7/0' }),
  ],
  initialPurchases: Array<PurchaseFixture> = [purchase({ id: 'p-1' })],
  options: HarnessOptions = {},
) {
  let materials = initialMaterials.map((record) => ({ ...record }));
  let purchases = initialPurchases.map((record) => ({ ...record }));
  let updateManyCount = 0;

  const logger: HarnessLogger = { info: vi.fn() };

  function createDb(
    getMaterials: () => Array<MaterialFixture>,
    getPurchases: () => Array<PurchaseFixture>,
  ): CorrectPurchaseDb {
    const api: HarnessApi = {
      updatePurchaseDirectly: (purchaseId, nextValues) => {
        const index = getPurchases().findIndex(
          (record) => record.id === purchaseId,
        );

        if (index !== -1) {
          getPurchases()[index] = {
            ...getPurchases()[index],
            ...nextValues,
          };
        }
      },
    };

    return {
      material: {
        findFirst: async (args) => {
          const found = getMaterials().find(
            (record) => record.id === args.where.id,
          );

          return found ? { ...found } : null;
        },
      },
      purchase: {
        findFirst: async (args) => {
          const found = getPurchases().find(
            (record) => record.id === args.where.id,
          );

          if (!found) {
            return null;
          }

          const foundMaterial = getMaterials().find(
            (record) => record.id === found.materialId,
          );

          return {
            id: found.id,
            materialId: found.materialId,
            totalQuantity: { toString: () => found.totalQuantity },
            totalPrice: { toString: () => found.totalPrice },
            date: new Date(`${found.date}T00:00:00.000Z`),
            material: { name: foundMaterial?.name ?? 'Unknown Material' },
          };
        },
        updateMany: async (args) => {
          updateManyCount += 1;
          options.beforeUpdateMany?.(api);

          const index = getPurchases().findIndex((record) => {
            if (record.id !== args.where.id) {
              return false;
            }

            if (
              args.where.materialId !== undefined &&
              record.materialId !== args.where.materialId
            ) {
              return false;
            }

            if (
              args.where.totalQuantity !== undefined &&
              !decimalEquals(record.totalQuantity, args.where.totalQuantity)
            ) {
              return false;
            }

            if (
              args.where.totalPrice !== undefined &&
              !decimalEquals(record.totalPrice, args.where.totalPrice)
            ) {
              return false;
            }

            return (
              args.where.date === undefined ||
              record.date === toIsoDate(args.where.date)
            );
          });

          if (index === -1) {
            return { count: 0 };
          }

          getPurchases()[index] = {
            id: getPurchases()[index].id,
            materialId: args.data.materialId,
            totalQuantity: args.data.totalQuantity,
            totalPrice: args.data.totalPrice,
            date: toIsoDate(args.data.date),
          };

          return { count: 1 };
        },
      },
    };
  }

  const db = createDb(
    () => materials,
    () => purchases,
  );

  return {
    deps: {
      db,
      logger,
      runTransaction: async <T>(
        callback: (db: CorrectPurchaseDb) => Promise<T>,
      ) => {
        const transactionMaterials = materials.map((record) => ({ ...record }));
        const transactionPurchases = purchases.map((record) => ({ ...record }));
        const transactionDb = createDb(
          () => transactionMaterials,
          () => transactionPurchases,
        );
        const result = await callback(transactionDb);

        materials = transactionMaterials;
        purchases = transactionPurchases;

        return result;
      },
    },
    getPurchases: () => purchases,
    getUpdateManyCount: () => updateManyCount,
    logger,
  };
}

async function getCorrectionError(
  promise: Promise<unknown>,
): Promise<PurchaseCorrectionError['correctionError']> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof PurchaseCorrectionError) {
      return error.correctionError;
    }

    throw error;
  }

  throw new Error('Expected PurchaseCorrectionError');
}

function correct(nextInput: CorrectPurchaseInput, harness = createHarness()) {
  return correctPurchaseWithDependencies(USER_ID, nextInput, harness.deps);
}

describe('correctPurchase', () => {
  it('corrects one Purchase total to the VAT-inclusive Receipt value', async () => {
    const harness = createHarness();

    const result = await correct(
      input({
        clientRequestId: 'req-correct-price',
        replacement: values({ totalPrice: '74.40' }),
      }),
      harness,
    );

    expect(result).toEqual({
      changed: true,
      purchase: {
        id: 'p-1',
        materialId: 'mat-color',
        materialName: 'Koleston 7/0',
        totalQuantity: '360',
        totalPrice: '74.40',
        date: '2026-05-15',
      },
    });
    expect(harness.getPurchases()[0]).toMatchObject({ totalPrice: '74.40' });
    expect(harness.logger.info).toHaveBeenCalledWith(
      'leland_correct_purchase called',
      {
        userId: USER_ID,
        clientRequestId: 'req-correct-price',
        purchaseId: 'p-1',
        replacementMaterialId: 'mat-color',
      },
    );

    const logPayload = JSON.stringify(harness.logger.info.mock.calls);

    expect(logPayload).not.toContain('360');
    expect(logPayload).not.toContain('60.00');
    expect(logPayload).not.toContain('74.40');
  });

  it('allows correction to an archived replacement Material', async () => {
    const harness = createHarness([
      material({ id: 'mat-color', name: 'Koleston 7/0' }),
      material({
        id: 'mat-archived',
        name: 'Discontinued shade',
        isArchived: true,
      }),
    ]);

    const result = await correct(
      input({
        replacement: values({
          materialId: 'mat-archived',
          totalPrice: '74.40',
        }),
      }),
      harness,
    );

    expect(result.changed).toBe(true);
    expect(result.purchase).toMatchObject({
      materialId: 'mat-archived',
      materialName: 'Discontinued shade',
    });
  });

  it('returns changed false without writing when the replacement already matches', async () => {
    const harness = createHarness();

    const result = await correct(
      input({
        expected: values(),
        replacement: values(),
      }),
      harness,
    );

    expect(result.changed).toBe(false);
    expect(harness.getUpdateManyCount()).toBe(0);
  });

  it('rejects stale expected values with the current Purchase snapshot', async () => {
    const harness = createHarness();

    const error = await getCorrectionError(
      correct(
        input({
          clientRequestId: 'req-stale',
          expected: values({ totalPrice: '1.00' }),
        }),
        harness,
      ),
    );

    expect(error).toEqual({
      code: 'stale_purchase',
      message:
        'Purchase changed since it was listed; reload it before correcting.',
      clientRequestId: 'req-stale',
      currentPurchase: {
        id: 'p-1',
        materialId: 'mat-color',
        materialName: 'Koleston 7/0',
        totalQuantity: '360',
        totalPrice: '60.00',
        date: '2026-05-15',
      },
    });
    expect(harness.getPurchases()[0].totalPrice).toBe('60.00');
  });

  it('keeps the transaction rolled back when a race makes the guarded update stale', async () => {
    const harness = createHarness(undefined, undefined, {
      beforeUpdateMany: (api) => {
        api.updatePurchaseDirectly('p-1', { totalPrice: '65.00' });
      },
    });

    const error = await getCorrectionError(correct(input(), harness));

    expect(error).toMatchObject({
      code: 'stale_purchase',
      currentPurchase: expect.objectContaining({ totalPrice: '65.00' }),
    });
    expect(harness.getPurchases()[0].totalPrice).toBe('60.00');
  });

  it('rejects missing or cross-Stylist Purchases', async () => {
    const error = await getCorrectionError(
      correct(input({ purchaseId: 'purchase-other' })),
    );

    expect(error).toMatchObject({
      code: 'purchase_not_found',
      message: 'Purchase id `purchase-other` does not belong to this Stylist.',
    });
  });

  it('rejects missing or cross-Stylist replacement Materials', async () => {
    const error = await getCorrectionError(
      correct(
        input({
          clientRequestId: 'req-missing-material',
          replacement: values({
            materialId: 'material-other',
            totalPrice: '74.40',
          }),
        }),
      ),
    );

    expect(error).toMatchObject({
      code: 'material_not_found',
      message: 'Material id `material-other` does not belong to this Stylist.',
      clientRequestId: 'req-missing-material',
    });
  });

  it('humanizes zod validation messages and includes the field path', async () => {
    const harness = createHarness();

    const error = await getCorrectionError(
      correctPurchaseWithDependencies(
        USER_ID,
        {
          clientRequestId: 'req-bad-price',
          purchaseId: 'p-1',
          expected: values(),
          replacement: values({ totalPrice: '74.401' }),
        },
        harness.deps,
      ),
    );

    expect(error).toMatchObject({
      code: 'validation_failed',
      clientRequestId: 'req-bad-price',
      message:
        'Invalid correction payload at replacement.totalPrice: must be a money decimal string with up to 2 decimal places',
    });
    expect(error.message).not.toMatch(/validation\./);
  });

  it('rejects fractional replacement quantities for piece Materials', async () => {
    const harness = createHarness([
      material({ id: 'mat-color', name: 'Koleston 7/0' }),
      material({
        id: 'mat-gloves',
        name: 'Gloves',
        unitOfMeasure: 'piece',
      }),
    ]);

    const error = await getCorrectionError(
      correct(
        input({
          replacement: values({
            materialId: 'mat-gloves',
            totalQuantity: '1.5',
            totalPrice: '74.40',
          }),
        }),
        harness,
      ),
    );

    expect(error).toMatchObject({
      code: 'validation_failed',
      message:
        "Invalid correction payload: unitOfMeasure:'piece' requires integer replacement totalQuantity.",
    });
    expect(harness.getPurchases()[0].materialId).toBe('mat-color');
  });

  it('allows duplicate-shaped corrections after confirmation', async () => {
    const harness = createHarness(
      [material({ id: 'mat-color', name: 'Koleston 7/0' })],
      [
        purchase({ id: 'p-1', totalPrice: '60.00' }),
        purchase({ id: 'p-2', totalPrice: '74.40' }),
      ],
    );

    const result = await correct(
      input({ replacement: values({ totalPrice: '74.40' }) }),
      harness,
    );

    expect(result.changed).toBe(true);
    expect(
      harness.getPurchases().filter((record) => record.totalPrice === '74.40'),
    ).toHaveLength(2);
  });
});
