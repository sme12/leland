# AGENTS.md

Leland is a [TanStack Start](https://tanstack.com/start) full-stack React app (SSR + server functions) on Vercel, with Prisma/Postgres, Clerk auth, and Tailwind v4.

**Package manager:** pnpm 10.28.0 (locked via `packageManager`). Node 24.x via `.nvmrc`.

**PR gate:** run `pnpm check` before pushing — it runs prettier, typecheck, lint, and unit tests. CI enforces the same code checks and also runs Playwright E2E for same-repo PRs/pushes against a temporary Neon E2E branch, never the production database.

## Tripwires

ESLint will catch these, but knowing them upfront prevents wasted work:

- **Prisma access only through [src/server/db.ts](src/server/db.ts).** Never import `@prisma/client` or anything under `**/generated/prisma` elsewhere.
- **[src/domain/](src/domain/) is pure.** No Prisma, no React, no imports from `#/server`, `#/routes`, `#/features`, `#/components`. If your change needs one of these, the logic belongs in `server/` or `features/`.
- **[src/routeTree.gen.ts](src/routeTree.gen.ts) is generated** by the TanStack Router plugin — never hand-edit, never resolve conflicts in it manually.

## Topic docs

- [Architecture & enforced rules](.agents/architecture.md)
- [Setup, dev, build, deploy](.agents/workflows.md)
- [Testing (Vitest + Playwright)](.agents/testing.md)
- [Code conventions](.agents/conventions.md)
- [Pull requests & commits](.agents/contributing.md)
- [Troubleshooting](.agents/troubleshooting.md)

Product context lives in [docs/leland-prd-v4.md](docs/leland-prd-v4.md).
