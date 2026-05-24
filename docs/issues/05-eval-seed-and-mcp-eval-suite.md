# Issue 5 — Eval seed + manual MCP eval suite

## What to build

Establish a frozen evaluation fixture and a small read-only MCP eval suite that any engineer can run by hand before shipping an MCP-touching release. The eval suite is **manual, pre-release** and intentionally not wired into CI — adding CI integration would require a test-only auth bypass plus Playwright-through-OAuth threading, which is disproportionate for 10 questions (Q28).

Scope (per `docs/mcp-purchase-import-plan.md` verification 10 and Q28):

### Seed fixture — `prisma/eval-seed.ts`

- Separate from the existing `prisma/seed.ts` (dev-experience seed). This new script exists purely for the eval suite.
- One fixed Stylist whose `userId` is sourced from the `EVAL_STYLIST_USER_ID` env var. The matching Clerk token is held in `EVAL_STYLIST_TOKEN` (env var, never committed). The Stylist must exist in the Clerk project used for evals.
- **12 Materials:** 9 active + 3 archived. All 10 `MaterialCategory` values are represented across the set. At least one Material each of `unitOfMeasure` `ml`, `g`, and `piece`.
- **15 Purchases** distributed across 90 days. Quantities and prices are picked so that every eval answer is an **unambiguous single string** — no ties on `(totalQuantity, totalPrice)` for a given (Material, date), no ties on aggregate answers either.
- The script is **idempotent**: re-running it returns the database to the same fixture state (truncate the eval Stylist's data, then insert). Other Stylists' data must not be touched.

### Eval questions — `tests/mcp/evals.xml`

- 10 read-only questions in the mcp-builder evaluation format. All questions are answerable through `leland_list_materials` and `leland_list_purchases` alone — no writes.
- Each question's expected answer is a single unambiguous string derived from the seed fixture.
- Questions exercise the parts of the read surface that matter most: `includeArchived` (default vs. true), category/unitOfMeasure filtering by the agent, `date` vs. `from`/`to` filtering, ordering of the results, decimal-string handling of `totalQuantity`/`totalPrice`.
- Eval questions and the seed are **frozen together**: changing the seed requires re-authoring affected questions in the **same** commit. Document this rule at the top of `tests/mcp/evals.xml`.

### Runbook

- A short README (next to the eval suite, e.g. `tests/mcp/README.md`) explains:
  - How to provision a Clerk test account, set `EVAL_STYLIST_USER_ID` / `EVAL_STYLIST_TOKEN`, and seed the database with `prisma/eval-seed.ts`.
  - How to run the eval suite manually before each MCP-touching release.
  - The "seed + questions move together" rule.
  - That this is **not** in CI by design.

## Acceptance criteria

- [ ] `prisma/eval-seed.ts` exists, is separate from `prisma/seed.ts`, and is idempotent.
- [ ] Running `eval-seed.ts` produces exactly: 1 Stylist (`EVAL_STYLIST_USER_ID`), 12 Materials (9 active + 3 archived, all 10 categories represented, at least one of each `unitOfMeasure`), and 15 Purchases distributed across 90 days.
- [ ] Every quantity/price in the fixture is chosen so eval answers are unambiguous single strings.
- [ ] `tests/mcp/evals.xml` contains exactly 10 read-only questions in the mcp-builder format, each answerable through `leland_list_materials` and/or `leland_list_purchases` alone.
- [ ] Question expected-answers match what the seed actually produces (verified by running the suite end-to-end at least once).
- [ ] `tests/mcp/README.md` documents the runbook, env vars, the "seed + questions move together" rule, and the deliberate no-CI decision.
- [ ] The suite runs successfully against a real Clerk test account end-to-end.
- [ ] Eval suite is **not** wired into CI (no GitHub Actions workflow changes).
- [ ] No production data path or app behaviour is altered — this issue ships test scaffolding only.

## Blocked by

- Issue 4 — `leland_commit_import` atomic write tool. The eval suite gates MCP-touching releases, so all three v1 tools should be merged before the suite is treated as the release-gating check. (The questions themselves are read-only and could technically run after issue 3, but the gating story is "complete tool surface".)
