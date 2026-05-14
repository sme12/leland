import type { MaterialCategory, UnitOfMeasure } from './enums';

export type MaterialSeed = {
  name: string;
  category: MaterialCategory;
  unitOfMeasure: UnitOfMeasure;
};

export const MATERIAL_SEED: Array<MaterialSeed> = [
  { name: 'Color cream', category: 'color', unitOfMeasure: 'ml' },
  { name: 'Cream developer', category: 'developer', unitOfMeasure: 'ml' },
  { name: 'Lightening powder', category: 'bleach', unitOfMeasure: 'g' },
  { name: 'Clarifying shampoo', category: 'shampoo', unitOfMeasure: 'ml' },
  {
    name: 'Moisture conditioner',
    category: 'conditioner',
    unitOfMeasure: 'ml',
  },
  { name: 'Repair mask', category: 'treatment', unitOfMeasure: 'g' },
  { name: 'Heat protectant spray', category: 'styling', unitOfMeasure: 'ml' },
  { name: 'Tint brush', category: 'tools', unitOfMeasure: 'piece' },
  { name: 'Nitrile gloves', category: 'disposables', unitOfMeasure: 'piece' },
  { name: 'Mixing bowl', category: 'other', unitOfMeasure: 'piece' },
];
