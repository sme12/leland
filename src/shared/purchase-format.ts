import Decimal from 'decimal.js';

import type { UnitOfMeasure } from './enums';

export function computeContainerTotalQuantity(count: string, sizeEach: string) {
  return new Decimal(count).mul(sizeEach).toDecimalPlaces(2).toString();
}

export function computePurchaseUnitCost(
  totalPrice: string,
  totalQuantity: string,
) {
  const quantity = new Decimal(totalQuantity);

  if (quantity.lte(0)) {
    return new Decimal(0);
  }

  return new Decimal(totalPrice).div(quantity);
}

export function formatEuro(
  value: string | Decimal,
  locale: string,
  options: Intl.NumberFormatOptions = {},
) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(new Decimal(value).toNumber());
}

export function formatQuantity(
  value: string | Decimal,
  unitOfMeasure: UnitOfMeasure,
  locale: string,
  unitLabel: string = unitOfMeasure,
) {
  const quantity = new Decimal(value);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(quantity.toNumber());

  return `${formatted} ${unitLabel}`;
}

export function formatUnitCost(value: string | Decimal, locale: string) {
  return formatEuro(
    value instanceof Decimal ? value : new Decimal(value),
    locale,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    },
  );
}
