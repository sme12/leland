import { computeMaterialAggregate } from '#/domain/cost';

type DecimalLike = { toString: () => string };

export type MaterialStockFields = {
  purchased: string;
  used: string;
  remaining: string;
};

export type MaterialStockSource = {
  id: string;
  purchases?: Array<{
    materialId: string;
    totalQuantity: DecimalLike;
  }>;
  lineItems?: Array<{
    materialId: string;
    amount: DecimalLike;
  }>;
};

export function computeMaterialStockFields(
  material: MaterialStockSource,
): MaterialStockFields {
  const aggregate = computeMaterialAggregate(
    (material.purchases ?? []).map((purchase) => ({
      materialId: purchase.materialId,
      totalQuantity: purchase.totalQuantity.toString(),
    })),
    (material.lineItems ?? []).map((lineItem) => ({
      materialId: lineItem.materialId,
      amount: lineItem.amount.toString(),
    })),
  );

  return {
    purchased: aggregate.purchased.toString(),
    used: aggregate.used.toString(),
    remaining: aggregate.remaining.toString(),
  };
}
