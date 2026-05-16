import { z } from 'zod/v4';

import { isPastHelsinkiDate, isValidDateOnly } from '../date';
import { moneyStringSchema } from './decimal';
import { quantityStringSchema } from './purchase';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const optionalNoteSchema = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

const optionalMoneyStringSchema = z
  .preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? null : value,
    moneyStringSchema.nullable().optional(),
  )
  .transform((value) => value ?? null);

export const visitDraftDateSchema = z
  .string()
  .trim()
  .regex(dateOnlyPattern, 'validation.date')
  .refine((value) => isValidDateOnly(value), { message: 'validation.date' })
  .refine((value) => !isPastHelsinkiDate(value), {
    message: 'validation.visitDraftDatePast',
  });

export const materialEstimateCreateSchema = z.object({
  materialId: z.string().min(1, { message: 'validation.idRequired' }),
  amount: quantityStringSchema,
});

export const materialEstimateUpdateSchema = materialEstimateCreateSchema.extend(
  {
    id: z.string().min(1, { message: 'validation.idRequired' }).optional(),
  },
);

export const visitDraftCreateSchema = z
  .object({
    customerId: z.string().min(1, { message: 'validation.idRequired' }),
    serviceId: z.string().min(1, { message: 'validation.idRequired' }),
    date: visitDraftDateSchema,
    estimatedPrice: optionalMoneyStringSchema,
    note: optionalNoteSchema,
    items: z.array(materialEstimateCreateSchema).default([]),
  })
  .strict();

export const visitDraftUpdateSchema = visitDraftCreateSchema
  .extend({
    id: z.string().min(1, { message: 'validation.idRequired' }),
    items: z.array(materialEstimateUpdateSchema).default([]),
  })
  .strict();

export const visitDraftUpdateServerSchema = visitDraftCreateSchema
  .extend({
    id: z.string().min(1, { message: 'validation.idRequired' }),
    expectedUpdatedAt: z
      .string()
      .min(1, { message: 'validation.idRequired' })
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: 'validation.date',
      }),
    items: z.array(materialEstimateUpdateSchema).default([]),
  })
  .strict();

export const visitDraftIdSchema = z
  .object({
    id: z.string().min(1, { message: 'validation.idRequired' }),
  })
  .strict();

export const visitDraftPublishSchema = visitDraftIdSchema;
export const visitDraftDiscardSchema = visitDraftIdSchema;

export type VisitDraftCreateInput = z.input<typeof visitDraftCreateSchema>;
export type VisitDraftCreateValues = z.output<typeof visitDraftCreateSchema>;
export type VisitDraftUpdateInput = z.input<typeof visitDraftUpdateSchema>;
export type VisitDraftUpdateValues = z.output<typeof visitDraftUpdateSchema>;
