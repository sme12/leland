import { describe, expect, it } from 'vitest';

import { MATERIAL_CATEGORIES, UNIT_OF_MEASURE } from './enums';

describe('shared enums', () => {
  it('keeps material categories in PRD order', () => {
    expect(MATERIAL_CATEGORIES).toEqual([
      'color',
      'developer',
      'bleach',
      'shampoo',
      'conditioner',
      'treatment',
      'styling',
      'tools',
      'disposables',
      'other',
    ]);
  });

  it('keeps units of measure in PRD order', () => {
    expect(UNIT_OF_MEASURE).toEqual(['ml', 'g', 'piece']);
  });
});
