import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v4';

import { getScopedDb } from '#/server/db';
import {
  materialCategorySchema,
  unitOfMeasureSchema,
} from '#/shared/schemas/material';

const CATALOG_LIMIT = 500;

export const LIST_MATERIALS_TOOL_NAME = 'leland_list_materials';

export const LIST_MATERIALS_TOOL_DESCRIPTION =
  'Returns the **Stylist**\'s full **Catalog** of **Materials**, used for matching **Receipt** lines before committing an **Import**. **Material** identity is exact on `(name, category, unitOfMeasure)` per **Stylist** — the server does no case-insensitive or fuzzy matching. Always call this **before** proposing `kind:"new"` items to `leland_commit_import`, with `includeArchived: true` during an **Import** so you can match against archived **Materials** before creating duplicates. Archived **Materials** stay valid for `kind:"existing"` and are returned with `isArchived: true`.';

const includeArchivedSchema = z
  .boolean()
  .optional()
  .default(false)
  .describe(
    'Default false. Set to true when matching Receipt lines against the Catalog so you can find archived Materials and avoid creating duplicate entries.',
  );

export const listMaterialsInputSchema = z
  .object({
    includeArchived: includeArchivedSchema,
  })
  .strict();

const listMaterialsInputShape = {
  includeArchived: includeArchivedSchema,
};

const listMaterialOutputSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    category: materialCategorySchema,
    unitOfMeasure: unitOfMeasureSchema,
    isArchived: z.boolean(),
  })
  .strict();

export const listMaterialsOutputSchema = z
  .object({
    materials: z.array(listMaterialOutputSchema),
  })
  .strict();

export type ListMaterial = z.output<typeof listMaterialOutputSchema>;
type ListMaterialsInput = z.output<typeof listMaterialsInputSchema>;

type BusinessErrorCode =
  | 'validation_failed'
  | 'catalog_too_large'
  | 'internal_error';

type BusinessError = {
  code: BusinessErrorCode;
  message: string;
  lineIndex?: number;
  conflictingLineIndex?: number;
  materialId?: string;
  clientRequestId?: string;
};

type ListMaterialRecord = {
  id: string;
  name: string;
  category: string;
  unitOfMeasure: string;
  isArchived: boolean;
};

type ListMaterialsFindManyArgs = {
  where?: { isArchived?: boolean };
  orderBy: Array<{ category: 'asc' } | { name: 'asc' } | { createdAt: 'asc' }>;
  select: {
    id: true;
    name: true;
    category: true;
    unitOfMeasure: true;
    isArchived: true;
  };
  take: number;
};

export type ListMaterialsDb = {
  material: {
    findMany: (
      args: ListMaterialsFindManyArgs,
    ) => Promise<Array<ListMaterialRecord>>;
  };
};

function businessErrorResult(error: BusinessError): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify(error) }],
    structuredContent: error,
  };
}

function successResult(materials: Array<ListMaterial>): CallToolResult {
  const structuredContent = { materials };

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
    message: `Invalid input for ${LIST_MATERIALS_TOOL_NAME}: ${issueMessage}`,
  });
}

function catalogTooLargeResult(): CallToolResult {
  return businessErrorResult({
    code: 'catalog_too_large',
    message:
      'Catalog contains more than 500 Materials. v1 cannot return it safely; a search or narrowing tool is needed in v2.',
  });
}

function internalErrorResult(): CallToolResult {
  return businessErrorResult({
    code: 'internal_error',
    message: 'Internal error while listing Materials.',
  });
}

function parseListMaterialsInput(input: unknown) {
  return listMaterialsInputSchema.safeParse(input ?? {});
}

function toListMaterial(material: ListMaterialRecord): ListMaterial {
  return {
    id: material.id,
    name: material.name,
    category: material.category as ListMaterial['category'],
    unitOfMeasure: material.unitOfMeasure as ListMaterial['unitOfMeasure'],
    isArchived: material.isArchived,
  };
}

export async function callListMaterials(
  input: unknown,
  db: ListMaterialsDb,
): Promise<CallToolResult> {
  const parsed = parseListMaterialsInput(input);

  if (!parsed.success) {
    return validationFailedResult(parsed.error);
  }

  try {
    const materials = await listMaterialsWithDb(parsed.data, db);

    if (materials.length > CATALOG_LIMIT) {
      return catalogTooLargeResult();
    }

    return successResult(materials);
  } catch (error) {
    console.error(`${LIST_MATERIALS_TOOL_NAME} failed`, error);

    return internalErrorResult();
  }
}

export async function listMaterialsWithDb(
  input: ListMaterialsInput,
  db: ListMaterialsDb,
) {
  const materials = await db.material.findMany({
    where: input.includeArchived ? undefined : { isArchived: false },
    select: {
      id: true,
      name: true,
      category: true,
      unitOfMeasure: true,
      isArchived: true,
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
    take: CATALOG_LIMIT + 1,
  });

  return materials.map(toListMaterial);
}

export function registerListMaterialsTool(server: McpServer, userId: string) {
  server.registerTool(
    LIST_MATERIALS_TOOL_NAME,
    {
      description: LIST_MATERIALS_TOOL_DESCRIPTION,
      inputSchema: listMaterialsInputShape,
      outputSchema: listMaterialsOutputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (input) =>
      callListMaterials(
        input,
        getScopedDb(userId) as unknown as ListMaterialsDb,
      ),
  );
}
