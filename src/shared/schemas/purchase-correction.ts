import { z } from 'zod/v4';

import {
  positiveIntegerStringSchema,
  purchaseDateSchema,
  quantityStringSchema,
} from './purchase';
import { moneyStringSchema } from './decimal';

export const CORRECT_PURCHASE_CLIENT_REQUEST_ID_DESCRIPTION =
  'Opaque correlation id for server logs (max 128 chars). Generate a fresh UUID per correction attempt.';

export const CORRECT_PURCHASE_PURCHASE_ID_DESCRIPTION =
  'Purchase id from leland_list_purchases. Must belong to this Stylist.';

export const CORRECT_PURCHASE_VALUES_DESCRIPTION =
  'Complete Purchase values: materialId, totalQuantity, totalPrice, and date. Send the full final state, not a sparse patch.';

export const CORRECT_PURCHASE_EXPECTED_DESCRIPTION =
  'The current Purchase values the host believes it is replacing. The server compares these against the live Purchase and rejects stale corrections instead of blindly overwriting.';

export const CORRECT_PURCHASE_REPLACEMENT_DESCRIPTION =
  'The corrected final Purchase values after explicit Stylist confirmation. materialId must reference an existing active or archived Material.';

export const CORRECT_PURCHASE_MATERIAL_ID_DESCRIPTION =
  'Material id from leland_list_materials. For corrections, call leland_list_materials({ includeArchived: true }) first; active and archived Materials are valid.';

export const CORRECT_PURCHASE_TOTAL_QUANTITY_DESCRIPTION =
  "Positive decimal string with up to 2 decimals -- never a JSON number. For replacement values whose Material has unitOfMeasure:'piece', use integer strings only.";

export const CORRECT_PURCHASE_TOTAL_PRICE_DESCRIPTION =
  "VAT-inclusive total for this Purchase as a decimal string (never a JSON number), in the Stylist's local currency, up to 2 decimals, zero allowed.";

export const CORRECT_PURCHASE_DATE_DESCRIPTION =
  "The Receipt's invoice/issue date (Finnish: 'Laskun pvm') in YYYY-MM-DD. Not delivery date, not payment date.";

export const purchaseCorrectionValuesSchema = z
  .object({
    materialId: z
      .string()
      .trim()
      .min(1, { message: 'validation.idRequired' })
      .describe(CORRECT_PURCHASE_MATERIAL_ID_DESCRIPTION),
    totalQuantity: quantityStringSchema.describe(
      CORRECT_PURCHASE_TOTAL_QUANTITY_DESCRIPTION,
    ),
    totalPrice: moneyStringSchema.describe(
      CORRECT_PURCHASE_TOTAL_PRICE_DESCRIPTION,
    ),
    date: purchaseDateSchema.describe(CORRECT_PURCHASE_DATE_DESCRIPTION),
  })
  .strict()
  .describe(CORRECT_PURCHASE_VALUES_DESCRIPTION);

export const correctPurchaseInputSchema = z
  .object({
    clientRequestId: z
      .string()
      .max(128)
      .optional()
      .describe(CORRECT_PURCHASE_CLIENT_REQUEST_ID_DESCRIPTION),
    purchaseId: z
      .string()
      .trim()
      .min(1, { message: 'validation.idRequired' })
      .describe(CORRECT_PURCHASE_PURCHASE_ID_DESCRIPTION),
    expected: purchaseCorrectionValuesSchema.describe(
      CORRECT_PURCHASE_EXPECTED_DESCRIPTION,
    ),
    replacement: purchaseCorrectionValuesSchema.describe(
      CORRECT_PURCHASE_REPLACEMENT_DESCRIPTION,
    ),
  })
  .strict();

export function isPositiveIntegerQuantity(value: string) {
  return positiveIntegerStringSchema.safeParse(value).success;
}

export type PurchaseCorrectionValues = z.output<
  typeof purchaseCorrectionValuesSchema
>;
export type CorrectPurchaseInput = z.input<typeof correctPurchaseInputSchema>;
export type CorrectPurchaseValues = z.output<typeof correctPurchaseInputSchema>;
