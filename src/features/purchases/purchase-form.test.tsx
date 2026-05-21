import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { appI18n } from '#/i18n';
import { testIds } from '#/testing/test-ids';
import { PurchaseForm } from './purchase-form';

describe('PurchaseForm', () => {
  it('emits a normalized purchase payload outside route context', async () => {
    await appI18n.changeLanguage('en');
    const onSave = vi.fn();

    render(
      <PurchaseForm
        material={{
          id: 'material-id',
          name: 'Color cream',
          unitOfMeasure: 'ml',
        }}
        defaultDate={new Date(2026, 4, 14)}
        submitLabel="Save purchase"
        isSubmitting={false}
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(
        screen
          .getByTestId(testIds.purchaseForm.submitButton)
          .hasAttribute('disabled'),
      ).toBe(false);
    });

    fireEvent.change(screen.getByTestId(testIds.purchaseForm.countInput), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByTestId(testIds.purchaseForm.sizeEachInput), {
      target: { value: '500' },
    });
    fireEvent.change(screen.getByTestId(testIds.purchaseForm.totalPriceInput), {
      target: { value: '44.50' },
    });
    fireEvent.click(screen.getByTestId(testIds.purchaseForm.submitButton));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        materialId: 'material-id',
        totalQuantity: '1000',
        totalPrice: '44.50',
        date: '2026-05-14',
      });
    });
  });
});
