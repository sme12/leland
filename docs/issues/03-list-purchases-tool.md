# Issue 3 — `leland_list_purchases` MCP tool

## What to build

Add the second read tool to the MCP server: `leland_list_purchases`. The host agent uses it to fetch the Stylist's existing **Purchases** on the **Receipt**'s invoice date so it can detect possible duplicates before calling `leland_commit_import`. The tool is intentionally bounded — it never lists the whole purchase history.

Scope (per `docs/mcp-purchase-import-plan.md` "Tool surface (v1)" and "Tool descriptions (v1)", Q11, Q13):

- Register `leland_list_purchases` with annotations `readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: true`, the exact tool description from the plan, and a declared `outputSchema`.
- **Input.**
  - `date?: string` — single ISO `YYYY-MM-DD`. Tool description tells agents to use the Receipt's invoice date (Finnish: _Laskun pvm_) — not delivery date, not payment date.
  - `from?: string` and `to?: string` — inclusive ISO range, capped at 31 days.
  - Exactly one of `date` or the pair `(from, to)` must be supplied. Empty input, both-supplied, partial pair, inverted range, and `> 31 days` ranges all return `isError: true` with `code: "validation_failed"`.
- **Output.** `Array<{ id, materialId, materialName, totalQuantity, totalPrice, date }>`, ordered by `(date desc, createdAt desc)`. `totalQuantity` and `totalPrice` are **decimal strings**, never JSON numbers (Q11). The same shape is returned whether the underlying Material is active or archived — historical Purchases stay visible (Q10 continuation).
- **Scoping.** Reads go through the existing `getScopedDb(userId)` so cross-Stylist data leaks are impossible. The `userId` already comes from the auth layer added in issue 2.
- **No new env vars, no schema changes, no behaviour change to `src/server/purchases.ts`.** The handler calls into the existing scoped Prisma helpers — purchase CRUD for the form UI remains untouched.

Out of scope: a `materialId` filter on this tool is deferred to v2 (Q31). v1 keeps the tool surface at three tools and date-based filters only.

## Acceptance criteria

- [ ] `src/server/mcp/tools/list-purchases.ts` exists and the MCP server registers it alongside `leland_list_materials`.
- [ ] Tool description, annotations, and field-level input descriptions match `docs/mcp-purchase-import-plan.md` exactly.
- [ ] `leland_list_purchases({ date: "YYYY-MM-DD" })` returns that day's Purchases for the calling Stylist.
- [ ] `leland_list_purchases({ from, to })` returns Purchases in the inclusive range when the span is ≤ 31 days.
- [ ] Output rows are ordered `(date desc, createdAt desc)`.
- [ ] `totalQuantity` and `totalPrice` are serialised as decimal strings, never JSON numbers.
- [ ] Purchases whose Material is archived are still returned (with the same row shape).
- [ ] Empty input → `isError: true` with `code: "validation_failed"`.
- [ ] Both `date` and `(from, to)` supplied → `code: "validation_failed"`.
- [ ] Range > 31 days → `code: "validation_failed"`.
- [ ] Inverted range (`from > to`) → `code: "validation_failed"`.
- [ ] Inspector smoke test: invoke from MCP Inspector against `http://localhost:3000/mcp` with each of the cases above and observe the expected results/errors.
- [ ] Auth isolation: a token from Stylist A never returns Stylist B's Purchases.
- [ ] No changes to `src/server/purchases.ts` or `prisma/schema.prisma`.

## Blocked by

- Issue 2 — MCP server foundation + `leland_list_materials`. The route mount, transport, auth resolution, and tool-registration pattern from that issue are prerequisites.
