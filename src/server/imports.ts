import type { MaterialCategory, UnitOfMeasure } from '#/shared/enums';
import type {
  CommitImportInput,
  CommitImportValues,
} from '#/shared/schemas/import';
import { commitImportInputSchema } from '#/shared/schemas/import';
import {
  positiveIntegerStringSchema,
  parseDateOnly,
} from '#/shared/schemas/purchase';
import { getScopedDb, prisma } from './db';

const MATERIAL_IDENTITY_UNIQUE_INDEX =
  'materials_user_id_name_category_unit_of_measure_key';

export type ImportErrorCode =
  | 'validation_failed'
  | 'material_not_found'
  | 'material_conflict'
  | 'duplicate_material'
  | 'unit_mismatch'
  | 'internal_error';

export type ImportError = {
  code: ImportErrorCode;
  message: string;
  lineIndex?: number;
  conflictingLineIndex?: number;
  materialId?: string;
  clientRequestId?: string;
};

export type CommitImportResult = {
  createdMaterialIds: string[];
  createdPurchaseIds: string[];
};

export class ImportCommitError extends Error {
  readonly importError: ImportError;

  constructor(details: ImportError) {
    super(details.message);
    this.name = 'ImportCommitError';
    this.importError = details;
  }
}

type MaterialRecord = {
  id: string;
  name: string;
  category: MaterialCategory;
  unitOfMeasure: UnitOfMeasure;
  isArchived: boolean;
};

type MaterialFindManyArgs = {
  select: {
    id: true;
    name: true;
    category: true;
    unitOfMeasure: true;
    isArchived: true;
  };
  orderBy: Array<{ category: 'asc' } | { name: 'asc' } | { createdAt: 'asc' }>;
};

type MaterialFindFirstArgs = {
  where: {
    name: string;
    category: MaterialCategory;
    unitOfMeasure: UnitOfMeasure;
  };
  select: { id: true };
};

type MaterialCreateArgs = {
  data: {
    name: string;
    category: MaterialCategory;
    unitOfMeasure: UnitOfMeasure;
  };
  select: { id: true };
};

type PurchaseCreateArgs = {
  data: {
    materialId: string;
    totalQuantity: string;
    totalPrice: string;
    date: Date;
  };
  select: { id: true };
};

export type CommitImportDb = {
  material: {
    findMany: (args: MaterialFindManyArgs) => Promise<Array<MaterialRecord>>;
    findFirst: (args: MaterialFindFirstArgs) => Promise<{ id: string } | null>;
    create: (args: MaterialCreateArgs) => Promise<{ id: string }>;
  };
  purchase: {
    create: (args: PurchaseCreateArgs) => Promise<{ id: string }>;
  };
};

type CommitImportLogger = Pick<Console, 'info' | 'warn'>;

type CommitImportDependencies = {
  db: CommitImportDb;
  logger: CommitImportLogger;
  runTransaction: <T>(
    callback: (db: CommitImportDb) => Promise<T>,
  ) => Promise<T>;
};

type MaterialIdentity = {
  name: string;
  category: MaterialCategory;
  unitOfMeasure: UnitOfMeasure;
};

type PendingMaterialInsert = {
  lineIndex: number;
  material: MaterialIdentity;
};

export function isImportCommitError(
  error: unknown,
): error is ImportCommitError {
  return error instanceof ImportCommitError;
}

function withClientRequestId(
  error: Omit<ImportError, 'clientRequestId'>,
  clientRequestId: string | undefined,
): ImportError {
  return clientRequestId ? { ...error, clientRequestId } : error;
}

function importError(
  error: Omit<ImportError, 'clientRequestId'>,
  clientRequestId: string | undefined,
): ImportCommitError {
  return new ImportCommitError(withClientRequestId(error, clientRequestId));
}

function validationError(
  message: string,
  clientRequestId: string | undefined,
  lineIndex?: number,
) {
  return importError(
    {
      code: 'validation_failed',
      message,
      lineIndex,
    },
    clientRequestId,
  );
}

function materialIdentityKey(identity: MaterialIdentity) {
  return `${identity.name}\u0000${identity.category}\u0000${identity.unitOfMeasure}`;
}

function materialNameCategoryKey(
  identity: Pick<MaterialIdentity, 'name' | 'category'>,
) {
  return `${identity.name}\u0000${identity.category}`;
}

export function extractClientRequestId(input: unknown) {
  if (
    input &&
    typeof input === 'object' &&
    'clientRequestId' in input &&
    typeof input.clientRequestId === 'string'
  ) {
    return input.clientRequestId;
  }

  return undefined;
}

function throwDuplicateMaterial(
  lineIndex: number,
  conflictingLineIndex: number,
  clientRequestId: string | undefined,
): never {
  throw importError(
    {
      code: 'duplicate_material',
      message: `Lines ${conflictingLineIndex} and ${lineIndex} refer to the same Material; collapse them into one Purchase before committing.`,
      lineIndex,
      conflictingLineIndex,
    },
    clientRequestId,
  );
}

