import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v4';

import { getScopedDb } from '#/server/db';
import { formatDateOnly, isValidDateOnly, parseDateOnly } from '#/shared/date';

const MAX_RANGE_INCLUSIVE_DAYS = 31;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const LIST_PURCHASES_TOOL_NAME = 'leland_list_purchases';

export const LIST_PURCHASES_TOOL_DESCRIPTION =
  "Returns **Purchases** within a bounded date window. Primary use case: duplicate detection before `leland_commit_import` — call with `date` set to the **Receipt**'s invoice date (Finnish: _Laskun pvm_), and compare each proposed item against the returned rows on the tuple `(materialId, totalQuantity, totalPrice)`. Exact-tuple matches are likely duplicates — skip them by default and confirm with the **Stylist** before overriding. Pass exactly one of: `date` (single day) **or** `from`/`to` (range, max 31 days).";

const dateOnlyStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD.')
  .refine((value) => isValidDateOnly(value), {
    message: 'Expected a valid calendar date in YYYY-MM-DD.',
  });

const dateSchema = dateOnlyStringSchema
  .optional()
  .describe(
    "Single ISO date YYYY-MM-DD. For Receipt duplicate detection, use the Receipt's invoice date (Finnish: 'Laskun pvm'). Not delivery date, not payment date.",
  );

const fromSchema = dateOnlyStringSchema
  .optional()
  .describe(
    "Inclusive ISO start date YYYY-MM-DD. Pair with 'to'. Range max 31 days.",
  );

const toSchema = dateOnlyStringSchema
  .optional()
  .describe(
    "Inclusive ISO end date YYYY-MM-DD. Pair with 'from'. Range max 31 days.",
  );

const listPurchasesInputShape = {
  date: dateSchema,
  from: fromSchema,
  to: toSchema,
};

export const listPurchasesInputSchema = z
  .object(listPurchasesInputShape)
  .strict()
  .superRefine((value, ctx) => {
    const hasDate = value.date !== undefined;
    const hasFrom = value.from !== undefined;
    const hasTo = value.to !== undefined;
    const hasRange = hasFrom || hasTo;

    if (!hasDate && !hasRange) {
      ctx.addIssue({
        code: 'custom',
        message: "Provide either 'date' or both 'from' and 'to'.",
      });

      return;
    }

    if (hasDate && hasRange) {
      ctx.addIssue({
        code: 'custom',
        message: "Provide either 'date' OR the pair ('from', 'to'), not both.",
      });

      return;
    }

    if (hasRange && (!hasFrom || !hasTo)) {
      ctx.addIssue({
        code: 'custom',
        message: "'from' and 'to' must be provided together.",
      });

      return;
    }

    if (hasFrom && hasTo) {
      if (value.from! > value.to!) {
        ctx.addIssue({
          code: 'custom',
          message: "'from' must be on or before 'to'.",
        });

        return;
      }

      const fromMs = parseDateOnly(value.from!).getTime();
      const toMs = parseDateOnly(value.to!).getTime();
      const inclusiveDays = (toMs - fromMs) / MS_PER_DAY + 1;

      if (inclusiveDays > MAX_RANGE_INCLUSIVE_DAYS) {
        ctx.addIssue({
          code: 'custom',
          message: `Date range cannot exceed ${MAX_RANGE_INCLUSIVE_DAYS} days (inclusive).`,
        });
      }
    }
  });

const listPurchaseOutputSchema = z
  .object({
    id: z.string(),
    materialId: z.string(),
    materialName: z.string(),
    totalQuantity: z.string(),
    totalPrice: z.string(),
    date: dateOnlyStringSchema,
  })
  .strict();

export const listPurchasesOutputSchema = z
  .object({
    purchases: z.array(listPurchaseOutputSchema),
  })
  .strict();

export type ListPurchase = z.output<typeof listPurchaseOutputSchema>;
type ListPurchasesInput = z.output<typeof listPurchasesInputSchema>;

type BusinessErrorCode = 'validation_failed' | 'internal_error';

type BusinessError = {
  code: BusinessErrorCode;
  message: string;
  lineIndex?: number;
  conflictingLineIndex?: number;
  materialId?: string;
  clientRequestId?: string;
};

type ListPurchaseRecord = {
  id: string;
  materialId: string;
  totalQuantity: { toString: () => string };
  totalPrice: { toString: () => string };
  date: Date;
  material: { name: string };
};

type ListPurchasesFindManyArgs = {
  where: { date: Date | { gte: Date; lte: Date } };
  select: {
    id: true;
    materialId: true;
    totalQuantity: true;
    totalPrice: true;
    date: true;
    material: { select: { name: true } };
  };
  orderBy: Array<{ date: 'desc' } | { createdAt: 'desc' }>;
};

export type ListPurchasesDb = {
  purchase: {
    findMany: (
      args: ListPurchasesFindManyArgs,
    ) => Promise<Array<ListPurchaseRecord>>;
  };
};

function businessErrorResult(error: BusinessError): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify(error) }],
    structuredContent: error,
  };
}

function successResult(purchases: Array<ListPurchase>): CallToolResult {
  const structuredContent = { purchases };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(structuredContent, null, 2),
      },
    ],
    structuredContent,
  };
}

function validationFailedResult(error: z.ZodError): CallToolResult {
  const [firstIssue] = error.issues;
  const issueMessage = firstIssue.message;

  return businessErrorResult({
    code: 'validation_failed',
    message: `Invalid input for ${LIST_PURCHASES_TOOL_NAME}: ${issueMessage}`,
  });
}

function internalErrorResult(): CallToolResult {
  return businessErrorResult({
    code: 'internal_error',
    message: 'Internal error while listing Purchases.',
  });
}

function parseListPurchasesInput(input: unknown) {
  return listPurchasesInputSchema.safeParse(input ?? {});
}

function toListPurchase(record: ListPurchaseRecord): ListPurchase {
  return {
    id: record.id,
    materialId: record.materialId,
    materialName: record.material.name,
    totalQuantity: record.totalQuantity.toString(),
    totalPrice: record.totalPrice.toString(),
    date: formatDateOnly(record.date),
  };
}

export async function callListPurchases(
  input: unknown,
  db: ListPurchasesDb,
): Promise<CallToolResult> {
  const parsed = parseListPurchasesInput(input);

  if (!parsed.success) {
    return validationFailedResult(parsed.error);
  }

  try {
    const purchases = await listPurchasesWithDb(parsed.data, db);

    return successResult(purchases);
  } catch (error) {
    console.error(`${LIST_PURCHASES_TOOL_NAME} failed`, error);

    return internalErrorResult();
  }
}

export async function listPurchasesWithDb(
  input: ListPurchasesInput,
  db: ListPurchasesDb,
) {
  const where = input.date
    ? { date: parseDateOnly(input.date) }
    : {
        date: {
          gte: parseDateOnly(input.from!),
          lte: parseDateOnly(input.to!),
        },
      };

  const purchases = await db.purchase.findMany({
    where,
    select: {
      id: true,
      materialId: true,
      totalQuantity: true,
      totalPrice: true,
      date: true,
      material: { select: { name: true } },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });

  return purchases.map(toListPurchase);
}

export function registerListPurchasesTool(server: McpServer, userId: string) {
  server.registerTool(
    LIST_PURCHASES_TOOL_NAME,
    {
      description: LIST_PURCHASES_TOOL_DESCRIPTION,
      inputSchema: listPurchasesInputShape,
      outputSchema: listPurchasesOutputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (input) =>
      callListPurchases(
        input,
        getScopedDb(userId) as unknown as ListPurchasesDb,
      ),
  );
}
