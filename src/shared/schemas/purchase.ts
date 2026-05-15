import Decimal from 'decimal.js';
import { z } from 'zod/v4';

import { formatDateOnly, isValidDateOnly, parseDateOnly } from '../date';
import { moneyStringSchema } from './decimal';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
const decimalQuantityPattern = /^(0|[1-9]\d*)(\.\d{1,2})?$/;
const positiveIntegerPattern = /^[1-9]\d*$/;

export const positiveIntegerStringSchema = z
  .string()
  .trim()
  .regex(positiveIntegerPattern, 'validation.integerPositive');

export const quantityStringSchema = z
  .string()
  .trim()
  .regex(decimalQuantityPattern, 'validation.quantity')
  .refine((value) => new Decimal(value).gt(0), {
    message: 'validation.quantityPositive',
  });

export const purchaseDateSchema = z
  .string()
  .trim()
  .regex(dateOnlyPattern, 'validation.date')
  .refine((value) => isValidDateOnly(value), { message: 'validation.date' });

export const purchaseCreateSchema = z
  .object({
    materialId: z.string().min(1, { message: 'validation.idRequired' }),
    totalQuantity: quantityStringSchema,
    totalPrice: moneyStringSchema,
    date: purchaseDateSchema,
  })
  .strict();

export const purchaseUpdateSchema = purchaseCreateSchema
  .extend({
    id: z.string().min(1, { message: 'validation.idRequired' }),
  })
  .strict();

export const purchaseIdSchema = z
  .object({
    id: z.string().min(1, { message: 'validation.idRequired' }),
  })
  .strict();

export const purchaseContainerFormSchema = z
  .object({
    count: positiveIntegerStringSchema,
    sizeEach: quantityStringSchema,
    totalPrice: moneyStringSchema,
    date: purchaseDateSchema,
  })
  .strict();

export const purchasePieceFormSchema = z
  .object({
    quantity: positiveIntegerStringSchema,
    totalPrice: moneyStringSchema,
    date: purchaseDateSchema,
  })
  .strict();

export const purchaseEditFormSchema = z
  .object({
    totalQuantity: quantityStringSchema,
    totalPrice: moneyStringSchema,
    date: purchaseDateSchema,
  })
  .strict();

export const purchaseEditPieceFormSchema = z
  .object({
    totalQuantity: positiveIntegerStringSchema,
    totalPrice: moneyStringSchema,
    date: purchaseDateSchema,
  })
  .strict();

export type PurchaseCreateInput = z.input<typeof purchaseCreateSchema>;
export type PurchaseCreateValues = z.output<typeof purchaseCreateSchema>;
export type PurchaseUpdateInput = z.input<typeof purchaseUpdateSchema>;
export type PurchaseUpdateValues = z.output<typeof purchaseUpdateSchema>;
export type PurchaseContainerFormInput = z.input<
  typeof purchaseContainerFormSchema
>;
export type PurchaseContainerFormValues = z.output<
  typeof purchaseContainerFormSchema
>;
export type PurchasePieceFormInput = z.input<typeof purchasePieceFormSchema>;
export type PurchasePieceFormValues = z.output<typeof purchasePieceFormSchema>;
export type PurchaseEditFormInput = z.input<typeof purchaseEditFormSchema>;
export type PurchaseEditFormValues = z.output<typeof purchaseEditFormSchema>;
export type PurchaseEditPieceFormInput = z.input<
  typeof purchaseEditPieceFormSchema
>;
export type PurchaseEditPieceFormValues = z.output<
  typeof purchaseEditPieceFormSchema
>;

export { formatDateOnly, parseDateOnly };
