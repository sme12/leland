import { describe, expect, it } from 'vitest';

import { getServicePrefillValue } from './service-prefill';

describe('getServicePrefillValue', () => {
  it('prefills priced services while charged is clean', () => {
    expect(
      getServicePrefillValue({
        currentValue: '',
        defaultPrice: '30',
        isDirty: false,
      }),
    ).toBe('30');
  });

  it('clears charged for null defaults while charged is clean', () => {
    expect(
      getServicePrefillValue({
        currentValue: '40',
        defaultPrice: null,
        isDirty: false,
      }),
    ).toBe('');
  });

  it('preserves user edits once charged is dirty', () => {
    expect(
      getServicePrefillValue({
        currentValue: '50',
        defaultPrice: '30',
        isDirty: true,
      }),
    ).toBe('50');
  });
});
