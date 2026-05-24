import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it, vi } from 'vitest';

import { ImportCommitError } from '#/server/imports';
import {
  COMMIT_IMPORT_TOOL_DESCRIPTION,
  COMMIT_IMPORT_TOOL_NAME,
  callCommitImport,
  registerCommitImportTool,
} from './commit-import';

describe('leland_commit_import tool', () => {
  it('returns success ids only', async () => {
    const result = await callCommitImport(
      { date: '2026-05-15', items: [] },
      'user-1',
      async () => ({
        createdMaterialIds: ['mat-1'],
        createdPurchaseIds: ['purchase-1', 'purchase-2'],
      }),
    );

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      createdMaterialIds: ['mat-1'],
      createdPurchaseIds: ['purchase-1', 'purchase-2'],
    });
  });

  it('returns structured ImportError envelopes', async () => {
    const result = await callCommitImport(
      { clientRequestId: 'req-1', date: '2026-05-15', items: [] },
      'user-1',
      async () => {
        throw new ImportCommitError({
          code: 'material_not_found',
          message: 'Material id `mat-other` does not belong to this Stylist.',
          lineIndex: 1,
          clientRequestId: 'req-1',
        });
      },
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      code: 'material_not_found',
      message: 'Material id `mat-other` does not belong to this Stylist.',
      lineIndex: 1,
      clientRequestId: 'req-1',
    });
  });

  it('returns generic internal_error responses and logs the original exception', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      const result = await callCommitImport(
        { clientRequestId: 'req-2', date: '2026-05-15', items: [] },
        'user-1',
        async () => {
          throw new Error('Prisma stack should not leak');
        },
      );

      expect(result.isError).toBe(true);
      expect(result.structuredContent).toEqual({
        code: 'internal_error',
        message: 'Internal error while committing Import.',
        clientRequestId: 'req-2',
      });
      expect(JSON.stringify(result)).not.toContain('Prisma stack');
      expect(consoleError).toHaveBeenCalledWith(
        `${COMMIT_IMPORT_TOOL_NAME} failed`,
        expect.any(Error),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it('registers the destructive non-idempotent tool contract', () => {
    const registerTool = vi.fn();
    const server = { registerTool } as unknown as McpServer;

    registerCommitImportTool(server, 'user-1');

    expect(registerTool).toHaveBeenCalledWith(
      COMMIT_IMPORT_TOOL_NAME,
      expect.objectContaining({
        description: COMMIT_IMPORT_TOOL_DESCRIPTION,
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
