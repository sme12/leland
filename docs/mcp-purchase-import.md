# MCP purchase import

This is the living reference for Leland's remote MCP server.

## Status

The v1 MCP server, OAuth metadata routes, and four purchase tools are
implemented.

Implemented:

- Clerk OAuth Applications + Dynamic Client Registration are the auth model.
- `/mcp` is mounted in the TanStack Start app and uses stateless Streamable
  HTTP JSON responses.
- OAuth discovery metadata is exposed at the required `.well-known` routes.
- `leland_list_materials`, `leland_list_purchases`, `leland_commit_import`,
  and `leland_correct_purchase` are registered with schemas, annotations, and
  structured outputs.
- `commitImport` performs the whole write in one Prisma transaction.
- `correctPurchase` performs a compare-and-replace update for one Purchase.
- Unit coverage exists for the import/correction helpers and MCP tool handlers.

Pending:

- The manual MCP eval fixture and eval suite are not implemented yet. Until
  `prisma/eval-seed.ts`, `tests/mcp/evals.xml`, and the matching runbook exist,
  MCP-touching releases are not eval-gated.

## Purpose

The MCP server lets a Stylist import a wholesale Receipt into Leland Purchases
from an MCP-capable host such as Claude.

The host LLM reads the PDF/photo Receipt. Leland never receives the file. The
MCP server only exposes structured Leland-domain data:

- the Stylist's Catalog of Materials
- bounded Purchase history for duplicate detection
- one atomic commit tool that creates new Materials and Purchases from a
  confirmed import payload
- one guarded correction tool that updates a single existing Purchase after
  explicit confirmation

The server does not do OCR, PDF parsing, server-side fuzzy matching, currency
conversion, or Receipt persistence.

## Design decisions

- **Remote server inside Leland.** The MCP server ships with the existing
  TanStack Start app on Vercel instead of as a separate service.
- **Domain-only boundary.** The host LLM reads Receipt PDFs/photos and sends
  structured data. Leland exposes Catalog, Purchase history, import commit, and
  Purchase correction tools only. Do not add a `parse_receipt(file)` tool to
  this MCP.
- **Clerk as OAuth provider.** Clerk OAuth Applications with Dynamic Client
  Registration provide MCP-compatible OAuth. Leland validates Clerk-issued
  tokens and does not host its own OAuth authorize/token endpoints.
- **No custom scopes in v1.** Clerk consent grants access to the MCP server as a
  whole. Tool-level safety comes from MCP annotations, explicit confirmation UX,
  and server validation.
- **`leland_` tool prefix.** Tool names stay prefixed even though this is a
  single-domain server, because hosts often merge tools from multiple MCP
  servers.
- **LLM-side matching.** `leland_list_materials` returns raw Catalog data. The
  host LLM does fuzzy matching and proposes new Materials when needed.
- **One Receipt, many Purchases.** A Receipt import creates one Purchase per
  distinct Material line. There is no persisted Receipt entity, vendor record,
  Receipt total, VAT summary, or supplier ledger in v1.
- **Atomic import write surface.** Import creation goes through
  `leland_commit_import` only. New Materials and their Purchases land together
  or not at all.
- **One Purchase per correction.** Corrections update exactly one existing
  Purchase at a time. The host may propose several corrections after comparing a
  Receipt with existing Purchases, but each corrected Purchase is confirmed and
  written as its own operation.
- **Compare-and-replace corrections.** A Purchase correction includes the
  current values the host believes it is replacing and the final replacement
  values. The server rejects stale corrections instead of blindly overwriting a
  Purchase that has changed since it was listed. Because the live Purchase
  matches `replacement` after a successful correction, retrying the same
  payload returns `stale_purchase`; the host must reload before retrying. The
  `leland_correct_purchase` tool is therefore advertised with
  `idempotentHint: false`.
- **Duplicate-shaped corrections are allowed.** A correction may make one
  Purchase match another Purchase on `(materialId, totalQuantity, totalPrice,
  date)`. The host should warn the Stylist, but duplicates remain possible
  because real Receipts can produce identical Purchase rows.
