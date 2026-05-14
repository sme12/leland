import Decimal from 'decimal.js';
import { z } from 'zod/v4';

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
  .refine(
    (value) => {
      try {
        return formatDateOnly(parseDateOnly(value)) === value;
      } catch {
        return false;
      }
    },
    { message: 'validation.date' },
  );

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

const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function parseDateOnly(value: string) {
  if (!dateOnlyPattern.test(value)) {
    throw new Error('parseDateOnly expects a YYYY-MM-DD string');
  }

  const [year, month, day] = value.split('-').map(Number);

  if (month < 1 || month > 12) {
    throw new Error('parseDateOnly received an invalid month');
  }

  const maxDay = month === 2 && isLeapYear(year) ? 29 : daysInMonth[month - 1];

  if (day < 1 || day > maxDay) {
    throw new Error('parseDateOnly received an invalid day');
  }

  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateOnly(value: Date) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError('formatDateOnly expects a valid Date');
  }

  return value.toISOString().slice(0, 10);
}
