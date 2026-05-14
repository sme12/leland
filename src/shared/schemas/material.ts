import { z } from 'zod/v4';

import { MATERIAL_CATEGORIES, UNIT_OF_MEASURE } from '../enums';

const materialNameSchema = z
  .string()
  .trim()
  .min(1, { message: 'validation.materialNameRequired' });

export const materialCategorySchema = z.enum(MATERIAL_CATEGORIES);
export const unitOfMeasureSchema = z.enum(UNIT_OF_MEASURE);

export const materialCreateSchema = z
  .object({
    name: materialNameSchema,
    unitOfMeasure: unitOfMeasureSchema,
    category: materialCategorySchema,
  })
  .strict();

export const materialEditFormSchema = z
  .object({
    name: materialNameSchema,
    category: materialCategorySchema,
  })
  .strict();

export const materialUpdateSchema = materialEditFormSchema
  .extend({
    id: z.string().min(1, { message: 'validation.idRequired' }),
  })
  .strict();

export const materialIdSchema = z.object({
  id: z.string().min(1, { message: 'validation.idRequired' }),
});

export const materialListQuerySchema = z
  .object({ archived: z.boolean().optional() })
  .optional();

export const materialArchiveSchema = materialIdSchema.extend({
  isArchived: z.boolean(),
});

export type MaterialCreateInput = z.input<typeof materialCreateSchema>;
export type MaterialCreateValues = z.output<typeof materialCreateSchema>;
export type MaterialEditFormInput = z.input<typeof materialEditFormSchema>;
export type MaterialEditFormValues = z.output<typeof materialEditFormSchema>;
export type MaterialUpdateInput = z.input<typeof materialUpdateSchema>;
export type MaterialUpdateValues = z.output<typeof materialUpdateSchema>;
