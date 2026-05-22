import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';

import {
  computeMaterialAggregate,
  computeNet,
  computePeriodTotals,
  computeUnitCost,
} from './cost';
import type { CostPurchase, VisitWithItems } from './types';

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function timestamp(value: string) {
  return new Date(value);
}

function purchase(
  overrides: Partial<CostPurchase> & Pick<CostPurchase, 'id'>,
): CostPurchase {
  return {
    materialId: 'material-a',
    totalPrice: '10',
    totalQuantity: '100',
    date: dateOnly('2026-05-01'),
    createdAt: timestamp('2026-05-01T10:00:00.000Z'),
    ...overrides,
  };
}

function visit(overrides: Partial<VisitWithItems>): VisitWithItems {
  return {
    date: dateOnly('2026-05-10'),
    priceCharged: '100',
    lineItems: [],
    ...overrides,
  };
}

describe('computeUnitCost', () => {
  it('uses all 3 purchases when exactly 3 are available', () => {
    const unitCost = computeUnitCost([
      purchase({ id: 'p1', totalPrice: '10', totalQuantity: '100' }),
      purchase({ id: 'p2', totalPrice: '20', totalQuantity: '100' }),
      purchase({ id: 'p3', totalPrice: '30', totalQuantity: '100' }),
    ]);

    expect(unitCost.toString()).toBe('0.2');
  });

  it('uses only the latest 3 purchases when more are available', () => {
    const unitCost = computeUnitCost([
      purchase({
        id: 'oldest',
        totalPrice: '1000',
        totalQuantity: '1',
        date: dateOnly('2026-01-01'),
      }),
      purchase({
        id: 'older',
        totalPrice: '500',
        totalQuantity: '1',
        date: dateOnly('2026-02-01'),
      }),
      purchase({
        id: 'recent-1',
        totalPrice: '10',
        totalQuantity: '100',
        date: dateOnly('2026-03-01'),
      }),
      purchase({
        id: 'recent-2',
        totalPrice: '20',
        totalQuantity: '100',
        date: dateOnly('2026-04-01'),
      }),
      purchase({
        id: 'recent-3',
        totalPrice: '30',
        totalQuantity: '100',
        date: dateOnly('2026-05-01'),
      }),
    ]);

    expect(unitCost.toString()).toBe('0.2');
  });

  it('uses one purchase when only one is available', () => {
    const unitCost = computeUnitCost([
      purchase({ id: 'only', totalPrice: '12.50', totalQuantity: '50' }),
    ]);

    expect(unitCost.toString()).toBe('0.25');
  });

  it('returns 0 for an empty purchase list', () => {
    expect(computeUnitCost([]).toString()).toBe('0');
  });

  it('uses createdAt descending as a same-date tie-break', () => {
    const unitCost = computeUnitCost(
      [
        purchase({
          id: 'first-created',
          totalPrice: '999',
          totalQuantity: '1',
          date: dateOnly('2026-05-01'),
          createdAt: timestamp('2026-05-01T09:00:00.000Z'),
        }),
        purchase({
          id: 'second-created',
          totalPrice: '20',
          totalQuantity: '100',
          date: dateOnly('2026-05-01'),
          createdAt: timestamp('2026-05-01T10:00:00.000Z'),
        }),
      ],
      1,
    );

    expect(unitCost.toString()).toBe('0.2');
  });

  it('keeps decimal precision without internal rounding', () => {
    const unitCost = computeUnitCost([
      purchase({
        id: 'precise',
        totalPrice: new Decimal('10'),
        totalQuantity: new Decimal('3'),
      }),
    ]);

    expect(unitCost.toDecimalPlaces(8).toString()).toBe('3.33333333');
  });

  it('returns 0 when k is non-positive', () => {
    const purchases = [
      purchase({ id: 'p1', totalPrice: '10', totalQuantity: '100' }),
    ];

    expect(computeUnitCost(purchases, 0).toString()).toBe('0');
    expect(computeUnitCost(purchases, -1).toString()).toBe('0');
  });
});

describe('computeNet', () => {
  it('returns the charged amount when a visit has no line items', () => {
    expect(computeNet(visit({ priceCharged: '75' })).toString()).toBe('75');
  });

  it('subtracts multiple locked line-item costs', () => {
    expect(
      computeNet(
        visit({
          priceCharged: '120',
          lineItems: [
            { materialId: 'material-a', amount: '10', totalCost: '12.50' },
            { materialId: 'material-b', amount: '5', totalCost: '7.25' },
          ],
        }),
      ).toString(),
    ).toBe('100.25');
  });

  it('allows negative net values', () => {
    expect(
      computeNet(
        visit({
          priceCharged: '30',
          lineItems: [
            { materialId: 'material-a', amount: '10', totalCost: '45.50' },
          ],
        }),
      ).toString(),
    ).toBe('-15.5');
  });
});

