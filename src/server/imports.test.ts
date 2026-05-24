import { describe, expect, it, vi } from 'vitest';

import type { MaterialCategory, UnitOfMeasure } from '#/shared/enums';
import type { CommitImportInput } from '#/shared/schemas/import';
import { commitImportInputSchema } from '#/shared/schemas/import';
import type { CommitImportDb } from './imports';
import { ImportCommitError, commitImportWithDependencies } from './imports';

const USER_ID = 'user-stylist';

type MaterialFixture = {
  id: string;
  name: string;
  category: MaterialCategory;
  unitOfMeasure: UnitOfMeasure;
  isArchived: boolean;
  createdAt: Date;
};

type PurchaseFixture = {
  id: string;
  materialId: string;
  totalQuantity: string;
  totalPrice: string;
  date: string;
};

type MaterialCreateData = Parameters<
  CommitImportDb['material']['create']
>[0]['data'];

type HarnessLogger = {
  info: ReturnType<
    typeof vi.fn<(message?: unknown, ...optionalParams: unknown[]) => void>
  >;
  warn: ReturnType<
    typeof vi.fn<(message?: unknown, ...optionalParams: unknown[]) => void>
  >;
};

type HarnessOptions = {
  onMaterialCreate?: (data: MaterialCreateData, api: HarnessApi) => void;
};

type HarnessApi = {
  addBaseMaterial: (material: MaterialFixture) => void;
};

function material(
  overrides: Partial<MaterialFixture> & { id: string; name: string },
) {
  return {
    category: 'color',
    unitOfMeasure: 'ml',
    isArchived: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } satisfies MaterialFixture;
}

function newItem(
  overrides: Partial<
    Extract<CommitImportInput['items'][number], { kind: 'new' }>
  >,
) {
  return {
    kind: 'new',
    material: {
      name: 'New Color',
      category: 'color',
      unitOfMeasure: 'ml',
    },
    totalQuantity: '120',
    totalPrice: '42.50',
    ...overrides,
  } satisfies CommitImportInput['items'][number];
}

function existingItem(
  materialId: string,
  overrides: Partial<
    Extract<CommitImportInput['items'][number], { kind: 'existing' }>
  > = {},
) {
  return {
    kind: 'existing',
    materialId,
    totalQuantity: '120',
    totalPrice: '42.50',
    ...overrides,
  } satisfies CommitImportInput['items'][number];
}

function p2002(
  target: unknown = ['userId', 'name', 'category', 'unitOfMeasure'],
) {
  const error = new Error('Unique constraint failed') as Error & {
    code: string;
    meta: Record<string, unknown>;
  };

  error.code = 'P2002';
  error.meta = { target };

  return error;
}

