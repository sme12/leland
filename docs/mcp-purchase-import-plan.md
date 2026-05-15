# MCP-Driven Purchase Import from Invoices

## Context

Leland users (independent hair stylists) currently register every stock purchase by hand: open the purchases form, pick a material from a dropdown, type count × size, price, and date. A wholesale receipt with 5–10 line items takes several minutes of fiddly typing. Most stylists already collect paper/PDF/photo receipts.

This change introduces a **remote MCP server** that ships alongside the existing TanStack Start app. The user uploads a receipt to Claude (or any MCP-capable agent), the agent reads it natively, fuzzy-matches lines against the user's existing `Material` catalog, presents a summary, and on confirmation commits the whole batch atomically through one MCP tool call. The MCP server itself is a thin, domain-only surface — it never touches the PDF.

Outcome: a 10-line receipt drops from ~5 minutes of manual entry to one chat turn + one confirmation.

## Resolved decisions (from grilling)

- **Q1 — Unit of import.** One receipt → N `Purchase` rows, one per distinct material line. Receipt-level fields (vendor, invoice #, totals, VAT) are discarded — Leland has no `Receipt` entity and we are **not** introducing one. "6 × 60ml" tubes collapse into one `Purchase` with `totalQuantity = 360`.
- **Q2 — Matching strategy.** Server returns raw catalog; the LLM does the matching. No server-side string similarity.
- **Q3 — New material inference.**
  - `name`: LLM strips size suffix, mirrors the user's existing naming style.
  - `unitOfMeasure`: parsed from line text (ml/L → ml; g/kg → g; otherwise `piece`).
  - `category`: inferred from product knowledge, defaults to `other` when uncertain.
  - All three editable by the user before commit.
- **Q4 — Duplicate detection.** Agent calls `list_purchases(date)` pre-summary; matches on `(materialId, totalQuantity, totalPrice, date)` are flagged as "possible duplicate — skip?" with skip default. No server-side rejection.
- **Q5 — Hosting & auth.** Remote MCP server in the same Vercel deployment as the Leland app. OAuth via Clerk's OAuth-applications mode with Dynamic Client Registration enabled. Wired with `@clerk/mcp-tools`. Each tool call resolves to a `userId`; every Prisma query goes through the existing `getScopedDb(userId)`. See [docs/adr/0001-clerk-as-mcp-oauth-provider.md](adr/0001-clerk-as-mcp-oauth-provider.md).
- **Q6 — Invoice parsing.** The **host LLM** reads the PDF/image. The MCP server never sees the file. MCP tools accept structured input only. See [docs/adr/0002-mcp-server-domain-only.md](adr/0002-mcp-server-domain-only.md).
- **Q7 — Commit semantics.** Writes go through **one atomic tool**, `commit_import`, wrapping a single Prisma `$transaction`. New materials and their purchases are created in one all-or-nothing call. Reads stay granular. See [docs/adr/0003-atomic-commit-import.md](adr/0003-atomic-commit-import.md).

## Tool surface (v1)

Three tools. Names unprefixed because this server is single-domain.

| Tool | Annotations | Purpose |
|---|---|---|
| `list_materials` | readOnly, idempotent | Returns the user's full catalog `[{ id, name, category, unit, isArchived }]`. Optional `includeArchived` flag (default false). |
| `list_purchases` | readOnly, idempotent | Returns purchases for a date or date range `[{ id, materialId, materialName, totalQuantity, totalPrice, date }]`. Filters: `date` (single day) or `from`/`to`. |
| `commit_import` | destructive, **not** idempotent | Atomic batch import. Input is an array of items, each `{ kind: "existing", materialId, totalQuantity, totalPrice, date } \| { kind: "new", material: { name, category, unit }, totalQuantity, totalPrice, date }`. Server wraps everything in one Prisma transaction. Returns `{ createdMaterialIds, createdPurchaseIds }` on success, or a structured error pinpointing the offending line on failure. |

Out of scope for v1 (deliberate): standalone `create_material`, `update_purchase`, anything touching `Visit` / `Service` / `Customer`. Easy to add later — kept out now to minimise surface area.

Each tool uses Zod for input validation with field-level descriptions, and declares an `outputSchema` so clients get structured content. Errors are returned as MCP `isError: true` responses with actionable messages (e.g. _"material id `cmX...` belongs to another user"_, _"new material 'Koleston 7/0' conflicts with existing material id `cmY...` — use kind:'existing' instead"_).

## Implementation outline

### 1. Refactor: extract a transactional commit helper

Today, `createPurchase` and `createMaterial` in [src/server/purchases.ts](../src/server/purchases.ts) and [src/server/materials.ts](../src/server/materials.ts) are TanStack `createServerFn` handlers — fine for the existing form path, but not directly reusable from MCP.

Add a pure helper in `src/server/purchases.ts` (or a new `src/server/imports.ts`):

```ts
async function commitImport(
  userId: string,
  items: ImportItem[],
): Promise<{ createdMaterialIds: string[]; createdPurchaseIds: string[] }>
```

It runs `prisma.$transaction(async tx => { ... })` and uses the same scoping/validation utilities already in [src/server/db.ts](../src/server/db.ts). The existing per-row server functions stay unchanged — no behaviour change for the form UI.

### 2. New: MCP server module

Add `src/server/mcp/` with:

- `index.ts` — wires the MCP server (`@modelcontextprotocol/sdk` Streamable HTTP transport, stateless JSON) and registers the three tools.
- `auth.ts` — uses `@clerk/mcp-tools` to validate the incoming Clerk access token and resolve to `userId`. Anything unauthenticated returns 401 per OAuth spec.
- `tools/list-materials.ts`, `tools/list-purchases.ts`, `tools/commit-import.ts` — one file per tool. Each defines the Zod input schema, Zod output schema, tool annotations, and the handler. Handlers call into the existing scoped-Prisma helpers (and `commitImport` for the write path).

### 3. New: Route mount

Expose the MCP server at `/api/mcp` via TanStack Start's API-route mechanism (file path follows Start's routing convention — likely `src/routes/api/mcp.$.ts` or via `createAPIFileRoute`). The handler delegates to the MCP module's Streamable HTTP listener.