describe('computePeriodTotals', () => {
  it('returns zero totals for an empty visit list', () => {
    const totals = computePeriodTotals(
      [],
      [dateOnly('2026-05-01'), dateOnly('2026-05-31')],
    );

    expect(totals.count).toBe(0);
    expect(totals.revenue.toString()).toBe('0');
    expect(totals.cost.toString()).toBe('0');
    expect(totals.net.toString()).toBe('0');
  });

  it('filters out visits outside the inclusive range', () => {
    const totals = computePeriodTotals(
      [
        visit({ date: dateOnly('2026-04-30'), priceCharged: '100' }),
        visit({ date: dateOnly('2026-05-15'), priceCharged: '80' }),
        visit({ date: dateOnly('2026-06-01'), priceCharged: '100' }),
      ],
      [dateOnly('2026-05-01'), dateOnly('2026-05-31')],
    );

    expect(totals.count).toBe(1);
    expect(totals.revenue.toString()).toBe('80');
  });

  it('includes visits on both boundary dates', () => {
    const totals = computePeriodTotals(
      [
        visit({ date: dateOnly('2026-05-01'), priceCharged: '50' }),
        visit({ date: dateOnly('2026-05-31'), priceCharged: '60' }),
      ],
      [dateOnly('2026-05-01'), dateOnly('2026-05-31')],
    );

    expect(totals.count).toBe(2);
    expect(totals.revenue.toString()).toBe('110');
  });

  it('treats no-line-item visits as cost 0', () => {
    const totals = computePeriodTotals(
      [
        visit({
          date: dateOnly('2026-05-15'),
          priceCharged: '90',
          lineItems: [],
        }),
      ],
      [dateOnly('2026-05-01'), dateOnly('2026-05-31')],
    );

    expect(totals.count).toBe(1);
    expect(totals.cost.toString()).toBe('0');
    expect(totals.net.toString()).toBe('90');
  });

  it('returns negative net when included visits cost more than revenue', () => {
    const totals = computePeriodTotals(
      [
        visit({
          date: dateOnly('2026-05-10'),
          priceCharged: '30',
          lineItems: [
            { materialId: 'material-a', amount: '10', totalCost: '45.50' },
          ],
        }),
      ],
      [dateOnly('2026-05-01'), dateOnly('2026-05-31')],
    );

    expect(totals.count).toBe(1);
    expect(totals.revenue.toString()).toBe('30');
    expect(totals.cost.toString()).toBe('45.5');
    expect(totals.net.toString()).toBe('-15.5');
  });

  it('sums revenue, cost, and net for included visits', () => {
    const totals = computePeriodTotals(
      [
        visit({
          date: dateOnly('2026-05-10'),
          priceCharged: '100',
          lineItems: [
            { materialId: 'material-a', amount: '5', totalCost: '12.25' },
          ],
        }),
        visit({
          date: dateOnly('2026-05-11'),
          priceCharged: '50',
          lineItems: [
            { materialId: 'material-b', amount: '3', totalCost: '8.75' },
          ],
        }),
      ],
      [dateOnly('2026-05-01'), dateOnly('2026-05-31')],
    );

    expect(totals.count).toBe(2);
    expect(totals.revenue.toString()).toBe('150');
    expect(totals.cost.toString()).toBe('21');
    expect(totals.net.toString()).toBe('129');
  });
});

describe('computeMaterialAggregate', () => {
  it('computes purchased, used, and remaining for one material', () => {
    const aggregate = computeMaterialAggregate(
      [
        purchase({
          id: 'p1',
          materialId: 'material-a',
          totalQuantity: '100',
        }),
        purchase({
          id: 'p2',
          materialId: 'material-a',
          totalQuantity: '50',
        }),
      ],
      [
        { materialId: 'material-a', amount: '40' },
        { materialId: 'material-a', amount: '15.5' },
      ],
    );

    expect(aggregate.purchased.toString()).toBe('150');
    expect(aggregate.used.toString()).toBe('55.5');
    expect(aggregate.remaining.toString()).toBe('94.5');
  });

  it('returns zeros when the material has no purchases and no usage', () => {
    const aggregate = computeMaterialAggregate([], []);

    expect(aggregate.purchased.toString()).toBe('0');
    expect(aggregate.used.toString()).toBe('0');
    expect(aggregate.remaining.toString()).toBe('0');
  });

  it('allows negative remaining', () => {
    const aggregate = computeMaterialAggregate(
      [
        purchase({
          id: 'p1',
          materialId: 'material-a',
          totalQuantity: '10',
        }),
      ],
      [{ materialId: 'material-a', amount: '12.5' }],
    );

    expect(aggregate.remaining.toString()).toBe('-2.5');
  });
});