- **No MCP deletion in the correction slice.** `leland_correct_purchase` fixes
  wrong values on one existing Purchase. It does not delete extra Purchases; a
  remote delete tool would need its own guarded design.
- **No import idempotency ledger.** `clientRequestId` is trace-only.
  `leland_commit_import` does not deduplicate writes. `leland_correct_purchase`
  relies on its `expected` compare-and-replace guard rather than a persisted
  Receipt/Import ledger.
- **Archived Materials remain valid.** Archived Materials can be used for
  `kind: "existing"` imports and are not restored automatically. A `kind: "new"`
  line that conflicts with an active or archived Material is rejected.
- **Exact Material identity.** Conflicts use `(name, category, unitOfMeasure)`
  after existing schema trimming. The server does not case-fold, normalize
  punctuation, or fuzzy-match identities.
- **VAT-inclusive `totalPrice`.** Imported Purchase prices are the
  VAT-inclusive share of the Receipt grand total attributable to that Material
  line. Per-line rounding drift against the printed Receipt total is accepted.
- **No app-level rate limit in v1.** `leland_commit_import` logs each call for
  forensics. If abuse appears later, prefer Vercel edge/IP controls before
  adding app-level Redis counters.

## Endpoints and auth

- MCP endpoint: `/mcp`
- OAuth protected-resource metadata:
  `/.well-known/oauth-protected-resource/mcp`
- OAuth authorization-server metadata:
  `/.well-known/oauth-authorization-server`

`/mcp` uses the official MCP TypeScript SDK Streamable HTTP transport in
stateless JSON-response mode. Tool calls are `POST` requests. Authenticated
non-`POST` requests return `405`; unauthenticated requests return `401` with a
`WWW-Authenticate` challenge pointing to the protected-resource metadata.

Auth is Clerk OAuth Applications with Dynamic Client Registration enabled. Each
request token is verified through `@clerk/mcp-tools`, resolved to a Clerk
`userId`, bootstrapped with `ensureUserBootstrappedForUser(userId)`, and scoped
through `getScopedDb(userId)`.

There are no custom OAuth scopes in v1. Clerk consent grants access to the MCP
server as a whole; safety comes from MCP annotations, host confirmation UX, and
server-side validation.

## Production rollout

Before exposing `/mcp` in production:

1. Enable Clerk OAuth Applications in the production Clerk project.
2. Enable Dynamic Client Registration so MCP clients can register themselves.
3. Preview the Clerk consent screen with a production test Stylist account.
4. Do not configure custom read/write scopes for v1.
5. Deploy the app and confirm these metadata endpoints:
   `https://<production-app-domain>/.well-known/oauth-protected-resource/mcp`
   and
   `https://<production-app-domain>/.well-known/oauth-authorization-server`.
6. Connect an MCP client to `https://<production-app-domain>/mcp`, complete
   OAuth as a test Stylist, and verify returned data is scoped to that Stylist.
7. Periodically review auto-registered OAuth clients in Clerk.

## Import workflow

1. Call `leland_list_materials({ includeArchived: true })` to load the full
   Catalog before proposing any new Materials.
2. Parse the Receipt in the host LLM, ignore non-Material rows, collapse
   repeated rows for the same Material, and infer editable fields for unmatched
   Materials.
3. Call `leland_list_purchases({ date: receiptInvoiceDate })` using the
   Receipt invoice/issue date, not delivery date or payment date.
4. Compare proposed lines against existing Purchases on
   `(materialId, totalQuantity, totalPrice)`. Flag exact matches as possible
   duplicates and skip them by default unless the Stylist confirms otherwise.
5. Present a per-line summary to the Stylist, including new-Material guesses,
   duplicate flags, and any totals that need adjustment.
6. After explicit confirmation, call `leland_commit_import` once.

If a commit response is lost or unclear, do not retry blindly. First call
`leland_list_purchases({ date })` to verify what landed, then retry only missing
items if that is still correct.

