import { describe, expect, it } from 'vitest';

import { updateServiceDefaultPriceSchema } from './service';

describe('updateServiceDefaultPriceSchema', () => {
  it('accepts null, integers, and two decimal money values', () => {
    expect(
      updateServiceDefaultPriceSchema.parse({ id: 'svc', price: null }),
    ).toEqual({ id: 'svc', price: null });
    expect(
      updateServiceDefaultPriceSchema.parse({ id: 'svc', price: '40' }),
    ).toEqual({ id: 'svc', price: '40' });
    expect(
      updateServiceDefaultPriceSchema.parse({ id: 'svc', price: '40.50' }),
    ).toEqual({ id: 'svc', price: '40.50' });
  });

  it('maps blank input to null', () => {
    expect(
      updateServiceDefaultPriceSchema.parse({ id: 'svc', price: ' ' }),
    ).toEqual({ id: 'svc', price: null });
  });

  it('rejects negative and over-precision prices', () => {
    expect(() =>
      updateServiceDefaultPriceSchema.parse({ id: 'svc', price: '-1' }),
    ).toThrow();
    expect(() =>
      updateServiceDefaultPriceSchema.parse({ id: 'svc', price: '1.234' }),
    ).toThrow();
  });
});
