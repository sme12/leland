# MCP-Driven Purchase Import from Receipts

## Context

Leland **Stylists** currently register every stock purchase by hand: open the purchases form, pick a **Material** from a dropdown, type count × size, price, and date. A wholesale **Receipt** with 5–10 line items takes several minutes of fiddly typing. Most **Stylists** already collect paper/PDF/photo **Receipts**.

This change introduces a **remote MCP server** that ships alongside the existing TanStack Start app. The **Stylist** uploads a **Receipt** to Claude (or any MCP-capable agent), the agent reads it natively, fuzzy-matches lines against the **Stylist**'s existing **Catalog**, presents a summary, and on confirmation commits the whole batch atomically through one MCP tool call. The MCP server itself is a thin, domain-only surface — it never touches the PDF.

Outcome: a 10-line receipt drops from ~5 minutes of manual entry to one chat turn + one confirmation.

## Resolved decisions (from grilling)

- **Q1 — Unit of import.** One **Receipt** → N **Purchase** rows, one per distinct **Material** line. **Receipt**-level fields (vendor, receipt number, totals, VAT) are discarded — Leland has no persisted **Receipt** entity and we are **not** introducing one. "6 × 60ml" tubes collapse into one **Purchase** with `totalQuantity = 360`.
- **Q2 — Matching strategy.** Server returns raw catalog; the LLM does the matching. No server-side string similarity.
- **Q3 — New material inference.**
  - `name`: LLM strips size suffix, mirrors the **Stylist**'s existing naming style.
  - `unitOfMeasure`: parsed from line text (ml/L → ml; g/kg → g; otherwise `piece`).
  - `category`: inferred from product knowledge, defaults to `other` when uncertain.
  - All three editable by the user before commit.