Import only positive Material acquisition lines. Skip shipping fees, payment
fees, Receipt totals, VAT summary rows, and negative return/credit rows. If a
Receipt-level discount or credit cannot be cleanly allocated to Material lines,
ask the Stylist to adjust proposed totals before committing.

For unmatched Materials, the host should strip size suffixes from names, infer
`unitOfMeasure` from the line (`ml`/`L` to `ml`, `g`/`kg` to `g`, otherwise
`piece`), infer `category` from product knowledge, and default uncertain
categories to `other`. These guesses must be visible and editable in the
Stylist confirmation summary.

## Correction workflow

Use correction when an existing Purchase does not match the original Receipt or
other real-world source, such as a manually entered VAT-exclusive price that
should have been VAT-inclusive.

1. Call `leland_list_purchases` for the Receipt date or a narrow date range and
   identify the existing Purchase by `id`.
2. If the Material may be wrong, call
   `leland_list_materials({ includeArchived: true })`; active and archived
   Materials are valid correction targets.
3. Compare the Receipt with the existing Purchase values and prepare a complete
   before/after summary for exactly one Purchase.
4. Warn the Stylist if the replacement would look duplicate-shaped, but do not
   treat that as a server-side blocker.
5. After explicit confirmation, call `leland_correct_purchase` with an
   `expected` block copied from the listed Purchase and a `replacement` block
   containing the complete corrected final state.

If `leland_correct_purchase` returns `stale_purchase`, compare the returned
`currentPurchase` with the intended replacement. If it already equals the
replacement, the correction likely landed earlier; otherwise reload and ask the
Stylist to confirm the new before/after state.

## Tool surface

| Tool | Type | Purpose |
| --- | --- | --- |
| `leland_list_materials` | read-only, idempotent | Returns `{ materials }` ordered by category, name, and creation time. Defaults to active Materials only; during imports pass `includeArchived: true`. Capped at 500 Materials and returns `catalog_too_large` above that. |
| `leland_list_purchases` | read-only, idempotent | Returns `{ purchases }` for either one `date` or a `from`/`to` range capped at 31 inclusive days. Quantities, prices, and dates are strings. |
| `leland_commit_import` | destructive, not idempotent | Atomically creates new Materials and Purchases in one transaction. Returns `{ createdMaterialIds, createdPurchaseIds }` on success. |
| `leland_correct_purchase` | destructive, not retry-safe (compare-and-replace) | Corrects one existing Purchase by replacing its final `materialId`, `totalQuantity`, `totalPrice`, and `date` values after explicit Stylist confirmation. The target Material must already exist, active or archived. After a successful correction, retrying the same payload returns `stale_purchase`; reload the Purchase before retrying. |

### `leland_list_materials`

Input:

- `includeArchived?: boolean`, default `false`

Output:

```ts
{
  materials: Array<{
    id: string;
    name: string;
    category:
      | 'color'
      | 'developer'
      | 'bleach'
      | 'shampoo'
      | 'conditioner'
      | 'treatment'
      | 'styling'
      | 'tools'
      | 'disposables'
      | 'other';
    unitOfMeasure: 'ml' | 'g' | 'piece';
    isArchived: boolean;
  }>;
}
```

Behavior:

- Use `includeArchived: true` during imports and Material corrections so
  archived Catalog matches are visible before creating new Materials or choosing
  a replacement Material.
- Results are scoped to the calling Stylist.
- Results are ordered by category, name, and creation time.
- More than 500 Materials returns `isError: true` with
  `code: "catalog_too_large"`.

### `leland_list_purchases`

Input:

- `date?: string`, a single `YYYY-MM-DD` date.
- `from?: string` and `to?: string`, an inclusive `YYYY-MM-DD` range.

Exactly one of `date` or the pair `from`/`to` is required. Ranges are capped at
31 inclusive days. Empty input, mixed single-date and range input, partial
ranges, inverted ranges, invalid dates, and over-31-day ranges return
`validation_failed`.

Output:

