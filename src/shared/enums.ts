export const MATERIAL_CATEGORIES = [
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
] as const;

export const UNIT_OF_MEASURE = ['ml', 'g', 'piece'] as const;

export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];
export type UnitOfMeasure = (typeof UNIT_OF_MEASURE)[number];
