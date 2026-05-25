import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v4';

import type { CommitImportInput } from '#/shared/schemas/import';
import { commitImportInputSchema } from '#/shared/schemas/import';
import type { CommitImportResult, ImportError } from '#/server/imports';
import { commitImport, isImportCommitError } from '#/server/imports';
import { extractClientRequestId } from '#/server/mcp/error-helpers';

export const COMMIT_IMPORT_TOOL_NAME = 'leland_commit_import';

export const COMMIT_IMPORT_TOOL_DESCRIPTION =
  'Atomically commits an **Import**: creates new **Materials** and their **Purchases** in one Prisma transaction. Every line lands or none does — there is no partial success. **Always** present a per-line summary to the **Stylist** and obtain explicit confirmation before calling this tool; there is no preview/dry-run mode. v1 imports only positive **Material** acquisition lines from the **Receipt** — skip shipping fees, payment fees, **Receipt** totals, VAT summary rows, and negative return/credit rows. If a **Receipt**-level discount or credit cannot be cleanly allocated to **Material** lines, ask the **Stylist** to adjust the proposed totals before calling. If you do not receive a clean response from this call (network failure, timeout, unclear error), do **not** retry blindly: call `leland_list_purchases({ date })` first to verify which items landed, then retry only the missing ones. If duplicates surface unexpectedly during verification, stop and ask the **Stylist**.';

export const commitImportOutputSchema = z
  .object({
    createdMaterialIds: z.array(z.string()),
    createdPurchaseIds: z.array(z.string()),
  })
  .strict();

export const importErrorOutputSchema = z
  .object({
    code: z.enum([
      'validation_failed',
      'material_not_found',
      'material_conflict',
      'duplicate_material',
      'unit_mismatch',
      'internal_error',
    ]),
    message: z.string(),
    lineIndex: z.number().optional(),
    conflictingLineIndex: z.number().optional(),
    materialId: z.string().optional(),
    clientRequestId: z.string().optional(),
  })
  .strict();

type CommitImportHandler = (
  userId: string,
  input: CommitImportInput,
) => Promise<CommitImportResult>;

function successResult(result: CommitImportResult): CallToolResult {
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

function errorResult(error: ImportError): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify(error) }],
    structuredContent: error,
  };
}

function internalErrorResult(clientRequestId: string | undefined) {
  return errorResult({
    code: 'internal_error',
    message: 'Internal error while committing Import.',
    ...(clientRequestId ? { clientRequestId } : {}),
  });
}

export async function callCommitImport(
  input: unknown,
  userId: string,
  commit: CommitImportHandler = commitImport,
): Promise<CallToolResult> {
  try {
    const result = await commit(userId, input as CommitImportInput);

    return successResult(result);
  } catch (error) {
    if (isImportCommitError(error)) {
      return errorResult(error.importError);
    }

    console.error(`${COMMIT_IMPORT_TOOL_NAME} failed`, error);

    return internalErrorResult(extractClientRequestId(input));
  }
}

export function registerCommitImportTool(server: McpServer, userId: string) {
  server.registerTool(
    COMMIT_IMPORT_TOOL_NAME,
    {
      description: COMMIT_IMPORT_TOOL_DESCRIPTION,
      // Pass the full ZodObject (not a raw shape like the read tools) so the
      // discriminated union, `.strict()`, and per-item superRefine all survive
      // into the JSON Schema the agent sees — including `additionalProperties:
      // false`. The SDK accepts both forms; a raw shape would be re-wrapped
      // without strict mode.
      inputSchema: commitImportInputSchema,
      outputSchema: commitImportOutputSchema,
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: true,
        openWorldHint: true,
      },
    },
    async (input) => callCommitImport(input, userId),
  );
}