```ts
{
  purchases: Array<{
    id: string;
    materialId: string;
    materialName: string;
    totalQuantity: string;
    totalPrice: string;
    date: string;
  }>;
}
```

Behavior:

- For duplicate detection and correction lookup, use the Receipt invoice/issue
  date (`Laskun pvm`), not delivery date or payment date.
- Results are scoped to the calling Stylist.
- Results are ordered by date descending, then creation time descending.
- Purchases for archived Materials are returned with the same row shape.
- There is no `materialId` filter in v1.

### `leland_commit_import`

`leland_commit_import` accepts one top-level `date` for the whole import and an
`items` array with one row per distinct Material:

```json
{
  "clientRequestId": "7d43cf9c-c7f8-4dcf-969a-7bd67426fd10",
  "date": "2026-05-15",
  "items": [
    {
      "kind": "existing",
      "materialId": "cm_material_123",
      "totalQuantity": "360",
      "totalPrice": "74.40"
    },
    {
      "kind": "new",
      "material": {
        "name": "GLOSS COLOR.ME 5/6",
        "category": "color",
        "unitOfMeasure": "ml"
      },
      "totalQuantity": "60",
      "totalPrice": "12.40"
    }
  ]
}
```

Payload rules:

- `date` is the Receipt invoice/issue date in `YYYY-MM-DD` and applies to every
  created Purchase.
- `items` must contain at least one row.
- Each row is either `kind: "existing"` with a `materialId` from the Catalog or
  `kind: "new"` with editable Material fields.
- `totalQuantity` and `totalPrice` are decimal strings, never JSON numbers.
- `totalQuantity` is positive with up to two decimals.
- `totalPrice` is money-shaped with up to two decimals; zero is allowed.
- `piece` Materials require integer `totalQuantity`.
- `totalPrice` is VAT-inclusive and in the Stylist's local currency.
- If the Receipt provides VAT-exclusive line totals, compute
  `round(line_net_after_discount * (1 + vat_rate), 2)`. If the Receipt mixes
  VAT rates, apply each line's own rate.
- New Material identity is exact on `(name, category, unitOfMeasure)` after the
  existing schema trimming. The server does no case-insensitive or fuzzy
  matching.
- Archived Materials are valid for `kind: "existing"` and are not restored by an
  import.
- `clientRequestId` is for logs and error correlation only. Reusing it does not
  deduplicate writes.
- Same-batch duplicate Materials are rejected instead of merged. The host agent
  must collapse repeated Receipt lines before committing.
- New Material rows with the same name and category as an existing Material but
  a different unit of measure are rejected with `unit_mismatch`; the host should
  ask the Stylist whether this is a size-convention issue or a genuinely new
  SKU.
- Concurrent Material-creation races on the unique Material identity index are
  mapped back to `material_conflict` with the now-existing `materialId`. The
  transaction still rolls back atomically; partial commits are never observable.

Business errors return MCP `isError: true` responses with JSON text and
structured content. `leland_commit_import` can return:

- `validation_failed`
- `material_not_found`
- `material_conflict`
- `duplicate_material`
- `unit_mismatch`
- `internal_error`

Errors attributable to one line include `lineIndex` when possible. Conflict
errors may include `materialId`; same-batch duplicate errors may include
`conflictingLineIndex`.

Logging:

- Every `leland_commit_import` call logs `userId`, `clientRequestId`, line
  count, and full Material names.
- Do not log `totalQuantity` or `totalPrice`.
- Unknown internal exceptions are logged server-side; MCP responses stay generic
  and do not expose Prisma details or stack traces.

### `leland_correct_purchase`

`leland_correct_purchase` accepts one `purchaseId`, one `expected` block, and
one `replacement` block. Both value blocks carry the full Purchase state:

```json
{
  "clientRequestId": "3a9e1d45-333d-45a6-9f65-30d2247c36e7",
  "purchaseId": "cm_purchase_123",
  "expected": {
    "materialId": "cm_material_123",
    "totalQuantity": "360",
    "totalPrice": "60.00",
    "date": "2026-05-15"
  },
  "replacement": {
    "materialId": "cm_material_123",
    "totalQuantity": "360",
    "totalPrice": "74.40",
    "date": "2026-05-15"
  }
}
```

