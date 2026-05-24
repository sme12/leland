# Issue 2 — MCP server foundation + `leland_list_materials`

## What to build

Stand up the remote MCP server that ships inside the existing Leland TanStack Start app, and prove it end-to-end by shipping the first tool: `leland_list_materials`. This is the tracer-bullet slice — it cuts through routing, OAuth, transport, scoped Prisma access, and tool registration so that every subsequent tool (issues 3 and 4) is a thin additive change.

Scope (per `docs/mcp-purchase-import-plan.md` §2–§5 and Q5, Q8, Q9, Q10, Q16, Q17, Q18, Q19, Q21, Q24):

- **Dependencies.** Add `@modelcontextprotocol/sdk` pinned to a current `1.29.x` release (Q17 — compatible with `@clerk/mcp-tools`, includes the post-1.26.0 stateless-server security fixes) and `@clerk/mcp-tools`. `zod` already exists.
- **MCP server module.** New `src/server/mcp/` with `index.ts` (initializes `McpServer`, wires the official Streamable HTTP transport with `sessionIdGenerator: undefined` and `enableJsonResponse: true` for stateless JSON-only operation, registers tools), `auth.ts` (validates the incoming Clerk access token via `@clerk/mcp-tools`, resolves it to a Stylist `userId`, calls `ensureUserBootstrappedForUser(userId)` before any tool handler runs), and `tools/list-materials.ts` (one file per tool — Zod input schema, Zod output schema, annotations, handler).
- **Route mount.** Expose the MCP endpoint at `/mcp` (not `/api/mcp` — Q8) via TanStack Start's `createFileRoute` server-route mechanism. Add an adapter only if Web `Request`/`Response` glue is needed between the SDK transport and the route handler. Do not use `mcp-handler`.
- **OAuth discovery metadata.** Publish:
  - `/.well-known/oauth-protected-resource/mcp` — protected-resource metadata for `/mcp`.
  - `/.well-known/oauth-authorization-server` — Clerk authorization-server metadata for clients that need it.
  - `OPTIONS` handlers for both metadata routes (browser-based MCP clients need CORS discovery).
  - All metadata handlers derive the public resource URL from the incoming request (`new URL('/mcp', request.url)`) — no new env var (Q18). Works for localhost, Vercel previews, and production.
- **Unauthenticated behaviour.** Any request to `/mcp` without a valid Clerk token returns `401` with a `WWW-Authenticate` challenge pointing at the protected-resource metadata URL.
- **`leland_list_materials` tool.** Registers with name `leland_list_materials`, annotations `readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: true`, the exact tool description from `docs/mcp-purchase-import-plan.md` §"Tool descriptions (v1)", and:
  - Input: `{ includeArchived?: boolean }` (default `false`).
  - Output schema declared so clients get structured content: `{ materials: Array<{ id, name, category, unitOfMeasure, isArchived }> }` (wrapped in an object because MCP `structuredContent` requires one).
  - Reads through `getScopedDb(userId)` so the response is automatically scoped to the calling Stylist.
  - Ordered by `(category asc, name asc, createdAt asc)` to match the existing UI ordering in `src/server/materials.ts`.
  - When the Stylist's Catalog exceeds 500 Materials, returns `isError: true` with structured `code: "catalog_too_large"` (Q24).
- **Server-level instructions.** Register `serverInfo.instructions` with the exact string from `docs/mcp-purchase-import-plan.md` §"Server-level instructions" so hosts that surface ambient guidance see it.
- **Tool prefix.** All tool names start with `leland_` (Q9) even though the server is single-domain — keeps them collision-resistant when a host has multiple MCP servers connected.
- **Error envelope skeleton.** Wire the structured business-error path described in Q22 — for this issue only the `validation_failed`, `catalog_too_large`, and `internal_error` codes need to be exercised. The full envelope shape lands fully in issue 4 alongside the write tool.

Out of scope here: `leland_list_purchases` (issue 3), `leland_commit_import` and the import helper (issue 4), the eval suite (issue 5). Do not introduce schema changes — `prisma/schema.prisma` stays untouched.

## Acceptance criteria

- [ ] `@modelcontextprotocol/sdk` (pinned to `1.29.x`) and `@clerk/mcp-tools` are added to `package.json`.
- [ ] `src/server/mcp/index.ts`, `src/server/mcp/auth.ts`, and `src/server/mcp/tools/list-materials.ts` exist and the server registers exactly one tool.
- [ ] `/mcp` route is reachable in `pnpm dev` and serves stateless Streamable HTTP JSON responses (no session id header, no SSE upgrade required).
- [ ] `GET /mcp` / SSE behaviour is **not** required for the workflow to function (verifies the stateless mode is wired correctly).
- [ ] `/.well-known/oauth-protected-resource/mcp` and `/.well-known/oauth-authorization-server` return correct metadata; the resource URL inside them is derived from the request origin.
- [ ] `OPTIONS` requests against both metadata routes succeed.
- [ ] An unauthenticated request to `/mcp` returns `401` with a `WWW-Authenticate` header that references the protected-resource metadata URL.
- [ ] After a successful Clerk OAuth flow, the resolved Stylist `userId` is used to call `ensureUserBootstrappedForUser` before any tool handler runs.
- [ ] `leland_list_materials` called with no input returns the Stylist's active Catalog ordered by `(category, name, createdAt)`.
- [ ] `leland_list_materials({ includeArchived: true })` additionally returns archived Materials, each marked `isArchived: true`.
- [ ] When the Stylist's Catalog exceeds 500 Materials, the tool returns `isError: true` with `code: "catalog_too_large"`.
- [ ] Tool description, annotations, and `serverInfo.instructions` match the strings in `docs/mcp-purchase-import-plan.md` exactly.
- [ ] Inspector smoke test: `npx @modelcontextprotocol/inspector` against `http://localhost:3000/mcp` completes OAuth and successfully calls `leland_list_materials`.
- [ ] Auth isolation: a token from Stylist A never returns Stylist B's Materials (manual verification with two test accounts).
- [ ] Vitest MCP tool tests for `leland_list_materials` cover: active-only default, `includeArchived: true`, and 500-Material cap behaviour.
- [ ] No changes to `prisma/schema.prisma`; no behaviour change to `src/server/materials.ts` or `src/server/purchases.ts`.

## Blocked by

- Issue 1 — Clerk OAuth Applications + DCR dashboard setup must be live before the OAuth flow in this issue can be tested.
