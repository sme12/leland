import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v4';

import type { CorrectPurchaseInput } from '#/shared/schemas/purchase-correction';
import type {
  CorrectPurchaseResult,
  PurchaseCorrectionErrorDetails,
} from '#/server/purchase-corrections';
import { correctPurchaseInputSchema } from '#/shared/schemas/purchase-correction';
import {
  correctPurchase,
  isPurchaseCorrectionError,
} from '#/server/purchase-corrections';
import { extractClientRequestId } from '#/server/mcp/error-helpers';

export const CORRECT_PURCHASE_TOOL_NAME = 'leland_correct_purchase';

export const CORRECT_PURCHASE_TOOL_DESCRIPTION =
  'Corrects one existing **Purchase** so it matches the original **Receipt** or other real-world source. Before calling, reload the relevant **Purchases** with `leland_list_purchases`, and call `leland_list_materials({ includeArchived: true })` if the Material may need correction. Always present the complete before/after state to the **Stylist** and obtain explicit confirmation. This tool replaces the full final `materialId`, `totalQuantity`, `totalPrice`, and `date` values for exactly one **Purchase**; it does not create **Materials**, create missing **Purchases**, delete extra **Purchases**, parse files, or persist **Receipts**. The `expected` block is a compare-and-replace guard: if the live **Purchase** no longer matches it, the tool returns `stale_purchase` with the current values instead of overwriting. Active and archived **Materials** are valid replacement targets. Duplicate-shaped corrections are allowed after confirmation. Not retry-safe: after a successful correction, retrying the same payload returns `stale_purchase` because the live **Purchase** now matches `replacement`, not `expected`. Reload with `leland_list_purchases` before any retry.';

const purchaseCorrectionSnapshotSchema = z
  .object({
    id: z.string(),
    materialId: z.string(),
    materialName: z.string(),
    totalQuantity: z.string(),
    totalPrice: z.string(),
    date: z.string(),
  })
  .strict();

export const correctPurchaseOutputSchema = z
  .object({
    purchase: purchaseCorrectionSnapshotSchema,
    changed: z.boolean(),
  })
  .strict();

export const purchaseCorrectionErrorOutputSchema = z
  .object({
    code: z.enum([
      'validation_failed',
      'purchase_not_found',
      'material_not_found',
      'stale_purchase',
      'internal_error',
    ]),
    message: z.string(),
    clientRequestId: z.string().optional(),
    currentPurchase: purchaseCorrectionSnapshotSchema.optional(),
  })
  .strict();

type CorrectPurchaseHandler = (
  userId: string,
  input: CorrectPurchaseInput,
) => Promise<CorrectPurchaseResult>;

function successResult(result: CorrectPurchaseResult): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
    structuredContent: result,
  };
}

function errorResult(error: PurchaseCorrectionErrorDetails): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify(error) }],
    structuredContent: error,
  };
}

function internalErrorResult(clientRequestId: string | undefined) {
  return errorResult({
    code: 'internal_error',
    message: 'Internal error while correcting Purchase.',
    ...(clientRequestId ? { clientRequestId } : {}),
  });
}

export async function callCorrectPurchase(
  input: unknown,
  userId: string,
  correct: CorrectPurchaseHandler = correctPurchase,
): Promise<CallToolResult> {
  try {
    const result = await correct(userId, input as CorrectPurchaseInput);

    return successResult(result);
  } catch (error) {
    if (isPurchaseCorrectionError(error)) {
      return errorResult(error.correctionError);
    }

    console.error(`${CORRECT_PURCHASE_TOOL_NAME} failed`, error);

    return internalErrorResult(extractClientRequestId(input));
  }
}

export function registerCorrectPurchaseTool(server: McpServer, userId: string) {
  server.registerTool(
    CORRECT_PURCHASE_TOOL_NAME,
    {
      description: CORRECT_PURCHASE_TOOL_DESCRIPTION,
      inputSchema: correctPurchaseInputSchema,
      outputSchema: correctPurchaseOutputSchema,
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: true,
        openWorldHint: true,
      },
    },
    async (input) => callCorrectPurchase(input, userId),
  );
}
