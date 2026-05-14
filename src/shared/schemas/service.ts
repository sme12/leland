import { z } from 'zod/v4';

import { moneyStringSchema, normalizeOptionalMoney } from './decimal';

export const updateServiceDefaultPriceSchema = z.object({
  id: z.string().min(1, 'validation.idRequired'),
  price: z
    .union([z.string(), z.null()])
    .transform(normalizeOptionalMoney)
    .pipe(z.union([moneyStringSchema, z.null()])),
});

export type UpdateServiceDefaultPriceInput = z.input<
  typeof updateServiceDefaultPriceSchema
>;
export type UpdateServiceDefaultPriceValues = z.output<
  typeof updateServiceDefaultPriceSchema
>;
