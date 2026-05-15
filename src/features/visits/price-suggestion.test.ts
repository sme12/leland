import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';

import { getVisitPriceSuggestion } from './price-suggestion';

describe('getVisitPriceSuggestion', () => {
  it.each([
    ['82', '80'],
    ['82.5', '85'],
    ['86.99', '85'],
    ['87', '90'],
  ])('rounds %s to %s', (total, expected) => {
    expect(suggestForTotal(total)).toBe(expected);
  });

  it('does not suggest without a service default price', () => {
    expect(
      getVisitPriceSuggestion({
        currentPriceCharged: '',
        serviceDefaultPrice: null,
        items: [{ materialId: 'material-id', amount: '1', unitCost: '2' }],
      }),
    ).toBeNull();
  });

  it.each([
    { items: [{ materialId: '', amount: '1', unitCost: '2' }] },
    { items: [{ materialId: 'material-id', amount: '', unitCost: '2' }] },
    { items: [{ materialId: 'material-id', amount: '1', unitCost: '' }] },
    {
      items: [
        { materialId: 'material-id', amount: 'not-a-number', unitCost: '2' },
      ],
    },
    { items: [{ materialId: 'material-id', amount: '1.001', unitCost: '2' }] },
    { items: [{ materialId: 'material-id', amount: '0', unitCost: '2' }] },
    {
      items: [
        { materialId: 'material-id', amount: '1', unitCost: 'not-a-number' },
      ],
    },
  ])('does not suggest while a material row is incomplete: %o', ({ items }) => {
    expect(
      getVisitPriceSuggestion({
        currentPriceCharged: '',
        serviceDefaultPrice: '80',
        items,
      }),
    ).toBeNull();
  });

  it('does not suggest when charged already matches the suggestion', () => {
    expect(
      getVisitPriceSuggestion({
        currentPriceCharged: '80.00',
        serviceDefaultPrice: '80',
        items: [{ materialId: 'material-id', amount: '1', unitCost: '2' }],
      }),
    ).toBeNull();
  });
});

function suggestForTotal(total: string) {
  return getVisitPriceSuggestion({
    currentPriceCharged: '',
    serviceDefaultPrice: '80',
    items: [
      {
        materialId: 'material-id',
        amount: '1',
        unitCost: totalMinusServicePrice(total),
      },
    ],
  });
}

function totalMinusServicePrice(total: string) {
  return new Decimal(total).minus(80).toString();
}
