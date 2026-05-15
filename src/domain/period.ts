import {
  endOfISOWeek,
  endOfMonth,
  startOfISOWeek,
  startOfMonth,
  subMonths,
  subWeeks,
} from 'date-fns';

import type { PeriodRange } from './types';

export type PeriodPreset =
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month';

// date-fns ISO-week / month helpers operate on the runtime's local time. We
// rebase UTC date parts into a local Date so the math is stable regardless of
// the server's timezone, then `toUtcDateOnly` strips back to UTC midnight.
function toFloatingDate(value: Date) {
  return new Date(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  );
}

function toUtcDateOnly(value: Date) {
  return new Date(
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()),
  );
}

function rangeFromFloatingDates(start: Date, end: Date): PeriodRange {
  return [toUtcDateOnly(start), toUtcDateOnly(end)];
}

export function getPeriodRange(preset: PeriodPreset, now: Date): PeriodRange {
  const currentDate = toFloatingDate(now);

  switch (preset) {
    case 'this_week':
      return rangeFromFloatingDates(
        startOfISOWeek(currentDate),
        endOfISOWeek(currentDate),
      );
    case 'last_week': {
      const previousWeek = subWeeks(currentDate, 1);

      return rangeFromFloatingDates(
        startOfISOWeek(previousWeek),
        endOfISOWeek(previousWeek),
      );
    }
    case 'this_month':
      return rangeFromFloatingDates(
        startOfMonth(currentDate),
        endOfMonth(currentDate),
      );
    case 'last_month': {
      const previousMonth = subMonths(currentDate, 1);

      return rangeFromFloatingDates(
        startOfMonth(previousMonth),
        endOfMonth(previousMonth),
      );
    }
  }
}