Output:

```ts
{
  purchase: {
    id: string;
    materialId: string;
    materialName: string;
    totalQuantity: string;
    totalPrice: string;
    date: string;
  };
  changed: boolean;
}
```

Payload rules:

- `purchaseId` must be an existing Purchase belonging to the Stylist.
- `expected` must match the live Purchase on `materialId`, `totalQuantity`,
  `totalPrice`, and `date`; otherwise the tool returns `stale_purchase`.
- `replacement` is the complete corrected final state, not a sparse patch.
- `replacement.materialId` must reference an existing active or archived
  Material belonging to the Stylist. This tool does not create Materials.
- `replacement.totalQuantity` and `replacement.totalPrice` are decimal strings,
  never JSON numbers.
- `replacement.totalQuantity` is positive with up to two decimals.
- If the replacement Material has `unitOfMeasure: "piece"`,
  `replacement.totalQuantity` must be an integer string.
- `replacement.totalPrice` is VAT-inclusive and in the Stylist's local
  currency.
- `replacement.date` is the Receipt invoice/issue date in `YYYY-MM-DD`.
- If the live Purchase already equals both `expected` and `replacement`, the
  tool returns `changed: false` without writing.
- Duplicate-shaped replacements are allowed after Stylist confirmation.
- This tool does not create missing Purchases or delete extra Purchases.

Business errors return MCP `isError: true` responses with JSON text and
structured content. `leland_correct_purchase` can return:

- `validation_failed`
- `purchase_not_found`
- `material_not_found`
- `stale_purchase`
- `internal_error`

`stale_purchase` includes `currentPurchase` with the same Purchase row shape as
the success output. Unknown internal exceptions are logged server-side; MCP
responses stay generic and do not expose Prisma details or stack traces.

Logging:

- Every `leland_correct_purchase` call logs `userId`, `clientRequestId`,
  `purchaseId`, and `replacementMaterialId`.
- Do not log `totalQuantity` or `totalPrice`.

## Development map

- MCP server entry and transport:
  [src/server/mcp/index.ts](../src/server/mcp/index.ts)
- MCP auth helpers:
  [src/server/mcp/auth.ts](../src/server/mcp/auth.ts)
- Tool implementations:
  [src/server/mcp/tools/list-materials.ts](../src/server/mcp/tools/list-materials.ts),
  [src/server/mcp/tools/list-purchases.ts](../src/server/mcp/tools/list-purchases.ts),
  [src/server/mcp/tools/commit-import.ts](../src/server/mcp/tools/commit-import.ts),
  [src/server/mcp/tools/correct-purchase.ts](../src/server/mcp/tools/correct-purchase.ts)
- Atomic import helper:
  [src/server/imports.ts](../src/server/imports.ts)
- Guarded correction helper:
  [src/server/purchase-corrections.ts](../src/server/purchase-corrections.ts)
- Shared payload schemas:
  [src/shared/schemas/import.ts](../src/shared/schemas/import.ts),
  [src/shared/schemas/purchase-correction.ts](../src/shared/schemas/purchase-correction.ts)
- Routes:
  [src/routes/mcp.ts](../src/routes/mcp.ts),
  [src/routes/[.]well-known.oauth-protected-resource.mcp.ts](../src/routes/[.]well-known.oauth-protected-resource.mcp.ts),
  [src/routes/[.]well-known.oauth-authorization-server.ts](../src/routes/[.]well-known.oauth-authorization-server.ts)
- Unit tests:
  [src/server/imports.test.ts](../src/server/imports.test.ts),
  [src/server/purchase-corrections.test.ts](../src/server/purchase-corrections.test.ts),
  [src/server/mcp/tools/list-materials.test.ts](../src/server/mcp/tools/list-materials.test.ts),
  [src/server/mcp/tools/list-purchases.test.ts](../src/server/mcp/tools/list-purchases.test.ts),
  [src/server/mcp/tools/commit-import.test.ts](../src/server/mcp/tools/commit-import.test.ts),
  [src/server/mcp/tools/correct-purchase.test.ts](../src/server/mcp/tools/correct-purchase.test.ts)

