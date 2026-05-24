import { describe, expect, it, vi } from 'vitest';

import type { ListMaterialsDb } from './list-materials';
import { callListMaterials } from './list-materials';

type MaterialFixture = {
  id: string;
  name: string;
  category: string;
  unitOfMeasure: string;
  isArchived: boolean;
  createdAt: Date;
};

function material(
  overrides: Partial<MaterialFixture> & Pick<MaterialFixture, 'id' | 'name'>,
): MaterialFixture {
  return {
    category: 'color',
    unitOfMeasure: 'ml',
    isArchived: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createDb(records: Array<MaterialFixture>) {
  let lastArgs: Parameters<ListMaterialsDb['material']['findMany']>[0] | null =
    null;

  const db: ListMaterialsDb = {
    material: {
      findMany: async (args) => {
        lastArgs = args;

        const filtered =
          args.where?.isArchived === undefined
            ? records
            : records.filter(
                (record) => record.isArchived === args.where?.isArchived,
              );

        return filtered
          .slice()
          .sort((a, b) => {
            const category = a.category.localeCompare(b.category);

            if (category !== 0) {
              return category;
            }

            const name = a.name.localeCompare(b.name);

            if (name !== 0) {
              return name;
            }

            return a.createdAt.getTime() - b.createdAt.getTime();
          })
          .slice(0, args.take);
      },
    },
  };

  return { db, getLastArgs: () => lastArgs };
}

describe('leland_list_materials', () => {
  it('returns active Materials by default', async () => {
    const { db, getLastArgs } = createDb([
      material({ id: 'mat-archived', name: 'Archived', isArchived: true }),
      material({ id: 'mat-shampoo', name: 'Shampoo', category: 'shampoo' }),
      material({ id: 'mat-color', name: 'Color', category: 'color' }),
    ]);

    const result = await callListMaterials({}, db);

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      materials: [
        {
          id: 'mat-color',
          name: 'Color',
          category: 'color',
          unitOfMeasure: 'ml',
          isArchived: false,
        },
        {
          id: 'mat-shampoo',
          name: 'Shampoo',
          category: 'shampoo',
          unitOfMeasure: 'ml',
          isArchived: false,
        },
      ],
    });
    expect(getLastArgs()).toMatchObject({
      where: { isArchived: false },
      orderBy: [{ category: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('includes archived Materials when includeArchived is true', async () => {
    const { db, getLastArgs } = createDb([
      material({ id: 'mat-active', name: 'Active' }),
      material({ id: 'mat-archived', name: 'Archived', isArchived: true }),
    ]);

    const result = await callListMaterials({ includeArchived: true }, db);

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      materials: [
        {
          id: 'mat-active',
          name: 'Active',
          category: 'color',
          unitOfMeasure: 'ml',
          isArchived: false,
        },
        {
          id: 'mat-archived',
          name: 'Archived',
          category: 'color',
          unitOfMeasure: 'ml',
          isArchived: true,
        },
      ],
    });
    expect(getLastArgs()?.where).toBeUndefined();
  });

  it('returns a structured catalog_too_large error above 500 Materials', async () => {
    const { db } = createDb(
      Array.from({ length: 501 }, (_, index) =>
        material({ id: `mat-${index}`, name: `Material ${index}` }),
      ),
    );

    const result = await callListMaterials({}, db);

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: 'catalog_too_large',
    });
  });

  it('returns a structured validation_failed error for invalid input', async () => {
    const { db } = createDb([]);

    const result = await callListMaterials({ includeArchived: 'yes' }, db);

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: 'validation_failed',
    });
  });

  it('returns a structured internal_error without leaking the thrown error', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const db: ListMaterialsDb = {
      material: {
        findMany: async () => {
          throw new Error('database exploded');
        },
      },
    };

    const result = await callListMaterials({}, db);

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      code: 'internal_error',
      message: 'Internal error while listing Materials.',
    });

    consoleError.mockRestore();
  });
});
