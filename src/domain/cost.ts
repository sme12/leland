import Decimal from 'decimal.js';

import type {
  CostLineItem,
  CostPurchase,
  MaterialAggregate,
  MaterialForAggregate,
  PeriodRange,
  PeriodTotals,
  VisitWithItems,
} from './types';

const ZERO = new Decimal(0);

function sumDecimal<T>(
  items: readonly T[],
  select: (item: T) => Decimal.Value,
) {
  return items.reduce((total, item) => total.add(select(item)), new Decimal(0));
}

export function computeUnitCost(
  purchases: readonly CostPurchase[],
  k = 3,
): Decimal {
  if (purchases.length === 0 || k <= 0) {
    return ZERO;
  }

  const windowSize = Math.trunc(k);

  if (windowSize <= 0) {
    return ZERO;
  }

  const recentPurchases = [...purchases]
    .sort((a, b) => {
      const dateDiff = b.date.getTime() - a.date.getTime();

      if (dateDiff !== 0) {
        return dateDiff;
      }

      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(0, windowSize);

  const totalPrice = sumDecimal(
    recentPurchases,
    (purchase) => purchase.totalPrice,
  );
  const totalQuantity = sumDecimal(
    recentPurchases,
    (purchase) => purchase.totalQuantity,
  );

  if (totalQuantity.isZero()) {
    return ZERO;
  }

  return totalPrice.div(totalQuantity);
}

export function computeNet(visit: VisitWithItems): Decimal {
  return new Decimal(visit.priceCharged).minus(
    sumDecimal(visit.lineItems, (item) => item.totalCost),
  );
}

export function computePeriodTotals(
  visits: readonly VisitWithItems[],
  range: PeriodRange,
): PeriodTotals {
  const [start, end] = range;
  const startTime = start.getTime();
  const endTime = end.getTime();
  const includedVisits = visits.filter((visit) => {
    const visitTime = visit.date.getTime();

    return visitTime >= startTime && visitTime <= endTime;
  });

  const revenue = sumDecimal(includedVisits, (visit) => visit.priceCharged);
  const cost = includedVisits.reduce(
    (total, visit) =>
      total.add(sumDecimal(visit.lineItems, (item) => item.totalCost)),
    new Decimal(0),
  );

  return {
    count: includedVisits.length,
    revenue,
    cost,
    net: revenue.minus(cost),
  };
}

export function computeMaterialAggregate(
  material: MaterialForAggregate,
  purchases: readonly CostPurchase[],
  lineItems: readonly CostLineItem[],
): MaterialAggregate {
  const materialPurchases = purchases.filter(
    (purchase) => purchase.materialId === material.id,
  );
  const materialLineItems = lineItems.filter(
    (lineItem) => lineItem.materialId === material.id,
  );
  const purchased = sumDecimal(
    materialPurchases,
    (purchase) => purchase.totalQuantity,
  );
  const used = sumDecimal(materialLineItems, (lineItem) => lineItem.amount);

  return {
    purchased,
    used,
    remaining: purchased.minus(used),
  };
}
