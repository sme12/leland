import { z } from 'zod/v4';

import {
  getHelsinkiDateOnly,
  isFutureHelsinkiDate,
  isValidDateOnly,
} from '../date';
import { moneyStringSchema } from './decimal';
import { quantityStringSchema } from './purchase';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const optionalNoteSchema = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

export const visitDateSchema = z
  .string()
  .trim()
  .regex(dateOnlyPattern, 'validation.date')
  .refine((value) => isValidDateOnly(value), { message: 'validation.date' })
  .refine((value) => !isFutureHelsinkiDate(value), {
    message: 'validation.visitDateFuture',
  });

export const visitLineItemCreateSchema = z.object({
  materialId: z.string().min(1, { message: 'validation.idRequired' }),
  amount: quantityStringSchema,
});

export const visitLineItemUpdateSchema = visitLineItemCreateSchema.extend({
  id: z.string().min(1, { message: 'validation.idRequired' }).optional(),
});

export const visitCreateSchema = z
  .object({
    customerId: z.string().min(1, { message: 'validation.idRequired' }),
    serviceId: z.string().min(1, { message: 'validation.idRequired' }),
    date: visitDateSchema,
    priceCharged: moneyStringSchema,
    note: optionalNoteSchema,
    items: z.array(visitLineItemCreateSchema).default([]),
  })
  .strict();

export const visitUpdateSchema = visitCreateSchema
  .extend({
    id: z.string().min(1, { message: 'validation.idRequired' }),
    items: z.array(visitLineItemUpdateSchema).default([]),
  })
  .strict();

export const visitIdSchema = z
  .object({
    id: z.string().min(1, { message: 'validation.idRequired' }),
  })
  .strict();

export type VisitCreateInput = z.input<typeof visitCreateSchema>;
export type VisitCreateValues = z.output<typeof visitCreateSchema>;
export type VisitUpdateInput = z.input<typeof visitUpdateSchema>;
export type VisitUpdateValues = z.output<typeof visitUpdateSchema>;

export function createDefaultVisitDate() {
  return getHelsinkiDateOnly();
}
