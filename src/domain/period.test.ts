import { describe, expect, it } from 'vitest';

import { getPeriodRange } from './period';

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function expectRange(
  range: [Date, Date],
  expectedStart: string,
  expectedEnd: string,
) {
  expect(range.map(isoDate)).toEqual([expectedStart, expectedEnd]);
}

describe('getPeriodRange', () => {
  it('returns this ISO week as Monday through Sunday', () => {
    expectRange(
      getPeriodRange('this_week', dateOnly('2026-05-15')),
      '2026-05-11',
      '2026-05-17',
    );
  });

  it('handles ISO week year boundaries', () => {
    expectRange(
      getPeriodRange('this_week', dateOnly('2021-01-01')),
      '2020-12-28',
      '2021-01-03',
    );
  });

  it('returns last ISO week relative to now', () => {
    expectRange(
      getPeriodRange('last_week', dateOnly('2026-01-05')),
      '2025-12-29',
      '2026-01-04',
    );
  });

  it('returns this month boundaries', () => {
    expectRange(
      getPeriodRange('this_month', dateOnly('2026-05-15')),
      '2026-05-01',
      '2026-05-31',
    );
  });

  it('returns last month boundaries across leap-year February', () => {
    expectRange(
      getPeriodRange('last_month', dateOnly('2024-03-10')),
      '2024-02-01',
      '2024-02-29',
    );
  });

  it('keeps date-only boundaries across a DST-adjacent week', () => {
    expectRange(
      getPeriodRange('this_week', dateOnly('2026-03-29')),
      '2026-03-23',
      '2026-03-29',
    );
  });
});
