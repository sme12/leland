import { describe, expect, it } from 'vitest';

import {
  purchaseContainerFormSchema,
  purchaseCreateSchema,
  purchaseEditFormSchema,
  purchaseEditPieceFormSchema,
  purchasePieceFormSchema,
} from './purchase';

describe('purchase schemas', () => {
  it('accepts normalized purchase payloads including future dates', () => {
    expect(
      purchaseCreateSchema.parse({
        materialId: 'material-id',
        totalQuantity: '1000.50',
        totalPrice: '44.99',
        date: '2099-12-31',
      }),
    ).toEqual({
      materialId: 'material-id',
      totalQuantity: '1000.50',
      totalPrice: '44.99',
      date: '2099-12-31',
    });
  });

  it('rejects zero and negative total quantities', () => {
    expect(() =>
      purchaseCreateSchema.parse({
        materialId: 'material-id',
        totalQuantity: '0',
        totalPrice: '0',
        date: '2026-05-14',
      }),
    ).toThrow();

    expect(() =>
      purchaseCreateSchema.parse({
        materialId: 'material-id',
        totalQuantity: '-1',
        totalPrice: '0',
        date: '2026-05-14',
      }),
    ).toThrow();
  });

  it('validates date-only strings', () => {
    expect(() =>
      purchaseCreateSchema.parse({
        materialId: 'material-id',
        totalQuantity: '1',
        totalPrice: '1',
        date: '2026-02-30',
      }),
    ).toThrow();

    expect(() =>
      purchaseCreateSchema.parse({
        materialId: 'material-id',
        totalQuantity: '1',
        totalPrice: '1',
        date: '2026-05-14T10:30:00Z',
      }),
    ).toThrow();
  });

  it('requires integer container counts and allows decimal ml/g sizes', () => {
    expect(
      purchaseContainerFormSchema.parse({
        count: '2',
        sizeEach: '59.15',
        totalPrice: '12.30',
        date: '2026-05-14',
      }),
    ).toEqual({
      count: '2',
      sizeEach: '59.15',
      totalPrice: '12.30',
      date: '2026-05-14',
    });

    expect(() =>
      purchaseContainerFormSchema.parse({
        count: '2.5',
        sizeEach: '59.15',
        totalPrice: '12.30',
        date: '2026-05-14',
      }),
    ).toThrow();
  });

  it('requires integer piece quantities', () => {
    expect(
      purchasePieceFormSchema.parse({
        quantity: '3',
        totalPrice: '7.50',
        date: '2026-05-14',
      }),
    ).toEqual({
      quantity: '3',
      totalPrice: '7.50',
      date: '2026-05-14',
    });

    expect(() =>
      purchasePieceFormSchema.parse({
        quantity: '3.5',
        totalPrice: '7.50',
        date: '2026-05-14',
      }),
    ).toThrow();
  });

  it('accepts fractional totalQuantity on ml/g edits and rejects it on piece edits', () => {
    expect(
      purchaseEditFormSchema.parse({
        totalQuantity: '750.25',
        totalPrice: '30',
        date: '2026-05-14',
      }),
    ).toEqual({
      totalQuantity: '750.25',
      totalPrice: '30',
      date: '2026-05-14',
    });

    expect(
      purchaseEditPieceFormSchema.parse({
        totalQuantity: '4',
        totalPrice: '12',
        date: '2026-05-14',
      }),
    ).toEqual({
      totalQuantity: '4',
      totalPrice: '12',
      date: '2026-05-14',
    });

    expect(() =>
      purchaseEditPieceFormSchema.parse({
        totalQuantity: '4.5',
        totalPrice: '12',
        date: '2026-05-14',
      }),
    ).toThrow();
  });
});