- **Q4 — Duplicate detection.** Agent calls `leland_list_purchases(date)` pre-summary; matches on `(materialId, totalQuantity, totalPrice, date)` are flagged as "possible duplicate — skip?" with skip default. No server-side rejection.
- **Q5 — Hosting & auth.** Remote MCP server in the same Vercel deployment as the Leland app. OAuth via Clerk's OAuth-applications mode with Dynamic Client Registration enabled. Wired with `@clerk/mcp-tools`. Each tool call resolves to a `userId`; every Prisma query goes through the existing `getScopedDb(userId)`. See [docs/adr/0001-clerk-as-mcp-oauth-provider.md](adr/0001-clerk-as-mcp-oauth-provider.md).
- **Q6 — Receipt parsing.** The **host LLM** reads the PDF/image. The MCP server never sees the file. MCP tools accept structured input only. See [docs/adr/0002-mcp-server-domain-only.md](adr/0002-mcp-server-domain-only.md).
- **Q7 — Commit semantics.** Writes go through **one atomic tool**, `leland_commit_import`, wrapping a single Prisma `$transaction`. New Materials and their Purchases are created in one all-or-nothing call. Reads stay granular. See [docs/adr/0003-atomic-commit-import.md](adr/0003-atomic-commit-import.md).
- **Q8 — MCP endpoint & metadata.** The canonical MCP endpoint is `/mcp` (not `/api/mcp`). Expose OAuth discovery metadata at the corresponding public well-known routes, including `/.well-known/oauth-protected-resource/mcp` and the Clerk authorization-server metadata route needed by current MCP clients. Unauthenticated MCP requests return `401` with a `WWW-Authenticate` challenge pointing at the protected-resource metadata.
- **Q9 — Tool naming.** MCP tools are prefixed with `leland_` even though the server is single-domain, so they remain discoverable and collision-resistant when a client has tools from multiple servers enabled.
- **Q10 — Archived materials.** Archived **Materials** remain valid historical **Materials**. `leland_list_materials` defaults to active only but supports `includeArchived: true`; agents should include archived Materials before proposing new ones. `leland_commit_import` allows `kind:"existing"` against archived Materials without auto-restoring them, and rejects `kind:"new"` when it conflicts with any active or archived Material.
- **Q11 — Decimal representation.** MCP tool inputs use decimal strings, never JSON numbers, for `totalQuantity` and `totalPrice`. `totalQuantity` follows Leland's existing positive quantity rules (up to two decimals), `totalPrice` follows existing money rules (zero allowed, up to two decimals), and `piece` Materials require integer `totalQuantity`.
- **Q12 — Importable receipt lines.** v1 imports only positive **Material** acquisition lines. The agent should use the final Material line total when line-level discounts/VAT are already reflected, ignore shipping/payment fees/receipt totals/VAT summary rows/negative return or credit rows, and ask the **Stylist** to adjust proposed totals before commit when a receipt-level discount or credit cannot be clearly allocated to Materials.
- **Q13 — Purchase read bounds.** `leland_list_purchases` requires either `date` or `from`/`to`; it never lists all purchase history. Date ranges are capped at 31 days. Duplicate detection uses the receipt date; if the receipt date is unclear, the agent asks the **Stylist** before committing.
- **Q14 — Same-batch duplicates.** `leland_commit_import` rejects duplicate **Materials** within the same payload instead of merging them. The agent must collapse repeated receipt lines into one proposed **Purchase** per distinct **Material** before commit.
- **Q15 — Idempotency boundary.** `leland_commit_import` is not idempotent. It accepts an optional `clientRequestId` only for logs/error correlation, not deduplication. True retry-safe idempotency would require a persisted Import/Receipt ledger, which is outside the no-schema-change v1.
- **Q16 — Authenticated bootstrap.** After resolving the Clerk OAuth token to `userId`, MCP calls run `ensureUserBootstrappedForUser(userId)` before handling tools, preserving the app invariant that an authenticated **Stylist** has default data initialized.
- **Q17 — HTTP transport.** Use the official `@modelcontextprotocol/sdk` Streamable HTTP transport directly, adding only a tiny local Web handler adapter if TanStack Start's server-route `Request`/`Response` shape needs glue. Do not use `mcp-handler` in v1. Pin the SDK to a current `1.29.x` release so it is compatible with `@clerk/mcp-tools` and includes the stateless-server security fixes from `1.26.0+`.
- **Q18 — Public resource URL.** OAuth metadata and `WWW-Authenticate` challenges derive the public resource URL from the incoming request (`new URL('/mcp', request.url)`), not from a new env var. This keeps local dev, Vercel previews, and production domains self-consistent.
- **Q19 — Transport mode.** `/mcp` runs as stateless Streamable HTTP with JSON responses only (`sessionIdGenerator: undefined`, `enableJsonResponse: true`). Leland does not need MCP sessions, SSE, resumability, elicitation, or server-initiated notifications in v1.
- **Q20 — OAuth scope boundary.** v1 does not define custom OAuth scopes such as `materials:read` or `purchases:write`. Clerk OAuth consent gates access to the MCP server as a whole; tool-level safety comes from MCP annotations, host-agent confirmation UX, and server-side validation.
- **Q21 — Material identity normalization.** Material identity for conflict checks is exact after the existing schema trimming, matching the database identity `(userId, name, category, unitOfMeasure)`. v1 does not add case-insensitive, punctuation-normalized, or fuzzy uniqueness rules.
- **Q22 — MCP error envelope.** Business/validation failures return MCP tool responses with `isError: true`, a short text/JSON message, and structured content shaped as `{ code, message, lineIndex?, conflictingLineIndex?, materialId?, clientRequestId? }`. Unknown internal exceptions are logged server-side and returned as generic `internal_error` without Prisma or stack details.
- **Q23 — Import helper home.** The transactional import helper lives in a new `src/server/imports.ts`, not in `src/server/purchases.ts`, because it orchestrates **Materials**, **Purchases**, validation, and import-specific errors. Shared import payload schemas live in `src/shared/schemas/import.ts`.
- **Q24 — Catalog read shape.** `leland_list_materials` returns the full **Catalog** in v1, not paginated, so the agent can match against all candidate **Materials** at once. Add a server-side cap of 500 Materials; above that, return a structured error telling the agent the Catalog is too large for v1 and needs a search/narrowing tool in v2.
- **Q25 — Import date.** `leland_commit_import` takes one top-level `date` for the whole **Import**. Every created **Purchase** uses that date; mixed-date imports are out of scope for v1.

## Tool surface (v1)

Three tools. Names are prefixed with `leland_` because MCP clients commonly merge tools from multiple servers.

| Tool | Annotations | Purpose |
|---|---|---|
| `leland_list_materials` | readOnly, idempotent | Returns the **Stylist**'s full **Catalog** `[{ id, name, category, unitOfMeasure, isArchived }]`. Optional `includeArchived` flag (default false). Tool description tells agents to use archived results before creating new Materials to avoid duplicates. Capped at 500 Materials with a structured "Catalog too large" error. |
| `leland_list_purchases` | readOnly, idempotent | Returns purchases for a bounded date filter `[{ id, materialId, materialName, totalQuantity, totalPrice, date }]`. Requires either `date` (single day) or `from`/`to`; ranges are capped at 31 days. |
| `leland_commit_import` | destructive, **not** idempotent | Atomic batch import. Input is `{ clientRequestId?: string, date: string, items: [...] }`; each item is `{ kind: "existing", materialId, totalQuantity: string, totalPrice: string } \| { kind: "new", material: { name, category, unitOfMeasure }, totalQuantity: string, totalPrice: string }`. Quantities/prices are decimal strings, not JSON numbers. `date` applies to every created Purchase. `clientRequestId` is trace-only, not a dedupe key. Server wraps everything in one Prisma transaction. Returns `{ createdMaterialIds, createdPurchaseIds }` on success, or a structured error pinpointing the offending line on failure. |

