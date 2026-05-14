import { z } from 'zod/v4';

const customerNameSchema = z
  .string()
  .trim()
  .min(1, 'validation.customerNameRequired');

const customerCommentSchema = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

export const customerFormSchema = z.object({
  name: customerNameSchema,
  comment: customerCommentSchema,
});

export const customerMutationSchema = customerFormSchema.extend({
  id: z.string().min(1, 'validation.idRequired').optional(),
});

export const customerIdSchema = z.object({
  id: z.string().min(1, 'validation.idRequired'),
});

export const customerListQuerySchema = z
  .object({ archived: z.boolean().optional() })
  .optional();

export const customerArchiveSchema = customerIdSchema.extend({
  isArchived: z.boolean(),
});

export type CustomerFormInput = z.input<typeof customerFormSchema>;
export type CustomerFormValues = z.output<typeof customerFormSchema>;
