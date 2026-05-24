import { z } from 'zod/v4';

import { materialCreateSchema } from './material';
import {
  positiveIntegerStringSchema,
  purchaseDateSchema,
  quantityStringSchema,
} from './purchase';
import { moneyStringSchema } from './decimal';

export const COMMIT_IMPORT_CLIENT_REQUEST_ID_DESCRIPTION =
  'Opaque correlation id for server logs (max 128 chars). NOT a dedupe key — calling with the same id twice writes rows twice. Generate a fresh UUID per logical Import attempt.';

export const COMMIT_IMPORT_DATE_DESCRIPTION =
  "The Receipt's invoice/issue date (Finnish: 'Laskun pvm') in YYYY-MM-DD. Not delivery date, not payment date. Applies to every Purchase created from this Import. If the Receipt's invoice date is missing or ambiguous, ask the Stylist before calling — do not guess.";

export const COMMIT_IMPORT_ITEMS_DESCRIPTION =
  'One entry per distinct Material. Collapse repeated Receipt lines for the same Material (e.g. 6 × 60ml tubes of the same colour) into a single item: sum quantities, sum prices. Two items resolving to the same Material in one payload are rejected as duplicate_material — collapse them first.';

export const COMMIT_IMPORT_EXISTING_KIND_DESCRIPTION =
  'Use when an exact match exists in the Catalog (active or archived). Provide materialId.';

export const COMMIT_IMPORT_MATERIAL_ID_DESCRIPTION =
  'Material id from leland_list_materials. Must belong to this Stylist; cross-Stylist ids are rejected as material_not_found.';

export const COMMIT_IMPORT_NEW_KIND_DESCRIPTION =
  "Use only when no Catalog entry matches by exact (name, category, unitOfMeasure). If a 'new' name collides with an existing Material (active OR archived), the server returns material_conflict with the conflicting materialId — retry that line with kind:\"existing\". If a Material with the same name+category exists in the Catalog but with a different unitOfMeasure than the Receipt suggests (e.g. existing 'Koleston 7/0' is 'piece' but the Receipt shows '60ml'), ASK THE STYLIST whether this is the same product in a different size convention or a genuinely new SKU. Do not silently create a second Material with the same display name — that produces a confusing Catalog.";

export const COMMIT_IMPORT_MATERIAL_NAME_DESCRIPTION =
  "Strip the size suffix from the Receipt's product name (e.g. 'GLOSS COLOR.ME 5/6 60ml' becomes 'GLOSS COLOR.ME 5/6'). Trimmed by the server before conflict checks.";

export const COMMIT_IMPORT_MATERIAL_CATEGORY_DESCRIPTION =
  "One of: color, developer, bleach, shampoo, conditioner, treatment, styling, tools, disposables, other. Pick from product knowledge; default to 'other' when uncertain. Editable by the Stylist before commit.";

export const COMMIT_IMPORT_UNIT_OF_MEASURE_DESCRIPTION =
  'ml for liquids (also tubes/bottles by volume, with totalQuantity in millilitres). g for solids/powders (grams). piece for countable items (brushes, gloves, mixing bowls). Fixed at Material creation — cannot be changed later, so propose carefully and let the Stylist confirm before commit.';

export const COMMIT_IMPORT_TOTAL_QUANTITY_DESCRIPTION =
  "Positive decimal string with up to 2 decimals — never a JSON number. For unitOfMeasure:'piece', use integer strings only (e.g. '12'). For ml/g, sum across collapsed Receipt lines (6 × 60ml → '360').";

export const COMMIT_IMPORT_TOTAL_PRICE_DESCRIPTION =
  "VAT-INCLUSIVE total for this Material line as a decimal string (never a JSON number), in the Stylist's local currency, up to 2 decimals, zero allowed. If the Receipt shows VAT-exclusive line totals (Finnish: 'Veroton arvo') plus a summary VAT rate, compute round(line_net_after_discount × (1 + vat_rate), 2). Per-line rounding may make the sum drift from the Receipt grand total (Finnish: 'Lasku Yhteensä') by a few cents — that is expected. If the Receipt mixes multiple VAT rates, apply each line's own rate. For unallocatable Receipt-level discounts/credits, ask the Stylist to adjust totals before calling.";

const importTotalQuantitySchema = quantityStringSchema.describe(
  COMMIT_IMPORT_TOTAL_QUANTITY_DESCRIPTION,
);

const importTotalPriceSchema = moneyStringSchema.describe(
  COMMIT_IMPORT_TOTAL_PRICE_DESCRIPTION,
);

export const importNewMaterialSchema = materialCreateSchema.extend({
  name: materialCreateSchema.shape.name.describe(
    COMMIT_IMPORT_MATERIAL_NAME_DESCRIPTION,
  ),
  category: materialCreateSchema.shape.category.describe(
    COMMIT_IMPORT_MATERIAL_CATEGORY_DESCRIPTION,
  ),
  unitOfMeasure: materialCreateSchema.shape.unitOfMeasure.describe(
    COMMIT_IMPORT_UNIT_OF_MEASURE_DESCRIPTION,
  ),
});

export const importExistingItemSchema = z
  .object({
    kind: z
      .literal('existing')
      .describe(COMMIT_IMPORT_EXISTING_KIND_DESCRIPTION),
    materialId: z
      .string()
      .min(1, { message: 'validation.idRequired' })
      .describe(COMMIT_IMPORT_MATERIAL_ID_DESCRIPTION),
    totalQuantity: importTotalQuantitySchema,
    totalPrice: importTotalPriceSchema,
  })
  .strict();

export const importNewItemSchema = z
  .object({
    kind: z.literal('new').describe(COMMIT_IMPORT_NEW_KIND_DESCRIPTION),
    material: importNewMaterialSchema,
    totalQuantity: importTotalQuantitySchema,
    totalPrice: importTotalPriceSchema,
  })
  .strict()
  .superRefine((item, ctx) => {
    if (
      item.material.unitOfMeasure === 'piece' &&
      !positiveIntegerStringSchema.safeParse(item.totalQuantity).success
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'validation.integerPositive',
        path: ['totalQuantity'],
      });
    }
  });

export const importItemSchema = z.discriminatedUnion('kind', [
  importExistingItemSchema,
  importNewItemSchema,
]);

export const commitImportInputSchema = z
  .object({
    clientRequestId: z
      .string()
      .max(128)
      .optional()
      .describe(COMMIT_IMPORT_CLIENT_REQUEST_ID_DESCRIPTION),
    date: purchaseDateSchema.describe(COMMIT_IMPORT_DATE_DESCRIPTION),
    items: z
      .array(importItemSchema)
      .min(1, { message: 'validation.itemsRequired' })
      .describe(COMMIT_IMPORT_ITEMS_DESCRIPTION),
  })
  .strict();

export type CommitImportInput = z.input<typeof commitImportInputSchema>;
export type CommitImportValues = z.output<typeof commitImportInputSchema>;
export type ImportItem = z.output<typeof importItemSchema>;