Out of scope for v1 (deliberate): standalone `create_material`, `update_purchase`, anything touching `Visit` / `Service` / `Customer`. Easy to add later — kept out now to minimise surface area.

Tool/server instructions include the import policy: only positive Material acquisition lines become Purchases; non-Material charges and unallocated credits/discounts are not committed unless the Stylist has adjusted the proposed Material totals.

Each tool uses Zod for input validation with field-level descriptions, and declares an `outputSchema` so clients get structured content. Errors are returned as MCP `isError: true` responses with actionable messages (e.g. _"material id `cmX...` does not belong to this stylist"_, _"new material 'Koleston 7/0' conflicts with archived material id `cmY...` — use kind:'existing' instead or ask the stylist whether this should remain archived"_, _"lines 2 and 5 refer to the same new material — collapse them into one purchase before committing"_).

Structured business error shape:

```ts
type ImportError = {
  code:
    | 'validation_failed'
    | 'material_not_found'
    | 'material_conflict'
    | 'duplicate_material'
    | 'unit_mismatch'
    | 'internal_error';
  message: string;
  lineIndex?: number;
  conflictingLineIndex?: number;
  materialId?: string;
  clientRequestId?: string;
};
```

New Material names are trimmed through the existing Material schema before conflict checks. Conflicts are exact on `(name, category, unitOfMeasure)` after trimming; the server does not perform case-insensitive or fuzzy matching.

## Implementation outline

### 1. Refactor: extract a transactional commit helper

Today, `createPurchase` and `createMaterial` in [src/server/purchases.ts](../src/server/purchases.ts) and [src/server/materials.ts](../src/server/materials.ts) are TanStack `createServerFn` handlers — fine for the existing form path, but not directly reusable from MCP.

Add a server helper in `src/server/imports.ts`:

```ts
async function commitImport(
  userId: string,
  input: CommitImportInput,
): Promise<{ createdMaterialIds: string[]; createdPurchaseIds: string[] }>
```

It runs `prisma.$transaction(async tx => { ... })` and uses the same scoping/validation utilities already in [src/server/db.ts](../src/server/db.ts). Shared input schemas live in `src/shared/schemas/import.ts`. The existing per-row server functions stay unchanged — no behaviour change for the form UI.

### 2. New: MCP server module

Add `src/server/mcp/` with:

- `index.ts` — initializes the SDK `McpServer`, wires the official Streamable HTTP transport in stateless JSON-response mode, and registers the three tools.
- `auth.ts` — uses `@clerk/mcp-tools` to validate the incoming Clerk access token, resolve to `userId`, and call `ensureUserBootstrappedForUser(userId)`. Anything unauthenticated returns 401 per OAuth spec.
- `tools/list-materials.ts`, `tools/list-purchases.ts`, `tools/commit-import.ts` — one file per tool. Each defines the Zod input schema, Zod output schema, tool annotations, and the handler. Handlers call into the existing scoped-Prisma helpers (and `commitImport` for the write path).

### 3. New: Route mount

Expose the MCP server at `/mcp` via TanStack Start's server-route mechanism, using the existing `createFileRoute(...){ server: { handlers } }` pattern. The route's handlers delegate to the SDK Streamable HTTP handler exported from the MCP module.

Also expose public OAuth metadata routes:

- `/.well-known/oauth-protected-resource/mcp` — protected-resource metadata for the `/mcp` resource.
- `/.well-known/oauth-authorization-server` — Clerk authorization-server metadata for clients that need it.
- `OPTIONS` handlers for these metadata routes so browser-based MCP clients can discover them.

Metadata handlers derive the resource URL from the request origin (`new URL('/mcp', request.url)`) and use `CLERK_PUBLISHABLE_KEY` with the `@clerk/mcp-tools/server` metadata helpers.

### 4. Clerk configuration

In the Clerk Dashboard:
- Enable the **OAuth Applications** feature.
- Toggle on **Dynamic Client Registration** for MCP clients (claude.ai will auto-register).
- Confirm the consent screen content (auto-enforced when DCR is on).
- Do not configure custom read/write scopes in v1; Clerk does not currently support project-defined custom OAuth scopes.

