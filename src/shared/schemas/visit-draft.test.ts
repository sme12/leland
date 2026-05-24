import { describe, expect, it, vi } from 'vitest';

import { visitDraftCreateSchema } from './visit-draft';

describe('visit draft date validation', () => {
  it('allows today and future draft dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T10:00:00.000Z'));

    try {
      for (const date of ['2026-05-15', '2026-05-16']) {
        const result = visitDraftCreateSchema.safeParse({
          customerId: 'customer-1',
          serviceId: 'service-1',
          date,
          estimatedPrice: '',
          note: '',
          items: [],
        });

        expect(result.success).toBe(true);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects past draft dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T10:00:00.000Z'));

    try {
      const result = visitDraftCreateSchema.safeParse({
        customerId: 'customer-1',
        serviceId: 'service-1',
        date: '2026-05-14',
        estimatedPrice: null,
        note: '',
        items: [],
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        'validation.visitDraftDatePast',
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
