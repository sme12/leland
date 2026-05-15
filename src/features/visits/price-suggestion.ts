import Decimal from 'decimal.js';

const quantityPattern = /^(0|[1-9]\d*)(\.\d{1,2})?$/;

export type PriceSuggestionLineItem = {
  materialId: string;
  amount: string;
  unitCost?: string;
};

export function getVisitPriceSuggestion({
  currentPriceCharged,
  serviceDefaultPrice,
  items,
}: {
  currentPriceCharged: string;
  serviceDefaultPrice: string | null;
  items: Array<PriceSuggestionLineItem>;
}) {
  if (serviceDefaultPrice === null) {
    return null;
  }

  const servicePrice = parseNonNegativeDecimal(serviceDefaultPrice);

  if (!servicePrice) {
    return null;
  }

  let total = servicePrice;

  for (const item of items) {
    if (!item.materialId || !item.amount || !item.unitCost) {
      return null;
    }

    const amount = parsePositiveQuantity(item.amount);
    const unitCost = parseNonNegativeDecimal(item.unitCost);

    if (!amount || !unitCost) {
      return null;
    }

    total = total.add(amount.mul(unitCost));
  }

  const suggestion = roundVisitPriceSuggestion(total);
  const current = parseNonNegativeDecimal(currentPriceCharged);

  if (current?.equals(suggestion)) {
    return null;
  }

  return suggestion.toString();
}

export function roundVisitPriceSuggestion(value: Decimal) {
  const lowerTen = value.div(10).floor().mul(10);
  const remainder = value.minus(lowerTen);

  if (remainder.lt(2.5)) {
    return lowerTen;
  }

  if (remainder.lt(7)) {
    return lowerTen.plus(5);
  }

  return lowerTen.plus(10);
}

function parsePositiveQuantity(value: string) {
  const trimmed = value.trim();

  if (!quantityPattern.test(trimmed)) {
    return null;
  }

  try {
    const parsed = new Decimal(trimmed);

    return parsed.gt(0) ? parsed : null;
  } catch {
    return null;
  }
}

function parseNonNegativeDecimal(value: string) {
  try {
    const parsed = new Decimal(value.trim());

    return parsed.gte(0) ? parsed : null;
  } catch {
    return null;
  }
}
