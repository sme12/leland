import { describe, expect, it, vi } from 'vitest';

import type { ListPurchasesDb } from './list-purchases';
import { callListPurchases } from './list-purchases';

type PurchaseFixture = {
  id: string;
  materialId: string;
  materialName: string;
  totalQuantity: string;
  totalPrice: string;
  date: string;
  createdAt: Date;
  materialIsArchived?: boolean;
};

function purchase(
  overrides: Partial<PurchaseFixture> &
    Pick<PurchaseFixture, 'id' | 'materialId' | 'materialName' | 'date'>,
): PurchaseFixture {
  return {
    totalQuantity: '360.00',
    totalPrice: '42.50',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    materialIsArchived: false,
    ...overrides,
  };
}

function createDb(records: Array<PurchaseFixture>) {
  let lastArgs: Parameters<ListPurchasesDb['purchase']['findMany']>[0] | null =
    null;

  const db: ListPurchasesDb = {
    purchase: {
      findMany: async (args) => {
        lastArgs = args;

        const where = args.where.date;
        const matches = records.filter((record) => {
          if (where instanceof Date) {
            return record.date === toIsoDate(where);
          }

          return (
            record.date >= toIsoDate(where.gte) &&
            record.date <= toIsoDate(where.lte)
          );
        });

        return matches
          .slice()
          .sort((a, b) => {
            if (a.date !== b.date) {
              return a.date < b.date ? 1 : -1;
            }

            return b.createdAt.getTime() - a.createdAt.getTime();
          })
          .map((record) => ({
            id: record.id,
            materialId: record.materialId,
            totalQuantity: { toString: () => record.totalQuantity },
            totalPrice: { toString: () => record.totalPrice },
            date: new Date(`${record.date}T00:00:00.000Z`),
            material: { name: record.materialName },
          }));
      },
    },
  };

  return { db, getLastArgs: () => lastArgs };
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

describe('leland_list_purchases', () => {
  it('returns Purchases for the given single date', async () => {
    const { db, getLastArgs } = createDb([
      purchase({
        id: 'p-1',
        materialId: 'mat-color',
        materialName: 'Koleston 7/0',
        date: '2026-05-15',
        totalQuantity: '360.00',
        totalPrice: '42.50',
      }),
      purchase({
        id: 'p-other-day',
        materialId: 'mat-color',
        materialName: 'Koleston 7/0',
        date: '2026-05-14',
      }),
    ]);

    const result = await callListPurchases({ date: '2026-05-15' }, db);

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      purchases: [
        {
          id: 'p-1',
          materialId: 'mat-color',
          materialName: 'Koleston 7/0',
          totalQuantity: '360.00',
          totalPrice: '42.50',
          date: '2026-05-15',
        },
      ],
    });
    expect(getLastArgs()?.orderBy).toEqual([
      { date: 'desc' },
      { createdAt: 'desc' },
    ]);
  });

  it('returns Purchases in an inclusive range', async () => {
    const { db } = createDb([
      purchase({
        id: 'p-before',
        materialId: 'mat-a',
        materialName: 'A',
        date: '2026-05-09',
      }),
      purchase({
        id: 'p-start',
        materialId: 'mat-a',
        materialName: 'A',
        date: '2026-05-10',
      }),
      purchase({
        id: 'p-mid',
        materialId: 'mat-a',
        materialName: 'A',
        date: '2026-05-12',
      }),
      purchase({
        id: 'p-end',
        materialId: 'mat-a',
        materialName: 'A',
        date: '2026-05-15',
      }),
      purchase({
        id: 'p-after',
        materialId: 'mat-a',
        materialName: 'A',
        date: '2026-05-16',
      }),
    ]);

    const result = await callListPurchases(
      { from: '2026-05-10', to: '2026-05-15' },
      db,
    );

    expect(result.isError).toBeUndefined();
    const { purchases } = result.structuredContent as {
      purchases: Array<{ id: string }>;
    };
    expect(purchases.map((p) => p.id)).toEqual(['p-end', 'p-mid', 'p-start']);
  });

  it('orders results by date desc, then createdAt desc', async () => {
    const { db } = createDb([
      purchase({
        id: 'p-older-same-day',
        materialId: 'mat-a',
        materialName: 'A',
        date: '2026-05-15',
        createdAt: new Date('2026-05-15T10:00:00.000Z'),
      }),
      purchase({
        id: 'p-newer-same-day',
        materialId: 'mat-a',
        materialName: 'A',
        date: '2026-05-15',
        createdAt: new Date('2026-05-15T14:00:00.000Z'),
      }),
      purchase({
        id: 'p-later-day',
        materialId: 'mat-a',
        materialName: 'A',
        date: '2026-05-16',
        createdAt: new Date('2026-05-16T09:00:00.000Z'),
      }),
    ]);

    const result = await callListPurchases(
      { from: '2026-05-15', to: '2026-05-16' },
      db,
    );

    const { purchases } = result.structuredContent as {
      purchases: Array<{ id: string }>;
    };
    expect(purchases.map((p) => p.id)).toEqual([
      'p-later-day',
      'p-newer-same-day',
      'p-older-same-day',
    ]);
  });

  it('serialises totalQuantity and totalPrice as decimal strings', async () => {
    const { db } = createDb([
      purchase({
        id: 'p-1',
        materialId: 'mat-a',
        materialName: 'A',
        date: '2026-05-15',
        totalQuantity: '1.50',
        totalPrice: '0.00',
      }),
    ]);

    const result = await callListPurchases({ date: '2026-05-15' }, db);
    const { purchases } = result.structuredContent as {
      purchases: Array<{ totalQuantity: unknown; totalPrice: unknown }>;
    };

    expect(typeof purchases[0].totalQuantity).toBe('string');
    expect(typeof purchases[0].totalPrice).toBe('string');
    expect(purchases[0].totalQuantity).toBe('1.50');
    expect(purchases[0].totalPrice).toBe('0.00');
  });

  it('returns Purchases whose Material is archived', async () => {
    const { db } = createDb([
      purchase({
        id: 'p-archived-material',
        materialId: 'mat-archived',
        materialName: 'Discontinued dye',
        date: '2026-05-15',
        materialIsArchived: true,
      }),
    ]);

    const result = await callListPurchases({ date: '2026-05-15' }, db);

    const { purchases } = result.structuredContent as {
      purchases: Array<{ id: string; materialName: string }>;
    };
    expect(purchases).toEqual([
      {
        id: 'p-archived-material',
        materialId: 'mat-archived',
        materialName: 'Discontinued dye',
        totalQuantity: '360.00',
        totalPrice: '42.50',
        date: '2026-05-15',
      },
    ]);
  });

  it('rejects empty input with validation_failed', async () => {
    const { db } = createDb([]);

    const result = await callListPurchases({}, db);

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: 'validation_failed',
    });
  });

  it('rejects when both date and (from, to) are supplied', async () => {
    const { db } = createDb([]);

    const result = await callListPurchases(
      { date: '2026-05-15', from: '2026-05-10', to: '2026-05-15' },
      db,
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: 'validation_failed',
    });
  });

  it('rejects when only one of from/to is supplied', async () => {
    const { db } = createDb([]);

    const result = await callListPurchases({ from: '2026-05-10' }, db);

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: 'validation_failed',
    });
  });

  it('rejects ranges longer than 31 days', async () => {
    const { db } = createDb([]);

    const result = await callListPurchases(
      { from: '2026-05-01', to: '2026-06-01' },
      db,
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: 'validation_failed',
    });
  });

  it('accepts ranges of exactly 31 inclusive days', async () => {
    const { db } = createDb([]);

    const result = await callListPurchases(
      { from: '2026-05-01', to: '2026-05-31' },
      db,
    );

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({ purchases: [] });
  });

  it('rejects inverted ranges (from > to)', async () => {
    const { db } = createDb([]);

    const result = await callListPurchases(
      { from: '2026-05-15', to: '2026-05-10' },
      db,
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: 'validation_failed',
    });
  });

  it('rejects malformed date strings with validation_failed', async () => {
    const { db } = createDb([]);

    const result = await callListPurchases({ date: '2026-13-40' }, db);

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: 'validation_failed',
    });
  });

  it('returns a structured internal_error without leaking the thrown error', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const db: ListPurchasesDb = {
      purchase: {
        findMany: async () => {
          throw new Error('database exploded');
        },
      },
    };

    try {
      const result = await callListPurchases({ date: '2026-05-15' }, db);

      expect(result.isError).toBe(true);
      expect(result.structuredContent).toEqual({
        code: 'internal_error',
        message: 'Internal error while listing Purchases.',
      });
    } finally {
      consoleError.mockRestore();
    }
  });
});
