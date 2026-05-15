# Troubleshooting

- **"Prisma client not found" or stale types after schema change** — `pnpm prisma:generate`.
- **ESLint complains about `@prisma/client` import** — intentional; route the call through [src/server/db.ts](../src/server/db.ts). Domain code should not need Prisma at all.
- **Route not picked up** — restart `pnpm dev`; the router plugin regenerates [src/routeTree.gen.ts](../src/routeTree.gen.ts) on file changes.
- **Playwright can't sign in** — verify `.env.test` has both Clerk e2e user emails and `E2E_TEST_MODE=true`. The config loads `.env.test.local`, `.env.test`, `.env.local`, `.env` in that order (first wins).
- **Vercel build fails on `migrate deploy`** — `DATABASE_URL` in Vercel env must point to a reachable Postgres; migrations in [prisma/migrations/](../prisma/migrations/) must be committed.
