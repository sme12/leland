import { describe, expect, it, vi } from 'vitest';

import { getHelsinkiDateOnly, isFutureHelsinkiDate } from '../date';
import { visitCreateSchema } from './visit';

describe('visit date validation', () => {
  it('uses Europe/Helsinki when deriving today', () => {
    const lateUtc = new Date('2026-05-14T21:30:00.000Z');

    expect(getHelsinkiDateOnly(lateUtc)).toBe('2026-05-15');
    expect(isFutureHelsinkiDate('2026-05-15', lateUtc)).toBe(false);
    expect(isFutureHelsinkiDate('2026-05-16', lateUtc)).toBe(true);
  });

  it('rejects future visit dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T10:00:00.000Z'));

    try {
      const result = visitCreateSchema.safeParse({
        customerId: 'customer-1',
        serviceId: 'service-1',
        date: '2026-05-16',
        priceCharged: '40',
        note: '',
        items: [],
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        'validation.visitDateFuture',
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