function assertNoSameBatchDuplicates(
  input: CommitImportValues,
  clientRequestId: string | undefined,
) {
  const existingById = new Map<string, number>();
  const newByIdentity = new Map<string, number>();

  input.items.forEach((item, lineIndex) => {
    if (item.kind === 'existing') {
      const previousLineIndex = existingById.get(item.materialId);

      if (previousLineIndex !== undefined) {
        throwDuplicateMaterial(lineIndex, previousLineIndex, clientRequestId);
      }

      existingById.set(item.materialId, lineIndex);

      return;
    }

    const key = materialIdentityKey(item.material);
    const previousLineIndex = newByIdentity.get(key);

    if (previousLineIndex !== undefined) {
      throwDuplicateMaterial(lineIndex, previousLineIndex, clientRequestId);
    }

    newByIdentity.set(key, lineIndex);
  });
}

function indexMaterials(materials: Array<MaterialRecord>) {
  const byId = new Map<string, MaterialRecord>();
  const byIdentity = new Map<string, MaterialRecord>();
  const byNameCategory = new Map<string, Array<MaterialRecord>>();

  materials.forEach((material) => {
    byId.set(material.id, material);
    byIdentity.set(materialIdentityKey(material), material);

    const nameCategoryKey = materialNameCategoryKey(material);
    const matches = byNameCategory.get(nameCategoryKey) ?? [];
    matches.push(material);
    byNameCategory.set(nameCategoryKey, matches);
  });

  return { byId, byIdentity, byNameCategory };
}

function assertPieceQuantityIsInteger(
  lineIndex: number,
  totalQuantity: string,
  clientRequestId: string | undefined,
) {
  if (!positiveIntegerStringSchema.safeParse(totalQuantity).success) {
    throw validationError(
      "Invalid import payload: unitOfMeasure:'piece' requires integer totalQuantity.",
      clientRequestId,
      lineIndex,
    );
  }
}

function assertCatalogCompatibility(
  input: CommitImportValues,
  materials: Array<MaterialRecord>,
  clientRequestId: string | undefined,
) {
  const { byId, byIdentity, byNameCategory } = indexMaterials(materials);

  input.items.forEach((item, lineIndex) => {
    if (item.kind === 'existing') {
      const material = byId.get(item.materialId);

      if (!material) {
        throw importError(
          {
            code: 'material_not_found',
            message: `Material id \`${item.materialId}\` does not belong to this Stylist.`,
            lineIndex,
          },
          clientRequestId,
        );
      }

      if (material.unitOfMeasure === 'piece') {
        assertPieceQuantityIsInteger(
          lineIndex,
          item.totalQuantity,
          clientRequestId,
        );
      }

      return;
    }

    const exactMatch = byIdentity.get(materialIdentityKey(item.material));

    if (exactMatch) {
      throw importError(
        {
          code: 'material_conflict',
          message: `New material '${item.material.name}' conflicts with existing Material id \`${exactMatch.id}\`; retry that line with kind:"existing".`,
          lineIndex,
          materialId: exactMatch.id,
        },
        clientRequestId,
      );
    }

    const sameNameCategory = byNameCategory.get(
      materialNameCategoryKey(item.material),
    );
    const hasDifferentUnit = sameNameCategory?.some(
      (material) => material.unitOfMeasure !== item.material.unitOfMeasure,
    );

    if (hasDifferentUnit) {
      throw importError(
        {
          code: 'unit_mismatch',
          message: `New material '${item.material.name}' matches an existing Material with the same name and category but a different unitOfMeasure.`,
          lineIndex,
        },
        clientRequestId,
      );
    }
  });
}

function materialNamesForLog(
  input: CommitImportValues,
  materials: Array<MaterialRecord>,
) {
  const byId = new Map(materials.map((material) => [material.id, material]));

  return input.items.map((item) => {
    if (item.kind === 'new') {
      return item.material.name;
    }

    // The log runs before assertCatalogCompatibility, so a cross-Stylist or
    // otherwise-unknown materialId won't resolve here. Keep the id in the log
    // so the offending line is still identifiable from operational logs.
    return byId.get(item.materialId)?.name ?? `unresolved:${item.materialId}`;
  });
}

