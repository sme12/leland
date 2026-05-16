import { describe, expect, it } from 'vitest';

import {
  computeContainerTotalQuantity,
  computePurchaseUnitCost,
  formatUnitCost,
  tryFormatEuro,
} from './purchase-format';

describe('purchase formatting and arithmetic', () => {
  it('normalizes container quantity without storing the container split', () => {
    expect(computeContainerTotalQuantity('2', '500')).toBe('1000');
    expect(computeContainerTotalQuantity('2', '59.15')).toBe('118.3');
  });

  it.each([
    ['12.34', '100', '0.1234'],
    ['10', '3', '3.3333'],
    ['0', '12', '0.0000'],
    ['44.99', '2', '22.4950'],
  ])(
    'computes %s / %s with Decimal arithmetic',
    (totalPrice, totalQuantity, expected) => {
      expect(
        computePurchaseUnitCost(totalPrice, totalQuantity).toFixed(4),
      ).toBe(expected);
    },
  );

  it('formats unit cost with adaptive precision', () => {
    expect(formatUnitCost('0.1234', 'en-US')).toBe('€0.1234');
    expect(formatUnitCost('2.5', 'en-US')).toBe('€2.50');
  });

  it('returns null when draft money cannot be formatted', () => {
    expect(tryFormatEuro('not-a-number', 'en-US')).toBeNull();
  });
});
