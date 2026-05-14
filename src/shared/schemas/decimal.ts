import { z } from 'zod/v4';

export const moneyStringSchema = z
  .string()
  .trim()
  .regex(/^(0|[1-9]\d*)(\.\d{1,2})?$/, 'validation.money');

export function normalizeOptionalMoney(value: string | null) {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
