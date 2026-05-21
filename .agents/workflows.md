# Workflows

## Initial setup

```bash
nvm use                  # Node 24.x (.nvmrc)
pnpm install             # pnpm 10.28.0, locked via packageManager
cp .env.example .env     # fill Clerk + DATABASE_URL
pnpm prisma:generate     # generates Prisma client into src/generated/prisma
pnpm prisma:migrate      # apply migrations to your local DB
pnpm prisma:seed         # optional — seeds materials/services for SEED_USER_IDS
```

Required env vars (see [.env.example](../.env.example)):
`CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_SIGN_IN_URL`, `CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`, `CLERK_SIGN_IN_FORCE_REDIRECT_URL`, `DATABASE_URL`, `SEED_USER_IDS`.

E2E env vars (see [.env.test.example](../.env.test.example)):
`CLERK_E2E_USER_A_EMAIL`, `CLERK_E2E_USER_B_EMAIL`, `E2E_TEST_MODE=true`.

CI E2E also requires Neon GitHub Actions configuration:
repository secret `NEON_API_KEY`, repository variable `NEON_PROJECT_ID`, and repository variable `NEON_E2E_PARENT_BRANCH`. `NEON_E2E_PARENT_BRANCH` must be a non-production Neon branch used as the parent for temporary test branches. Keep it migration-compatible and seeded only with sanitized or empty app data.

## Dev / build

```bash
pnpm dev          # vite dev on http://localhost:3000
pnpm build        # production build (Nitro / Vercel preset)
pnpm preview      # serve the build locally
pnpm vercel-build # what Vercel runs: prisma generate && migrate deploy && vite build
```

## Routes

Routes are file-based under [src/routes/](../src/routes/). The TanStack Router plugin regenerates [src/routeTree.gen.ts](../src/routeTree.gen.ts) on dev/build — never hand-edit and don't commit merge conflicts in it. Regenerate by running `pnpm dev` or `pnpm build`.

## Prisma schema changes

1. Edit [prisma/schema.prisma](../prisma/schema.prisma).
2. `pnpm prisma:migrate` — creates a migration under [prisma/migrations/](../prisma/migrations/).
3. `pnpm prisma:generate`.

Commit the migration. Do **not** commit changes to [src/generated/prisma/](../src/generated/prisma/) — it's rebuilt on every install/build.

## Deployment

- Vercel build config: [vercel.json](../vercel.json) → `pnpm vercel-build` runs `prisma generate && prisma migrate deploy && vite build`. Pushes to `main` deploy via Vercel.
- CI ([.github/workflows/pr.yml](../.github/workflows/pr.yml)) runs on PR and pushes to `main`: install → `prisma:generate` → `typecheck` → `lint` → `test`. A separate Playwright job creates a temporary Neon E2E branch, runs migrations, runs `pnpm e2e`, uploads artifacts, and deletes the branch.
