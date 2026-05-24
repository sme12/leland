# Issue 4 — `leland_commit_import` atomic write tool

## What to build

Ship the only write tool in v1: `leland_commit_import`. One MCP call commits an entire Receipt as new Materials + Purchases in a single Prisma transaction — every line lands or none does (Q7). This is the value-delivering slice: after it ships, a Stylist can drop a Finnish receipt into claude.ai and finish stock entry in one chat turn + one confirmation.

Scope (per `docs/mcp-purchase-import-plan.md` and Q1, Q3, Q7, Q10, Q11, Q12, Q14, Q15, Q21, Q22, Q23, Q25, Q26, Q27, Q29, Q30):

### Shared schemas — `src/shared/schemas/import.ts`

- Discriminated-union `Item` on `kind`:
  - `kind: "existing"` → `{ materialId: string, totalQuantity: string, totalPrice: string }`.
  - `kind: "new"` → `{ material: { name, category, unitOfMeasure }, totalQuantity: string, totalPrice: string }`.
- `totalQuantity` and `totalPrice` are **decimal strings**, not JSON numbers — JSON-number inputs are rejected at the schema layer (Q11).
- `totalQuantity` follows Leland's positive-quantity rules (up to 2 decimals); `totalPrice` follows Leland's money rules (zero allowed, up to 2 decimals).
- For `unitOfMeasure: "piece"`, `totalQuantity` must be an integer string — fractional `piece` quantities are rejected at the schema layer.
- `material.name` is trimmed through the existing Material schema before any conflict check (Q21).
- Top-level payload: `{ clientRequestId?: string (max 128 chars), date: string (YYYY-MM-DD), items: Item[] (length ≥ 1) }`.
- `date` is the single import date applied to every created Purchase (Q25). Mixed-date imports are out of scope.

### Transactional helper — `src/server/imports.ts`

- `async function commitImport(userId: string, input: CommitImportInput): Promise<{ createdMaterialIds: string[]; createdPurchaseIds: string[] }>`.
- Wraps the entire flow in `prisma.$transaction(async tx => { ... })`. New Materials and their Purchases are created in one all-or-nothing call (Q7).
- All reads/writes go through scoped Prisma (`getScopedDb(userId)` from `src/server/db.ts`).
- Pre-flight Catalog read: load the Stylist's Materials so `kind:"new"` lines can be cross-checked for conflicts against active **and** archived Materials (Q10).
- Reject duplicate `kind:"new"` items within the same payload (matching on trimmed `name` + `category` + `unitOfMeasure`) with `code: "duplicate_material"` plus both offending `lineIndex` / `conflictingLineIndex` (Q14).
- Reject duplicate `kind:"existing"` items within the same payload (matching on `materialId`) with `code: "duplicate_material"`.
- Reject a `kind:"new"` line when it collides with an existing active OR archived Material on `(name, category, unitOfMeasure)` — return `code: "material_conflict"` plus the conflicting `materialId` and `lineIndex` so the agent's recovery is one retry with `kind: "existing"` (Q10, Q21).
- Reject a `kind:"new"` line when a Material exists with the same `(name, category)` but a different `unitOfMeasure` — return `code: "unit_mismatch"` with `lineIndex`. The tool description tells the agent to ask the Stylist whether it's the same product in a different size convention or a genuinely new SKU.
- Reject any `kind:"existing"` `materialId` that does not belong to the calling Stylist with `code: "material_not_found"` + `lineIndex` (cross-Stylist isolation).
- Reject an empty `items` array at the schema layer (`validation_failed`).
- Catch Prisma `P2002` raised against the `materials_user_id_name_category_unit_of_measure_key` index inside the transaction (race window between pre-flight read and insert). Map the failed row back to its `kind:"new"` line via `lineIndex`, resolve the now-existing `materialId` outside the transaction, and return the same `material_conflict` envelope the pre-flight path produces. Log at `warn` level with `clientRequestId` for correlation. `P2002` against any other index → `internal_error` (Q27).
- Archived Materials accept `kind:"existing"` without being auto-restored (Q10).
- The helper never mutates the existing per-row `createPurchase` / `createMaterial` server-fn handlers in `src/server/purchases.ts` and `src/server/materials.ts` — the form UI keeps working unchanged. Validation utilities from those files **are** reused.

### MCP tool — `src/server/mcp/tools/commit-import.ts`

