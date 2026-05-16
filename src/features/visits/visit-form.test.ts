import { describe, expect, it } from 'vitest';

import {
  createEmptyVisitFormValues,
  getVisitFormMissingKeys,
} from './visit-form';

describe('getVisitFormMissingKeys', () => {
  it('flags non-money visit prices without throwing', () => {
    const values = {
      ...createEmptyVisitFormValues(),
      customerId: 'customer-id',
      serviceId: 'service-id',
      priceCharged: 'not-a-number',
    };

    expect(getVisitFormMissingKeys(values)).toContain('validation.money');
  });
});