### 4. Clerk configuration

In the Clerk Dashboard:
- Enable the **OAuth Applications** feature.
- Toggle on **Dynamic Client Registration** for MCP clients (claude.ai will auto-register).
- Confirm the consent screen content (auto-enforced when DCR is on).

No new env vars beyond what Leland already has for Clerk.

### 5. Dependencies

Add to `package.json`:
- `@modelcontextprotocol/sdk` — server primitives and Streamable HTTP transport.
- `@clerk/mcp-tools` — Clerk OAuth ↔ MCP glue.
- `zod` (already present, used for the schemas).

## Critical files

- [src/server/purchases.ts](../src/server/purchases.ts) — add `commitImport` helper.
- [src/server/materials.ts](../src/server/materials.ts) — reuse validation utilities; no behaviour change.
- [src/server/db.ts](../src/server/db.ts) — reuse `getScopedDb`.
- [prisma/schema.prisma](../prisma/schema.prisma) — **no schema changes**.
- New: `src/server/mcp/index.ts`, `src/server/mcp/auth.ts`, `src/server/mcp/tools/{list-materials,list-purchases,commit-import}.ts`.
- New: `src/routes/api/mcp.$.ts` (route mount; exact file name per TanStack Start convention).

## Verification

End-to-end:

1. **Local Clerk setup.** Enable OAuth applications + DCR in a dev Clerk project. `pnpm dev`, run `npx @modelcontextprotocol/inspector` against `http://localhost:3000/api/mcp` and complete the OAuth flow with a test user.
2. **Inspector smoke test.** Call `list_materials` → expect the user's catalog. Call `list_purchases({ date: "2026-05-15" })` → expect that day's rows.
3. **Atomic happy path.** Call `commit_import` with a mix of 2 `kind:"existing"` + 1 `kind:"new"` line. Verify in Leland's UI that the new material appeared and three purchase rows exist on the chosen date.
4. **Atomic rollback.** Call `commit_import` with one valid line + one referencing a `materialId` belonging to a different user. Verify (a) the response is a structured error pointing at the bad line, (b) **no** rows were written.
5. **Auth isolation.** Repeat (2) with a token from user A and verify it never returns user B's data.
6. **Real-world eval.** Drop one of the supplied Finnish receipts ([Kuitti_196790.pdf](invoices-examples/Kuitti_196790.pdf), [Kuitti_198394.pdf](invoices-examples/Kuitti_198394.pdf)) into claude.ai with the MCP connected. Verify Claude (a) extracts the line items, (b) matches some against an existing seeded catalog, (c) renders a summary including category/unit guesses, (d) commits after confirmation. Spot-check the resulting purchases in the Leland UI.
7. **Unit tests** (`vitest`) for the `commitImport` helper covering: all-new, all-existing, mixed, cross-user `materialId` rejection, unit mismatch on new-material conflict, empty-items rejection.
8. **MCP evaluation suite.** Create `tests/mcp/evals.xml` with 10 read-only questions per the mcp-builder evaluation format. Run against a seeded test user.

## Out of scope (explicit non-goals)

- Receipt entity / vendor tracking — discarded; revisit only if stylists ask for supplier-level reporting.
- Server-side OCR or PDF parsing — host LLM does this.
- Server-side fuzzy matching — LLM does this.
- Standalone material/purchase CRUD tools — defer until there's a user-driven reason.
- Multi-currency, VAT line items — Leland is single-currency, single-VAT today; no change.
- A `.dxt` package or local MCP variant — the remote OAuth path supersedes it for the target users (claude.ai).
