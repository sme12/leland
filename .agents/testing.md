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

- Config: [playwright.config.ts](../playwright.config.ts). Tests are serial (`fullyParallel: false`).
- The runner boots `pnpm dev` if `PLAYWRIGHT_BASE_URL` isn't set. It loads `.env.test.local`, `.env.test`, `.env.local`, `.env` in that order (first wins).
- **E2E is currently disabled in CI** — Playwright steps in [.github/workflows/pr.yml](../.github/workflows/pr.yml) are commented out. Run e2e locally before shipping changes to flows under [tests/](../tests/).