function logCommitImportCall(
  userId: string,
  input: CommitImportValues,
  materials: Array<MaterialRecord>,
  logger: CommitImportLogger,
) {
  logger.info('leland_commit_import called', {
    userId,
    clientRequestId: input.clientRequestId,
    lineCount: input.items.length,
    materialNames: materialNamesForLog(input, materials),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

type P2002LikeError = {
  code: 'P2002';
  meta?: unknown;
};

function isP2002(error: unknown): error is P2002LikeError {
  return isRecord(error) && error.code === 'P2002';
}

function isMaterialIdentityP2002(error: unknown) {
  if (!isP2002(error) || !isRecord(error.meta)) {
    return false;
  }

  const target = error.meta.target;
  const constraint = error.meta.constraint;

  if (
    target === MATERIAL_IDENTITY_UNIQUE_INDEX ||
    constraint === MATERIAL_IDENTITY_UNIQUE_INDEX
  ) {
    return true;
  }

  if (!Array.isArray(target)) {
    return false;
  }

  const targetFields = new Set(target);
  const camelCaseFields = ['userId', 'name', 'category', 'unitOfMeasure'];
  const dbFields = ['user_id', 'name', 'category', 'unit_of_measure'];

  return (
    camelCaseFields.every((field) => targetFields.has(field)) ||
    dbFields.every((field) => targetFields.has(field))
  );
}

async function loadCatalog(db: CommitImportDb) {
  // No catalog cap here: leland_list_materials already enforces the 500-Material
  // limit, so any agent that produced a valid commit_import payload has already
  // observed the cap. If a future code path bypasses list_materials, revisit.
  return db.material.findMany({
    select: {
      id: true,
      name: true,
      category: true,
      unitOfMeasure: true,
      isArchived: true,
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
  });
}

async function resolveRaceMaterialId(
  pendingInsert: PendingMaterialInsert,
  db: CommitImportDb,
) {
  const material = await db.material.findFirst({
    where: {
      name: pendingInsert.material.name,
      category: pendingInsert.material.category,
      unitOfMeasure: pendingInsert.material.unitOfMeasure,
    },
    select: { id: true },
  });

  return material?.id;
}

function p2002RaceConflictError(
  pendingInsert: PendingMaterialInsert,
  materialId: string,
  clientRequestId: string | undefined,
) {
  return importError(
    {
      code: 'material_conflict',
      message: `New material '${pendingInsert.material.name}' conflicts with existing Material id \`${materialId}\`; retry that line with kind:"existing".`,
      lineIndex: pendingInsert.lineIndex,
      materialId,
    },
    clientRequestId,
  );
}

export async function commitImportWithDependencies(
  userId: string,
  input: CommitImportInput,
  deps: CommitImportDependencies,
): Promise<CommitImportResult> {
  const parsed = commitImportInputSchema.safeParse(input);
  const fallbackClientRequestId = extractClientRequestId(input);

  if (!parsed.success) {
    const [firstIssue] = parsed.error.issues;

    throw validationError(
      `Invalid import payload: ${firstIssue.message}`,
      fallbackClientRequestId,
    );
  }

  const clientRequestId = parsed.data.clientRequestId;
  const raceState: { pendingInsert: PendingMaterialInsert | null } = {
    pendingInsert: null,
  };

  try {
    return await deps.runTransaction(async (db) => {
      const materials = await loadCatalog(db);

      logCommitImportCall(userId, parsed.data, materials, deps.logger);
      assertNoSameBatchDuplicates(parsed.data, clientRequestId);
      assertCatalogCompatibility(parsed.data, materials, clientRequestId);

      const createdMaterialIds: string[] = [];
      const createdPurchaseIds: string[] = [];
      const importDate = parseDateOnly(parsed.data.date);

      for (const [lineIndex, item] of parsed.data.items.entries()) {
        let materialId: string;

        if (item.kind === 'existing') {
          materialId = item.materialId;
        } else {
          raceState.pendingInsert = {
            lineIndex,
            material: {
              name: item.material.name,
              category: item.material.category,
              unitOfMeasure: item.material.unitOfMeasure,
            },
          };

          const material = await db.material.create({
            data: item.material,
            select: { id: true },
          });

          raceState.pendingInsert = null;
          materialId = material.id;
          createdMaterialIds.push(material.id);
        }

        const purchase = await db.purchase.create({
          data: {
            materialId,
            totalQuantity: item.totalQuantity,
            totalPrice: item.totalPrice,
            date: importDate,
          },
          select: { id: true },
        });

        createdPurchaseIds.push(purchase.id);
      }

      return { createdMaterialIds, createdPurchaseIds };
    });
  } catch (error) {
    if (isImportCommitError(error)) {
      throw error;
    }

    const pendingInsert = raceState.pendingInsert;

    if (pendingInsert && isMaterialIdentityP2002(error)) {
      const materialId = await resolveRaceMaterialId(pendingInsert, deps.db);

      if (materialId) {
        deps.logger.warn('leland_commit_import material conflict race', {
          userId,
          clientRequestId,
          lineIndex: pendingInsert.lineIndex,
          materialName: pendingInsert.material.name,
          category: pendingInsert.material.category,
          unitOfMeasure: pendingInsert.material.unitOfMeasure,
        });

        throw p2002RaceConflictError(
          pendingInsert,
          materialId,
          clientRequestId,
        );
      }
    }

    throw error;
  }
}

export async function commitImport(
  userId: string,
  input: CommitImportInput,
): Promise<CommitImportResult> {
  // `CommitImportDb` is a structural narrowing of Prisma's wider Material /
  // Purchase delegates (only the args/fields this helper needs). The double
  // cast trades exact compile-time typing for a small, intentional surface —
  // the same pattern is used by the other MCP tool registrations.
  const db = getScopedDb(userId) as unknown as CommitImportDb;

  return commitImportWithDependencies(userId, input, {
    db,
    logger: console,
    runTransaction: (callback) =>
      prisma.$transaction((tx) =>
        callback(getScopedDb(userId, tx) as unknown as CommitImportDb),
      ),
  });
}
