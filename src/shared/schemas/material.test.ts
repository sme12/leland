import { describe, expect, it } from 'vitest';

import { MATERIAL_CATEGORIES, UNIT_OF_MEASURE } from '../enums';
import { materialCreateSchema, materialUpdateSchema } from './material';

describe('material schemas', () => {
  it('trims names and accepts valid category and UoM values', () => {
    for (const [index, category] of MATERIAL_CATEGORIES.entries()) {
      const unitOfMeasure = UNIT_OF_MEASURE[index % UNIT_OF_MEASURE.length];
      const result = materialCreateSchema.parse({
        name: `  Material ${category}  `,
        category,
        unitOfMeasure,
      });

      expect(result).toEqual({
        name: `Material ${category}`,
        category,
        unitOfMeasure,
      });
    }
  });

  it('requires a non-empty name', () => {
    const result = materialCreateSchema.safeParse({
      name: ' ',
      category: 'color',
      unitOfMeasure: 'ml',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'validation.materialNameRequired',
    );
  });

  it('does not accept UoM changes in update payloads', () => {
    expect(() =>
      materialUpdateSchema.parse({
        id: 'material-id',
        name: 'Color cream',
        category: 'color',
        unitOfMeasure: 'g',
      }),
    ).toThrow();
  });
});
