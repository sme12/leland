# Testing

```bash
pnpm test         # Vitest unit/component (jsdom). Matches src/**/*.test.{ts,tsx}
pnpm e2e          # Playwright full suite (tests/)
pnpm e2e:smoke    # Playwright @smoke tag only
pnpm typecheck    # tsc --noEmit, strict
pnpm lint         # ESLint
pnpm check        # prettier --check && typecheck && lint && test (PR gate)
```

## Unit / component (Vitest)

- Tests live next to source as `*.test.ts(x)`. Config: [vitest.config.ts](../vitest.config.ts).
- Domain tests (e.g. [src/domain/cost.test.ts](../src/domain/cost.test.ts)) must stay pure — no Prisma, no mocks, no server imports. Use small hand-built objects.

## E2E (Playwright)

- Config: [playwright.config.ts](../playwright.config.ts). Tests run with one worker because the current E2E suite shares Clerk test users and cleanup prefixes.
- The runner boots `pnpm dev` if `PLAYWRIGHT_BASE_URL` isn't set. It loads `.env.test.local`, `.env.test`, `.env.local`, `.env` in that order (first wins).
- Use centralized `data-testid` selectors for translated or draft UI copy that changes often. Prefer accessible locators when the accessible name is stable, and keep visible-text assertions when the text itself is the behavior under test.
- Test IDs are static, kebab-case, and product-semantic. Define them in `src/testing/test-ids.ts`; do not invent string literals in tests or components.
- Keep domain `data-*` attributes for row identity and loading state, such as `data-customer-id` or `data-loaded`.
- **E2E is currently disabled in CI** — Playwright steps in [.github/workflows/pr.yml](../.github/workflows/pr.yml) are commented out. Run e2e locally before shipping changes to flows under [tests/](../tests/).
