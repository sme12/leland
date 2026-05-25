import Decimal from 'decimal.js';

import type { UnitOfMeasure } from '#/shared/enums';
import type {
  CorrectPurchaseInput,
  CorrectPurchaseValues,
  PurchaseCorrectionValues,
} from '#/shared/schemas/purchase-correction';
import {
  correctPurchaseInputSchema,
  isPositiveIntegerQuantity,
} from '#/shared/schemas/purchase-correction';
import { formatDateOnly, parseDateOnly } from '#/shared/schemas/purchase';
import {
  extractClientRequestId,
  humanizeIssueMessage,
  withClientRequestId,
} from './mcp/error-helpers';
import { getScopedDb, prisma } from './db';

export type PurchaseCorrectionSnapshot = {
  id: string;
  materialId: string;
  materialName: string;
  totalQuantity: string;
  totalPrice: string;
  date: string;
};

export type CorrectPurchaseResult = {
  purchase: PurchaseCorrectionSnapshot;
  changed: boolean;
};

export type PurchaseCorrectionErrorCode =
  | 'validation_failed'
  | 'purchase_not_found'
  | 'material_not_found'
  | 'stale_purchase'
  | 'internal_error';

export type PurchaseCorrectionErrorDetails = {
  code: PurchaseCorrectionErrorCode;
  message: string;
  clientRequestId?: string;
  currentPurchase?: PurchaseCorrectionSnapshot;
};

export class PurchaseCorrectionError extends Error {
  readonly correctionError: PurchaseCorrectionErrorDetails;

  constructor(details: PurchaseCorrectionErrorDetails) {
    super(details.message);
    this.name = 'PurchaseCorrectionError';
    this.correctionError = details;
  }
}

type DecimalLike = {
  toString: () => string;
};

type PurchaseRecord = {
  id: string;
  materialId: string;
  totalQuantity: DecimalLike;
  totalPrice: DecimalLike;
  date: Date;
  material: { name: string };
};

type MaterialRecord = {
  id: string;
  name: string;
  unitOfMeasure: UnitOfMeasure;
  isArchived: boolean;
};

type PurchaseFindFirstArgs = {
  where: { id: string };
  select: {
    id: true;
    materialId: true;
    totalQuantity: true;
    totalPrice: true;
    date: true;
    material: { select: { name: true } };
  };
};

type PurchaseUpdateManyArgs = {
  where: {
    id: string;
    materialId?: string;
    totalQuantity?: string;
    totalPrice?: string;
    date?: Date;
  };
  data: {
    materialId: string;
    totalQuantity: string;
    totalPrice: string;
    date: Date;
  };
};

type MaterialFindFirstArgs = {
  where: { id: string };
  select: {
    id: true;
    name: true;
    unitOfMeasure: true;
    isArchived: true;
  };
};

export type CorrectPurchaseDb = {
  material: {
    findFirst: (args: MaterialFindFirstArgs) => Promise<MaterialRecord | null>;
  };
  purchase: {
    findFirst: (args: PurchaseFindFirstArgs) => Promise<PurchaseRecord | null>;
    updateMany: (args: PurchaseUpdateManyArgs) => Promise<{ count: number }>;
  };
};

type CorrectPurchaseLogger = Pick<Console, 'info'>;

type CorrectPurchaseDependencies = {
  db: CorrectPurchaseDb;
  logger: CorrectPurchaseLogger;
  runTransaction: <T>(
    callback: (db: CorrectPurchaseDb) => Promise<T>,
  ) => Promise<T>;
};

export function isPurchaseCorrectionError(
  error: unknown,
): error is PurchaseCorrectionError {
  return error instanceof PurchaseCorrectionError;
}

function correctionError(
  error: Omit<PurchaseCorrectionErrorDetails, 'clientRequestId'>,
  clientRequestId: string | undefined,
) {
  return new PurchaseCorrectionError(
    withClientRequestId<PurchaseCorrectionErrorDetails>(error, clientRequestId),
  );
}

function validationError(message: string, clientRequestId: string | undefined) {
  return correctionError(
    {
      code: 'validation_failed',
      message,
    },
    clientRequestId,
  );
}

function materialNotFoundError(
  materialId: string,
  clientRequestId: string | undefined,
) {
  return correctionError(
    {
      code: 'material_not_found',
      message: `Material id \`${materialId}\` does not belong to this Stylist.`,
    },
    clientRequestId,
  );
}

function purchaseNotFoundError(
  purchaseId: string,
  clientRequestId: string | undefined,
) {
  return correctionError(
    {
      code: 'purchase_not_found',
      message: `Purchase id \`${purchaseId}\` does not belong to this Stylist.`,
    },
    clientRequestId,
  );
}

function stalePurchaseError(
  currentPurchase: PurchaseCorrectionSnapshot,
  clientRequestId: string | undefined,
) {
  return correctionError(
    {
      code: 'stale_purchase',
      message:
        'Purchase changed since it was listed; reload it before correcting.',
      currentPurchase,
    },
    clientRequestId,
  );
}

function purchaseSelect(): PurchaseFindFirstArgs['select'] {
  return {
    id: true,
    materialId: true,
    totalQuantity: true,
    totalPrice: true,
    date: true,
    material: { select: { name: true } },
  };
}

async function loadPurchase(db: CorrectPurchaseDb, purchaseId: string) {
  return db.purchase.findFirst({
    where: { id: purchaseId },
    select: purchaseSelect(),
  });
}