- Register `leland_commit_import` with annotations `readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: true`.
- Tool description, field-level input descriptions, and `outputSchema` match the strings in `docs/mcp-purchase-import-plan.md` §"Tool descriptions (v1)" exactly. The description encodes the import policy from Q12 (positive Material acquisition lines only; agent asks Stylist before committing unallocated discounts), the price convention from Q26 (VAT-inclusive `totalPrice` computed per line, multi-rate VAT handled, per-line rounding drift accepted), and the retry guidance from Q15 (call `leland_list_purchases({ date })` to verify before retrying after an unclear response).
- `clientRequestId` is trace-only (Q15) — calling twice with the same id writes rows twice. Document this in the field description.
- **Success output:** `{ createdMaterialIds: string[], createdPurchaseIds: string[] }` — IDs only, no echo of the input payload (Q22 outline + plan).
- **Error output:** `isError: true` with the `ImportError` envelope from Q22:
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
- Unknown internal exceptions → generic `internal_error`; no Prisma/stack details leak into the response (Q22, Q30). Stack traces go to server logs at `error` level.
- **Logging (Q29, Q30).** On every call, log at `info`: `userId`, `clientRequestId`, line count, and the **full Material names** of each item (product strings, not regulated PII — operationally essential for debugging weird imports). Do **not** log `totalQuantity` or `totalPrice` (commercially sensitive, diagnostically useless on their own). No application-level rate limiting (Q29).

### Refactor

- Move/extract any validation utilities required by `commitImport` so they can be reused from `src/server/imports.ts` without behaviour change to the existing UI server fns.
- The transactional helper lives in `src/server/imports.ts` (not in `src/server/purchases.ts`) because it orchestrates Materials, Purchases, validation, and import-specific errors (Q23). Shared schemas live in `src/shared/schemas/import.ts`.

## Acceptance criteria

- [ ] `src/shared/schemas/import.ts` exists with the discriminated-union `Item` schema, decimal-string `totalQuantity`/`totalPrice`, `piece`-must-be-integer rule, name-trimming, and top-level `{ clientRequestId?, date, items[] }` payload schema.
- [ ] `src/server/imports.ts` exports `commitImport(userId, input)` wrapping a single `prisma.$transaction`.
- [ ] `src/server/mcp/tools/commit-import.ts` registers the tool with the exact description, annotations, and field-level input descriptions from `docs/mcp-purchase-import-plan.md`.
- [ ] Happy path (verification 4): a mix of 2 `kind:"existing"` + 1 `kind:"new"` items succeeds, returns `{ createdMaterialIds, createdPurchaseIds }`, and the new Material + three Purchase rows appear in the Leland UI on the chosen `date`.
- [ ] Atomic rollback (verification 5): a payload with one valid line + one cross-Stylist `materialId` writes **zero** rows and returns `isError: true` with `code: "material_not_found"` and a `lineIndex` pointing at the offending row.
- [ ] Real-world demo (verification 7): dropping `docs/invoices-examples/Kuitti_196790.pdf` (or `Kuitti_198394.pdf`) into claude.ai with the MCP connected produces a per-line summary, ignores non-Material fees/summary rows/negative lines, and commits after Stylist confirmation. Spot-checked in the Leland UI.
- [ ] Vitest unit tests for `commitImport` cover **all** of the following (verification 8):
  - [ ] All-new items succeed.
  - [ ] All-existing items succeed.
  - [ ] Mixed new + existing succeed.
  - [ ] `kind:"existing"` against an archived Material succeeds (not auto-restored).
  - [ ] `kind:"new"` whose `(name, category, unitOfMeasure)` matches an archived Material is rejected with `material_conflict` + that Material's id.
  - [ ] Same-batch duplicate `kind:"new"` (two items resolving to the same new Material) is rejected with `duplicate_material` + both `lineIndex` and `conflictingLineIndex`.
  - [ ] Same-batch duplicate `kind:"existing"` (two items with the same `materialId`) is rejected with `duplicate_material`.
  - [ ] Cross-Stylist `materialId` is rejected with `material_not_found` + `lineIndex`.
  - [ ] `kind:"new"` whose `(name, category)` matches an existing Material with a different `unitOfMeasure` is rejected with `unit_mismatch` + `lineIndex`.
  - [ ] Empty `items` array is rejected with `validation_failed`.
  - [ ] JSON-number `totalQuantity` or `totalPrice` is rejected at the schema layer.
  - [ ] Fractional `totalQuantity` for a `piece` Material is rejected at the schema layer.
  - [ ] Structured `ImportError` envelope is populated with `code`, `message`, optional `lineIndex` / `conflictingLineIndex` / `materialId` / `clientRequestId` as appropriate.
- [ ] P2002 race recovery (Q27): integration-style test where a parallel insert collides with an in-flight transaction returns the `material_conflict` envelope with the now-existing `materialId`; the transaction rolls back atomically; the event is logged at `warn` level with the `clientRequestId`.
- [ ] `info`-level logs on every call include `userId`, `clientRequestId`, line count, and full Material names — they do **not** include `totalQuantity` or `totalPrice`.
- [ ] `internal_error` responses never leak Prisma or stack details; the stack lands in server logs at `error` level.
- [ ] `clientRequestId` is **not** treated as a dedupe key — calling twice with the same id writes rows twice (test or documented).
- [ ] `src/server/purchases.ts` and `src/server/materials.ts` have no behaviour changes for the existing form UI.
- [ ] No changes to `prisma/schema.prisma`.

## Blocked by

- Issue 2 — MCP server foundation + `leland_list_materials`. The route mount, transport, auth resolution, scoped-Prisma plumbing, and tool-registration pattern from that issue are prerequisites.
