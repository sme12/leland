import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { authenticateMcpRequest, unauthorizedMcpResponse } from './auth';
import { registerListMaterialsTool } from './tools/list-materials';

export const LELAND_MCP_SERVER_INSTRUCTIONS =
  'Leland exposes a **Stylist**\'s **Catalog** and **Purchases**. Use it to import a **Receipt** (PDF/photo) into **Purchases**: (1) call `leland_list_materials({ includeArchived: true })` to load the **Catalog**, (2) match **Receipt** lines against it — collapse multiple lines for the same **Material** into one — and infer details for any unmatched lines, (3) call `leland_list_purchases({ date: receiptInvoiceDate })` for duplicate detection, (4) present a per-line summary to the **Stylist** including any "possible duplicate" or "needs adjustment" flags, (5) on the **Stylist**\'s explicit confirmation, call `leland_commit_import` once. The server only accepts structured data — it never sees the **Receipt** file. Currency is the **Stylist**\'s local currency; the server does no FX conversion.';

function createLelandMcpServer(userId: string) {
  const server = new McpServer(
    { name: 'leland-mcp-server', version: '1.0.0' },
    { instructions: LELAND_MCP_SERVER_INSTRUCTIONS },
  );

  registerListMaterialsTool(server, userId);

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

export async function handleMcpRequest(request: Request) {
  const authContext = await authenticateMcpRequest(request);

  if (!authContext) {
    return unauthorizedMcpResponse(request);
  }

  if (request.method !== 'POST') {
    return methodNotAllowedResponse();
  }

  const server = createLelandMcpServer(authContext.userId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);

    return await transport.handleRequest(request, {
      authInfo: authContext.authInfo,
    });
  } catch (error) {
    console.error('MCP request failed', error);

    return internalErrorResponse();
  } finally {
    await transport.close();
    await server.close();
  }
}
