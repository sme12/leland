const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const APP_TIME_ZONE = 'Europe/Helsinki';

export function parseDateOnly(value: string) {
  if (!dateOnlyPattern.test(value)) {
    throw new Error('parseDateOnly expects a YYYY-MM-DD string');
  }

  const [year, month, day] = value.split('-').map(Number);

  if (month < 1 || month > 12) {
    throw new Error('parseDateOnly received an invalid month');
  }

  const maxDay = month === 2 && isLeapYear(year) ? 29 : daysInMonth[month - 1];

  if (day < 1 || day > maxDay) {
    throw new Error('parseDateOnly received an invalid day');
  }

  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateOnly(value: Date) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError('formatDateOnly expects a valid Date');
  }

  return value.toISOString().slice(0, 10);
}

export function getHelsinkiDateOnly(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Could not format Helsinki date');
  }

  return `${year}-${month}-${day}`;
}

export function isFutureHelsinkiDate(value: string, now = new Date()) {
  return value > getHelsinkiDateOnly(now);
}

export function isValidDateOnly(value: string) {
  try {
    return formatDateOnly(parseDateOnly(value)) === value;
  } catch {
    return false;
  }
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