function sortMaterials(records: Array<MaterialFixture>) {
  return records.slice().sort((a, b) => {
    const category = a.category.localeCompare(b.category);

    if (category !== 0) {
      return category;
    }

    const name = a.name.localeCompare(b.name);

    if (name !== 0) {
      return name;
    }

    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function sameIdentity(a: MaterialCreateData, b: MaterialFixture) {
  return (
    a.name === b.name &&
    a.category === b.category &&
    a.unitOfMeasure === b.unitOfMeasure
  );
}

function createHarness(
  initialMaterials: Array<MaterialFixture> = [],
  options: HarnessOptions = {},
) {
  let materials = initialMaterials.map((record) => ({ ...record }));
  let purchases: Array<PurchaseFixture> = [];
  let materialCount = 0;
  let purchaseCount = 0;

  const logger: HarnessLogger = {
    info: vi.fn(),
    warn: vi.fn(),
  };

  const api: HarnessApi = {
    addBaseMaterial: (nextMaterial) => {
      materials.push({ ...nextMaterial });
    },
  };

  function createDb(
    getMaterials: () => Array<MaterialFixture>,
    getPurchases: () => Array<PurchaseFixture>,
  ): CommitImportDb {
    return {
      material: {
        findMany: async () => sortMaterials(getMaterials()),
        findFirst: async (args) => {
          const found = getMaterials().find(
            (record) =>
              record.name === args.where.name &&
              record.category === args.where.category &&
              record.unitOfMeasure === args.where.unitOfMeasure,
          );

          return found ? { id: found.id } : null;
        },
        create: async (args) => {
          options.onMaterialCreate?.(args.data, api);

          if (
            getMaterials().some((record) => sameIdentity(args.data, record))
          ) {
            throw p2002();
          }

          materialCount += 1;
          const nextMaterial = material({
            id: `created-material-${materialCount}`,
            name: args.data.name,
            category: args.data.category,
            unitOfMeasure: args.data.unitOfMeasure,
          });

          getMaterials().push(nextMaterial);

          return { id: nextMaterial.id };
        },
      },
      purchase: {
        create: async (args) => {
          purchaseCount += 1;
          const purchase = {
            id: `created-purchase-${purchaseCount}`,
            materialId: args.data.materialId,
            totalQuantity: args.data.totalQuantity,
            totalPrice: args.data.totalPrice,
            date: toIsoDate(args.data.date),
          };

          getPurchases().push(purchase);

          return { id: purchase.id };
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
        callback: (db: CommitImportDb) => Promise<T>,
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
    getMaterials: () => materials,
    getPurchases: () => purchases,
    logger,
  };
}

async function getImportError(
  promise: Promise<unknown>,
): Promise<ImportCommitError['importError']> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ImportCommitError) {
      return error.importError;
    }

    throw error;
  }

  throw new Error('Expected ImportCommitError');
}

function commit(input: CommitImportInput, harness = createHarness()) {
  return commitImportWithDependencies(USER_ID, input, harness.deps);
}

describe('commitImport', () => {
  it('commits all-new items', async () => {
    const harness = createHarness();

    const result = await commit(
      {
        date: '2026-05-15',
        items: [
          newItem({
            material: {
              name: 'Tint 7/0',
              category: 'color',
              unitOfMeasure: 'ml',
            },
          }),
          newItem({
            material: {
              name: 'Powder Lightener',
              category: 'bleach',
              unitOfMeasure: 'g',
            },
            totalQuantity: '500',
            totalPrice: '25.00',
          }),
        ],
      },
      harness,
    );

    expect(result).toEqual({
      createdMaterialIds: ['created-material-1', 'created-material-2'],
      createdPurchaseIds: ['created-purchase-1', 'created-purchase-2'],
    });
    expect(harness.getMaterials().map((record) => record.name)).toEqual([
      'Tint 7/0',
      'Powder Lightener',
    ]);
    expect(harness.getPurchases()).toHaveLength(2);
  });

  it('commits all-existing items', async () => {
    const harness = createHarness([
      material({ id: 'mat-color', name: 'Tint 7/0' }),
      material({
        id: 'mat-developer',
        name: 'Developer',
        category: 'developer',
      }),
    ]);

    const result = await commit(
      {
        date: '2026-05-15',
        items: [existingItem('mat-color'), existingItem('mat-developer')],
      },
      harness,
    );

    expect(result).toEqual({
      createdMaterialIds: [],
      createdPurchaseIds: ['created-purchase-1', 'created-purchase-2'],
    });
    expect(
      harness.getPurchases().map((purchase) => purchase.materialId),
    ).toEqual(['mat-color', 'mat-developer']);
  });

  it('commits mixed new and existing items', async () => {
    const harness = createHarness([
      material({ id: 'mat-color', name: 'Tint 7/0' }),
      material({
        id: 'mat-developer',
        name: 'Developer',
        category: 'developer',
      }),
    ]);

    const result = await commit(
      {
        date: '2026-05-15',
        items: [
          existingItem('mat-color'),
          existingItem('mat-developer'),
          newItem({
            material: {
              name: 'Foils',
              category: 'tools',
              unitOfMeasure: 'piece',
            },
            totalQuantity: '2',
          }),
        ],
      },
      harness,
    );

    expect(result).toEqual({
      createdMaterialIds: ['created-material-1'],
      createdPurchaseIds: [
        'created-purchase-1',
        'created-purchase-2',
        'created-purchase-3',
      ],
    });
    expect(
      harness.getPurchases().map((purchase) => purchase.materialId),
    ).toEqual(['mat-color', 'mat-developer', 'created-material-1']);
  });

  it('accepts existing archived Materials without restoring them', async () => {
    const harness = createHarness([
      material({ id: 'mat-archived', name: 'Discontinued', isArchived: true }),
    ]);

    await commit(
      {
        date: '2026-05-15',
        items: [existingItem('mat-archived')],
      },
      harness,
    );

    expect(harness.getPurchases()).toHaveLength(1);
    expect(harness.getMaterials()[0].isArchived).toBe(true);
  });

  it('rejects new items that match archived Materials', async () => {
    const harness = createHarness([
      material({ id: 'mat-archived', name: 'Discontinued', isArchived: true }),
    ]);

    const error = await getImportError(
      commit(
        {
          clientRequestId: 'req-conflict',
          date: '2026-05-15',
          items: [
            newItem({
              material: {
                name: 'Discontinued',
                category: 'color',
                unitOfMeasure: 'ml',
              },
            }),
          ],
        },
        harness,
      ),
    );

    expect(error).toMatchObject({
      code: 'material_conflict',
      lineIndex: 0,
      materialId: 'mat-archived',
      clientRequestId: 'req-conflict',
    });
    expect(harness.getPurchases()).toHaveLength(0);
  });

  it('rejects duplicate same-batch new Materials after name trimming', async () => {
    const harness = createHarness();

    const error = await getImportError(
      commit(
        {
          clientRequestId: 'req-duplicate-new',
          date: '2026-05-15',
          items: [
            newItem({
              material: {
                name: '  Repeat Shade  ',
                category: 'color',
                unitOfMeasure: 'ml',
              },
            }),
            newItem({
              material: {
                name: 'Repeat Shade',
                category: 'color',
                unitOfMeasure: 'ml',
              },
            }),
          ],
        },
        harness,
      ),
    );

    expect(error).toMatchObject({
      code: 'duplicate_material',
      lineIndex: 1,
      conflictingLineIndex: 0,
      clientRequestId: 'req-duplicate-new',
    });
    expect(harness.getPurchases()).toHaveLength(0);
  });

  it('rejects duplicate same-batch existing Materials', async () => {
    const harness = createHarness([
      material({ id: 'mat-color', name: 'Tint 7/0' }),
    ]);

    const error = await getImportError(
      commit(
        {
          date: '2026-05-15',
          items: [existingItem('mat-color'), existingItem('mat-color')],
        },
        harness,
      ),
    );

    expect(error).toMatchObject({
      code: 'duplicate_material',
      lineIndex: 1,
      conflictingLineIndex: 0,
    });
    expect(harness.getPurchases()).toHaveLength(0);
  });

  it('rejects same-batch existing then new items that resolve to the same Material', async () => {
    const harness = createHarness([
      material({ id: 'mat-color', name: 'Tint 7/0' }),
    ]);

    const error = await getImportError(
      commit(
        {
          date: '2026-05-15',
          items: [
            existingItem('mat-color'),
            newItem({
              material: {
                name: 'Tint 7/0',
                category: 'color',
                unitOfMeasure: 'ml',
              },
            }),
          ],
        },
        harness,
      ),
    );

    expect(error).toMatchObject({
      code: 'duplicate_material',
      lineIndex: 1,
      conflictingLineIndex: 0,
    });
    expect(harness.getPurchases()).toHaveLength(0);
  });

  it('rejects same-batch new then existing items that resolve to the same Material', async () => {
    const harness = createHarness([
      material({ id: 'mat-color', name: 'Tint 7/0' }),
    ]);

    const error = await getImportError(
      commit(
        {
          date: '2026-05-15',
          items: [
            newItem({
              material: {
                name: 'Tint 7/0',
                category: 'color',
                unitOfMeasure: 'ml',
              },
            }),
            existingItem('mat-color'),
          ],
        },
        harness,
      ),
    );

    expect(error).toMatchObject({
      code: 'duplicate_material',
      lineIndex: 1,
      conflictingLineIndex: 0,
    });
    expect(harness.getPurchases()).toHaveLength(0);
  });

  it('rejects cross-Stylist material ids and rolls back earlier lines', async () => {
    const harness = createHarness([
      material({ id: 'mat-color', name: 'Tint 7/0' }),
    ]);

    const error = await getImportError(
      commit(
        {
          date: '2026-05-15',
          items: [
            existingItem('mat-color'),
            existingItem('other-user-material'),
          ],
        },
        harness,
      ),
    );

    expect(error).toMatchObject({
      code: 'material_not_found',
      lineIndex: 1,
    });
    expect(harness.getPurchases()).toHaveLength(0);
    expect(harness.logger.info).toHaveBeenCalledWith(
      'leland_commit_import called',
      expect.objectContaining({
        materialNames: ['Tint 7/0', 'unresolved:other-user-material'],
      }),
    );
  });

  it('rejects new items with same name/category and different unit', async () => {
    const harness = createHarness([
      material({
        id: 'mat-piece',
        name: 'Koleston 7/0',
        category: 'color',
        unitOfMeasure: 'piece',
      }),
    ]);

    const error = await getImportError(
      commit(
        {
          date: '2026-05-15',
          items: [
            newItem({
              material: {
                name: 'Koleston 7/0',
                category: 'color',
                unitOfMeasure: 'ml',
              },
              totalQuantity: '60',
            }),
          ],
        },
        harness,
      ),
    );

    expect(error).toMatchObject({
      code: 'unit_mismatch',
      lineIndex: 0,
    });
    expect(harness.getPurchases()).toHaveLength(0);
  });

  it('rejects empty items with validation_failed', async () => {
    const error = await getImportError(
      commit({
        date: '2026-05-15',
        items: [],
      }),
    );

    expect(error.code).toBe('validation_failed');
  });

  it('rejects JSON-number quantity and price at the schema layer', async () => {
    const quantityResult = commitImportInputSchema.safeParse({
      date: '2026-05-15',
      items: [
        {
          kind: 'new',
          material: {
            name: 'Tint 7/0',
            category: 'color',
            unitOfMeasure: 'ml',
          },
          totalQuantity: 120,
          totalPrice: '42.50',
        },
      ],
    });
    const priceResult = commitImportInputSchema.safeParse({
      date: '2026-05-15',
      items: [
        {
          kind: 'new',
          material: {
            name: 'Tint 7/0',
            category: 'color',
            unitOfMeasure: 'ml',
          },
          totalQuantity: '120',
          totalPrice: 42.5,
        },
      ],
    });

    expect(quantityResult.success).toBe(false);
    expect(priceResult.success).toBe(false);
  });

  it('rejects fractional piece quantity at the schema layer', async () => {
    const result = commitImportInputSchema.safeParse({
      date: '2026-05-15',
      items: [
        {
          kind: 'new',
          material: {
            name: 'Foils',
            category: 'tools',
            unitOfMeasure: 'piece',
          },
          totalQuantity: '1.5',
          totalPrice: '12.00',
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects fractional existing piece quantity after Catalog lookup', async () => {
    const harness = createHarness([
      material({
        id: 'mat-foils',
        name: 'Foils',
        category: 'tools',
        unitOfMeasure: 'piece',
      }),
    ]);

    const error = await getImportError(
      commit(
        {
          date: '2026-05-15',
          items: [existingItem('mat-foils', { totalQuantity: '1.5' })],
        },
        harness,
      ),
    );

    expect(error).toMatchObject({
      code: 'validation_failed',
      lineIndex: 0,
    });
    expect(harness.getPurchases()).toHaveLength(0);
  });

  it('recovers material_conflict from the Material unique-index race and rolls back', async () => {
    const harness = createHarness(
      [material({ id: 'mat-existing', name: 'Existing Color' })],
      {
        onMaterialCreate: (data, api) => {
          if (data.name !== 'Race Shade') {
            return;
          }

          api.addBaseMaterial(
            material({
              id: 'mat-race',
              name: data.name,
              category: data.category,
              unitOfMeasure: data.unitOfMeasure,
            }),
          );
          throw p2002('materials_user_id_name_category_unit_of_measure_key');
        },
      },
    );

    const error = await getImportError(
      commit(
        {
          clientRequestId: 'race-request',
          date: '2026-05-15',
          items: [
            existingItem('mat-existing'),
            newItem({
              material: {
                name: 'Race Shade',
                category: 'color',
                unitOfMeasure: 'ml',
              },
            }),
          ],
        },
        harness,
      ),
    );

    expect(error).toMatchObject({
      code: 'material_conflict',
      lineIndex: 1,
      materialId: 'mat-race',
      clientRequestId: 'race-request',
    });
    expect(harness.getPurchases()).toHaveLength(0);
    expect(harness.getMaterials().map((record) => record.id)).toContain(
      'mat-race',
    );
    expect(harness.logger.warn).toHaveBeenCalledWith(
      'leland_commit_import material conflict race',
      expect.objectContaining({
        userId: USER_ID,
        clientRequestId: 'race-request',
        lineIndex: 1,
        materialName: 'Race Shade',
      }),
    );
  });

  it('logs call metadata without quantity or price values', async () => {
    const harness = createHarness([
      material({ id: 'mat-existing', name: 'Existing Color' }),
    ]);

    await commit(
      {
        clientRequestId: 'log-request',
        date: '2026-05-15',
        items: [
          existingItem('mat-existing', {
            totalQuantity: '123.45',
            totalPrice: '67.89',
          }),
          newItem({
            material: {
              name: 'Logged New Shade',
              category: 'color',
              unitOfMeasure: 'ml',
            },
            totalQuantity: '987.31',
            totalPrice: '54.21',
          }),
        ],
      },
      harness,
    );

    expect(harness.logger.info).toHaveBeenCalledWith(
      'leland_commit_import called',
      expect.objectContaining({
        userId: USER_ID,
        clientRequestId: 'log-request',
        lineCount: 2,
        materialNames: ['Existing Color', 'Logged New Shade'],
      }),
    );

    const logPayload = JSON.stringify(harness.logger.info.mock.calls);

    // Distinctive 4–5 char decimals chosen so a stray substring match in any
    // log field (ids, counts, etc.) would be a real leak, not a coincidence.
    expect(logPayload).not.toContain('123.45');
    expect(logPayload).not.toContain('67.89');
    expect(logPayload).not.toContain('987.31');
    expect(logPayload).not.toContain('54.21');
  });

  it('does not dedupe by clientRequestId', async () => {
    const harness = createHarness([
      material({ id: 'mat-existing', name: 'Existing Color' }),
    ]);
    const input = {
      clientRequestId: 'same-request',
      date: '2026-05-15',
      items: [existingItem('mat-existing')],
    } satisfies CommitImportInput;

    await commit(input, harness);
    await commit(input, harness);

    expect(harness.getPurchases().map((purchase) => purchase.id)).toEqual([
      'created-purchase-1',
      'created-purchase-2',
    ]);
  });
});
