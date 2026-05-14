import { describe, expect, it } from 'vitest';

import { customerFormSchema } from './customer';

describe('customerFormSchema', () => {
  it('requires a non-empty name', () => {
    const result = customerFormSchema.safeParse({ name: ' ', comment: '' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'validation.customerNameRequired',
    );
  });

  it('normalizes blank comments to null', () => {
    const result = customerFormSchema.parse({ name: ' Anna ', comment: ' ' });

    expect(result).toEqual({ name: 'Anna', comment: null });
  });
});
