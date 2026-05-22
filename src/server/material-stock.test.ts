import { describe, expect, it } from 'vitest';

import { computeMaterialStockFields } from './material-stock';

describe('computeMaterialStockFields', () => {
  it('returns purchased, used, and remaining quantities for a material', () => {
    expect(
      computeMaterialStockFields({
        id: 'material-a',
        purchases: [
          { materialId: 'material-a', totalQuantity: '100' },
          { materialId: 'material-a', totalQuantity: '50' },
        ],
        lineItems: [
          { materialId: 'material-a', amount: '40' },
          { materialId: 'material-a', amount: '15.5' },
        ],
      }),
    ).toEqual({
      purchased: '150',
      used: '55.5',
      remaining: '94.5',
    });
  });

  it('allows negative remaining stock', () => {
    expect(
      computeMaterialStockFields({
        id: 'material-a',
        purchases: [{ materialId: 'material-a', totalQuantity: '10' }],
        lineItems: [{ materialId: 'material-a', amount: '12.5' }],
      }).remaining,
    ).toBe('-2.5');
  });

  it('returns zero stock when no stock movement has been recorded', () => {
    expect(computeMaterialStockFields({ id: 'material-a' })).toEqual({
      purchased: '0',
      used: '0',
      remaining: '0',
    });
  });
});