Keep Prisma access behind [src/server/db.ts](../src/server/db.ts). MCP handlers
must resolve a `userId` first and then use `getScopedDb(userId)` or server
helpers that do the same.

The original implementation slices were:

- Clerk OAuth dashboard setup.
- MCP foundation and `leland_list_materials`.
- `leland_list_purchases`.
- `leland_commit_import` and the `commitImport` helper.
- `leland_correct_purchase` and the `correctPurchase` helper.
- Manual eval seed and read-only eval suite, still pending.

## Local smoke test

1. In the dev Clerk project, enable OAuth Applications and Dynamic Client
   Registration.
2. Start Leland with `pnpm dev`.
3. Start the MCP Inspector with `npx @modelcontextprotocol/inspector`.
4. Connect to `http://localhost:3000/mcp` using Streamable HTTP and complete the
   Clerk OAuth flow as a test Stylist.
5. Call `leland_list_materials` and verify the returned Catalog is scoped to the
   signed-in Stylist.
6. Call `leland_list_purchases` with a valid `date`, with an empty payload, and
   with a range longer than 31 days. The invalid calls should return structured
   validation errors.
7. Call `leland_commit_import` with a small confirmed payload. Verify the new
   Purchase rows in the app. Repeat with an invalid cross-Stylist or fake
   `materialId` and verify the transaction rolls back.
8. Call `leland_correct_purchase` against one test Purchase with matching
   `expected` values and a corrected `totalPrice`. Verify `changed: true`, then
   repeat with stale `expected` values and verify `stale_purchase`.

Run `pnpm test` for the unit-level coverage around the import/correction
helpers and tool handlers. Run `pnpm check` before pushing.

## Manual evals

The eval suite is intentionally manual and pre-release, not part of CI. CI
integration would require a test-only auth bypass or a Playwright-through-OAuth
threading path that is too much machinery for v1.

When implemented, it should include:

- `prisma/eval-seed.ts`, separate from `prisma/seed.ts`.
- `EVAL_STYLIST_USER_ID` and `EVAL_STYLIST_TOKEN` env vars from a real Clerk
  test account.
- A deterministic fixture for exactly one eval Stylist.
- 12 Materials: 9 active, 3 archived, all 10 categories represented, and at
  least one each of `ml`, `g`, and `piece`.
- 15 Purchases distributed across 90 days with quantities and prices chosen so
  every answer is an unambiguous single string.
- `tests/mcp/evals.xml` with 10 read-only questions answerable through
  `leland_list_materials` and `leland_list_purchases` alone.
- `tests/mcp/README.md` documenting provisioning, seeding, running, and the
  deliberate no-CI decision.

The seed and questions are frozen together: changing the seed requires
re-authoring affected questions in the same commit.

## Change checklist

When changing the MCP surface:

- update this document
- update the registered tool descriptions and field-level schema descriptions
  when the agent contract changes
- keep `/mcp` stateless and JSON-response only unless this document is updated
  with a replacement decision
- preserve the domain-only boundary: no Receipt files, OCR, or PDF parsing in
  the MCP server
- preserve atomicity for `leland_commit_import`
- preserve the compare-and-replace guard for `leland_correct_purchase`
- add or update focused tests for every new validation rule, output shape, or
  tool behavior
- update the manual eval seed/questions together once the eval suite exists

## Out of scope

- Persisted Receipt/vendor entities.
- Server-side OCR, PDF parsing, or file upload.
- Server-side fuzzy matching.
- Standalone Material CRUD or general Purchase CRUD tools.
- Remote Purchase deletion.
- Visit, Service, or Customer tools.
- Multi-currency support.
- VAT line-item persistence or per-Stylist VAT settings.
- Local `.dxt` packaging.
