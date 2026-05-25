import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it, vi } from 'vitest';

import { PurchaseCorrectionError } from '#/server/purchase-corrections';
import {
  CORRECT_PURCHASE_TOOL_DESCRIPTION,
  CORRECT_PURCHASE_TOOL_NAME,
  callCorrectPurchase,
  registerCorrectPurchaseTool,
} from './correct-purchase';

describe('leland_correct_purchase tool', () => {
  it('returns the corrected Purchase and changed flag', async () => {
    const result = await callCorrectPurchase(
      {
        purchaseId: 'p-1',
        expected: {
          materialId: 'mat-color',
          totalQuantity: '360',
          totalPrice: '60.00',
          date: '2026-05-15',
        },
        replacement: {
          materialId: 'mat-color',
          totalQuantity: '360',
          totalPrice: '74.40',
          date: '2026-05-15',
        },
      },
      'user-1',
      async () => ({
        changed: true,
        purchase: {
          id: 'p-1',
          materialId: 'mat-color',
          materialName: 'Koleston 7/0',
          totalQuantity: '360',
          totalPrice: '74.40',
          date: '2026-05-15',
        },
      }),
    );

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      changed: true,
      purchase: {
        id: 'p-1',
        materialId: 'mat-color',
        materialName: 'Koleston 7/0',
        totalQuantity: '360',
        totalPrice: '74.40',
        date: '2026-05-15',
      },
    });
  });

  it('returns structured PurchaseCorrectionError envelopes', async () => {
    const result = await callCorrectPurchase(
      { clientRequestId: 'req-1', purchaseId: 'p-1' },
      'user-1',
      async () => {
        throw new PurchaseCorrectionError({
          code: 'stale_purchase',
          message:
            'Purchase changed since it was listed; reload it before correcting.',
          clientRequestId: 'req-1',
          currentPurchase: {
            id: 'p-1',
            materialId: 'mat-color',
            materialName: 'Koleston 7/0',
            totalQuantity: '360',
            totalPrice: '60.00',
            date: '2026-05-15',
          },
        });
      },
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      code: 'stale_purchase',
      message:
        'Purchase changed since it was listed; reload it before correcting.',
      clientRequestId: 'req-1',
      currentPurchase: {
        id: 'p-1',
        materialId: 'mat-color',
        materialName: 'Koleston 7/0',
        totalQuantity: '360',
        totalPrice: '60.00',
        date: '2026-05-15',
      },
    });
  });

  it('surfaces validation_failed envelopes from PurchaseCorrectionError', async () => {
    const result = await callCorrectPurchase(
      { clientRequestId: 'req-validation', purchaseId: 'p-1' },
      'user-1',
      async () => {
        throw new PurchaseCorrectionError({
          code: 'validation_failed',
          message:
            'Invalid correction payload at replacement.totalPrice: must be a money decimal string with up to 2 decimal places',
          clientRequestId: 'req-validation',
        });
      },
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      code: 'validation_failed',
      message:
        'Invalid correction payload at replacement.totalPrice: must be a money decimal string with up to 2 decimal places',
      clientRequestId: 'req-validation',
    });
  });

  it('returns generic internal_error responses and logs the original exception', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      const result = await callCorrectPurchase(
        { clientRequestId: 'req-2', purchaseId: 'p-1' },
        'user-1',
        async () => {
          throw new Error('Prisma stack should not leak');
        },
      );

      expect(result.isError).toBe(true);
      expect(result.structuredContent).toEqual({
        code: 'internal_error',
        message: 'Internal error while correcting Purchase.',
        clientRequestId: 'req-2',
      });
      expect(JSON.stringify(result)).not.toContain('Prisma stack');
      expect(consoleError).toHaveBeenCalledWith(
        `${CORRECT_PURCHASE_TOOL_NAME} failed`,
        expect.any(Error),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it('registers the destructive non-idempotent tool contract', () => {
    const registerTool = vi.fn();
    const server = { registerTool } as unknown as McpServer;

    registerCorrectPurchaseTool(server, 'user-1');

    expect(registerTool).toHaveBeenCalledWith(
      CORRECT_PURCHASE_TOOL_NAME,
      expect.objectContaining({
        description: CORRECT_PURCHASE_TOOL_DESCRIPTION,
        annotations: {
          readOnlyHint: false,
          idempotentHint: false,
          destructiveHint: true,
          openWorldHint: true,
        },
      }),
      expect.any(Function),
    );
  });
});
