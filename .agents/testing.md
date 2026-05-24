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
- CI runs the full Playwright suite in [.github/workflows/pr.yml](../.github/workflows/pr.yml) for same-repo PRs and pushes to `main`. Fork PRs skip E2E because GitHub does not expose the required secrets.
- CI must not use the production `DATABASE_URL`. The workflow creates a temporary Neon branch from `NEON_E2E_PARENT_BRANCH`, sets `DATABASE_URL` from the action output, applies migrations, runs `pnpm e2e`, and deletes the branch.
- `NEON_E2E_PARENT_BRANCH` should point at a migration-compatible baseline branch with sanitized or empty app data, not the production branch.
- Required CI E2E configuration: repository secret `NEON_API_KEY`, repository variable `NEON_PROJECT_ID`, repository variable `NEON_E2E_PARENT_BRANCH`, plus Clerk secrets `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_E2E_USER_A_EMAIL`, and `CLERK_E2E_USER_B_EMAIL`.
- Use centralized `data-testid` selectors for translated or draft UI copy that changes often. Prefer accessible locators when the accessible name is stable, and keep visible-text assertions when the text itself is the behavior under test.
- Test IDs are static, kebab-case, and product-semantic. Define them in `src/testing/test-ids.ts`; do not invent string literals in tests or components.
- Keep domain `data-*` attributes for row identity and loading state, such as `data-customer-id` or `data-loaded`.