No new env vars beyond what Leland already has for Clerk.

### 5. Dependencies

Add to `package.json`:
- `@modelcontextprotocol/sdk@^1.29.0` — server primitives, Streamable HTTP transport, and tool registration APIs.
- `@clerk/mcp-tools` — Clerk OAuth ↔ MCP glue.
- `zod` (already present, used for the schemas).

## Critical files

- [src/server/imports.ts](../src/server/imports.ts) — add `commitImport` helper and import-specific error mapping.
- [src/shared/schemas/import.ts](../src/shared/schemas/import.ts) — shared MCP import input schema.
- [src/server/purchases.ts](../src/server/purchases.ts) — no behaviour change; existing purchase CRUD remains intact.
- [src/server/materials.ts](../src/server/materials.ts) — reuse validation utilities; no behaviour change.
- [src/server/db.ts](../src/server/db.ts) — reuse `getScopedDb`.
- [prisma/schema.prisma](../prisma/schema.prisma) — **no schema changes**.
- New: `src/server/mcp/index.ts`, `src/server/mcp/auth.ts`, `src/server/mcp/tools/{list-materials,list-purchases,commit-import}.ts`.
- New route files under `src/routes/` exposing `/mcp`, `/.well-known/oauth-protected-resource/mcp`, and `/.well-known/oauth-authorization-server`. Exact filenames should be verified by route generation during implementation, because `.well-known` paths can be awkward in file-based routing.

## Verification

End-to-end:

1. **Local Clerk setup.** Enable OAuth applications + DCR in a dev Clerk project. `pnpm dev`, run `npx @modelcontextprotocol/inspector` against `http://localhost:3000/mcp` and complete the OAuth flow with a test user.
2. **Inspector smoke test.** Call `leland_list_materials` → expect the **Stylist**'s **Catalog**. Call `leland_list_purchases({ date: "2026-05-15" })` → expect that day's rows. Call `leland_list_purchases({})` and an over-31-day range → expect structured validation errors.
3. **Transport smoke test.** Verify successful MCP responses are JSON responses without a session id, and `GET /mcp`/SSE session behavior is not required for the import workflow.
4. **Atomic happy path.** Call `leland_commit_import` with a mix of 2 `kind:"existing"` + 1 `kind:"new"` line. Verify in Leland's UI that the new Material appeared and three Purchase rows exist on the chosen date.
5. **Atomic rollback.** Call `leland_commit_import` with one valid line + one referencing a `materialId` belonging to a different Stylist. Verify (a) the response is a structured error pointing at the bad line, (b) **no** rows were written.
6. **Auth isolation.** Repeat (2) with a token from Stylist A and verify it never returns Stylist B's data.
7. **Real-world eval.** Drop one of the supplied Finnish receipts ([Kuitti_196790.pdf](invoices-examples/Kuitti_196790.pdf), [Kuitti_198394.pdf](invoices-examples/Kuitti_198394.pdf)) into claude.ai with the MCP connected. Verify Claude (a) extracts the Material acquisition lines, (b) ignores non-Material fees/summary rows/negative rows, (c) matches some against an existing seeded Catalog, (d) renders a summary including category/unitOfMeasure guesses and any "needs Stylist adjustment" warnings, (e) commits after confirmation. Spot-check the resulting purchases in the Leland UI.
8. **Unit tests** (`vitest`) for the `commitImport` helper covering: all-new, all-existing, mixed, archived existing material accepted, new-material conflict with archived material rejected, duplicate same-batch new material rejection, duplicate same-batch existing material rejection, cross-Stylist `materialId` rejection, unitOfMeasure mismatch on new-material conflict, empty-items rejection, JSON-number quantity/price rejection at the schema layer, fractional `piece` quantity rejection, structured error envelope mapping.
9. **MCP tool tests** for `leland_list_materials` covering active-only default, `includeArchived`, and 500-Material cap behavior.
10. **MCP evaluation suite.** Create `tests/mcp/evals.xml` with 10 read-only questions per the mcp-builder evaluation format. Run against a seeded test user.

## Out of scope (explicit non-goals)

- Receipt entity / vendor tracking — discarded; revisit only if stylists ask for supplier-level reporting.
- Server-side OCR or PDF parsing — host LLM does this.
- Server-side fuzzy matching — LLM does this.
- Standalone material/purchase CRUD tools — defer until there's a user-driven reason.
- Multi-currency, VAT line items — Leland is single-currency, single-VAT today; no change.
- A `.dxt` package or local MCP variant — the remote OAuth path supersedes it for the target users (claude.ai).