async function loadMaterial(db: CorrectPurchaseDb, materialId: string) {
  return db.material.findFirst({
    where: { id: materialId },
    select: {
      id: true,
      name: true,
      unitOfMeasure: true,
      isArchived: true,
    },
  });
}

function toSnapshot(record: PurchaseRecord): PurchaseCorrectionSnapshot {
  return {
    id: record.id,
    materialId: record.materialId,
    materialName: record.material.name,
    totalQuantity: record.totalQuantity.toString(),
    totalPrice: record.totalPrice.toString(),
    date: formatDateOnly(record.date),
  };
}

function decimalEquals(actual: DecimalLike | string, expected: string) {
  return new Decimal(actual.toString()).eq(expected);
}

function purchaseMatchesValues(
  purchase: PurchaseRecord,
  values: PurchaseCorrectionValues,
) {
  return (
    purchase.materialId === values.materialId &&
    decimalEquals(purchase.totalQuantity, values.totalQuantity) &&
    decimalEquals(purchase.totalPrice, values.totalPrice) &&
    formatDateOnly(purchase.date) === values.date
  );
}

function assertReplacementCompatibility(
  replacement: PurchaseCorrectionValues,
  material: MaterialRecord,
  clientRequestId: string | undefined,
) {
  if (
    material.unitOfMeasure === 'piece' &&
    !isPositiveIntegerQuantity(replacement.totalQuantity)
  ) {
    throw validationError(
      "Invalid correction payload: unitOfMeasure:'piece' requires integer replacement totalQuantity.",
      clientRequestId,
    );
  }
}

function expectedWhere(
  purchaseId: string,
  expected: PurchaseCorrectionValues,
): PurchaseUpdateManyArgs['where'] {
  return {
    id: purchaseId,
    materialId: expected.materialId,
    totalQuantity: expected.totalQuantity,
    totalPrice: expected.totalPrice,
    date: parseDateOnly(expected.date),
  };
}

function replacementData(
  replacement: PurchaseCorrectionValues,
): PurchaseUpdateManyArgs['data'] {
  return {
    materialId: replacement.materialId,
    totalQuantity: replacement.totalQuantity,
    totalPrice: replacement.totalPrice,
    date: parseDateOnly(replacement.date),
  };
}

function logCorrectPurchaseCall(
  userId: string,
  input: CorrectPurchaseValues,
  logger: CorrectPurchaseLogger,
) {
  logger.info('leland_correct_purchase called', {
    userId,
    clientRequestId: input.clientRequestId,
    purchaseId: input.purchaseId,
    replacementMaterialId: input.replacement.materialId,
  });
}

export async function correctPurchaseWithDependencies(
  userId: string,
  input: CorrectPurchaseInput,
  deps: CorrectPurchaseDependencies,
): Promise<CorrectPurchaseResult> {
  const parsed = correctPurchaseInputSchema.safeParse(input);
  const fallbackClientRequestId = extractClientRequestId(input);

  if (!parsed.success) {
    const [firstIssue] = parsed.error.issues;
    const fieldPath = firstIssue.path.join('.') || '(root)';

    throw validationError(
      `Invalid correction payload at ${fieldPath}: ${humanizeIssueMessage(firstIssue.message)}`,
      fallbackClientRequestId,
    );
  }

  const clientRequestId = parsed.data.clientRequestId;

  return deps.runTransaction(async (db) => {
    logCorrectPurchaseCall(userId, parsed.data, deps.logger);

    const replacementMaterial = await loadMaterial(
      db,
      parsed.data.replacement.materialId,
    );

    if (!replacementMaterial) {
      throw materialNotFoundError(
        parsed.data.replacement.materialId,
        clientRequestId,
      );
    }

    assertReplacementCompatibility(
      parsed.data.replacement,
      replacementMaterial,
      clientRequestId,
    );

    const current = await loadPurchase(db, parsed.data.purchaseId);

    if (!current) {
      throw purchaseNotFoundError(parsed.data.purchaseId, clientRequestId);
    }

    if (!purchaseMatchesValues(current, parsed.data.expected)) {
      throw stalePurchaseError(toSnapshot(current), clientRequestId);
    }

    if (purchaseMatchesValues(current, parsed.data.replacement)) {
      // No-op: skip updateMany (and its SQL guard); the snapshot is the row at read time.
      return { purchase: toSnapshot(current), changed: false };
    }

    const result = await db.purchase.updateMany({
      where: expectedWhere(parsed.data.purchaseId, parsed.data.expected),
      data: replacementData(parsed.data.replacement),
    });

    if (result.count === 0) {
      const nextCurrent = await loadPurchase(db, parsed.data.purchaseId);

      if (!nextCurrent) {
        throw purchaseNotFoundError(parsed.data.purchaseId, clientRequestId);
      }

      throw stalePurchaseError(toSnapshot(nextCurrent), clientRequestId);
    }

    const updated = await loadPurchase(db, parsed.data.purchaseId);

    if (!updated) {
      throw new Error('Corrected Purchase missing after update.');
    }

    return { purchase: toSnapshot(updated), changed: true };
  });
}

export async function correctPurchase(
  userId: string,
  input: CorrectPurchaseInput,
): Promise<CorrectPurchaseResult> {
  const db = getScopedDb(userId) as unknown as CorrectPurchaseDb;

  return correctPurchaseWithDependencies(userId, input, {
    db,
    logger: console,
    runTransaction: (callback) =>
      prisma.$transaction((tx) =>
        callback(getScopedDb(userId, tx) as unknown as CorrectPurchaseDb),
      ),
  });
}
