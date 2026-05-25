import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { authenticateMcpRequest, unauthorizedMcpResponse } from './auth';
import { registerCommitImportTool } from './tools/commit-import';
import { registerCorrectPurchaseTool } from './tools/correct-purchase';
import { registerListMaterialsTool } from './tools/list-materials';
import { registerListPurchasesTool } from './tools/list-purchases';

export const LELAND_MCP_SERVER_INSTRUCTIONS =
  'Leland exposes a **Stylist**\'s **Catalog** and **Purchases**. Use it to import a **Receipt** (PDF/photo) into **Purchases**: (1) call `leland_list_materials({ includeArchived: true })` to load the **Catalog**, (2) match **Receipt** lines against it — collapse multiple lines for the same **Material** into one — and infer details for any unmatched lines, (3) call `leland_list_purchases({ date: receiptInvoiceDate })` for duplicate detection, (4) present a per-line summary to the **Stylist** including any "possible duplicate" or "needs adjustment" flags, (5) on the **Stylist**\'s explicit confirmation, call `leland_commit_import` once. To fix an existing **Purchase** that does not match the original **Receipt**, present the complete before/after state and call `leland_correct_purchase` for one **Purchase** at a time using its `expected` compare-and-replace guard. The server only accepts structured data — it never sees the **Receipt** file. Currency is the **Stylist**\'s local currency; the server does no FX conversion.';

function createLelandMcpServer(userId: string) {
  const server = new McpServer(
    { name: 'leland-mcp-server', version: '1.0.0' },
    { instructions: LELAND_MCP_SERVER_INSTRUCTIONS },
  );

  registerListMaterialsTool(server, userId);
  registerListPurchasesTool(server, userId);
  registerCommitImportTool(server, userId);
  registerCorrectPurchaseTool(server, userId);

  return server;
}

function methodNotAllowedResponse() {
  return Response.json(
    {
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed.' },
      id: null,
    },
    {
      status: 405,
      headers: { Allow: 'POST' },
    },
  );
}

function internalErrorResponse() {
  return Response.json(
    {
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Internal server error' },
      id: null,
    },
    { status: 500 },
  );
}

type CloseableMcpResource = {
  close: () => Promise<void> | void;
};

async function closeMcpResource(resource: CloseableMcpResource | undefined) {
  await resource?.close();
}

export async function handleMcpRequest(request: Request) {
  let server: ReturnType<typeof createLelandMcpServer> | undefined;
  let transport: WebStandardStreamableHTTPServerTransport | undefined;

  try {
    const authContext = await authenticateMcpRequest(request);

    if (!authContext) {
      return unauthorizedMcpResponse(request);
    }

    if (request.method !== 'POST') {
      return methodNotAllowedResponse();
    }

    server = createLelandMcpServer(authContext.userId);
    transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await server.connect(transport);

    return await transport.handleRequest(request, {
      authInfo: authContext.authInfo,
    });
  } catch (error) {
    console.error('MCP request failed', error);

    return internalErrorResponse();
  } finally {
    await Promise.allSettled([
      closeMcpResource(transport),
      closeMcpResource(server),
    ]);
  }
}
