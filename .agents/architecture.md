# Architecture

## Layered structure

- [src/domain/](../src/domain/) — **pure** business logic (cost & period math). No IO, no React, no Prisma, no `server`/`routes`/`features`/`components` imports. Returns full-precision `decimal.js` values. See [src/domain/README.md](../src/domain/README.md).
- [src/server/](../src/server/) — server functions; DB access via the scoped wrapper in [src/server/db.ts](../src/server/db.ts). Only this file may import `@prisma/client` / generated Prisma directly (enforced by ESLint).
- [src/features/](../src/features/) — feature-scoped UI + TanStack Query hooks (`*-queries.ts`).
- [src/routes/](../src/routes/) — TanStack Router file routes.
- [src/shared/](../src/shared/) — cross-layer utilities, Zod schemas (in [src/shared/schemas/](../src/shared/schemas/)), seed data.
- [src/components/](../src/components/) — app-level components, including [src/components/ui/](../src/components/ui/) primitives.

## Path aliases

`#/*` and `@/*` both resolve to `src/*` (see [tsconfig.json](../tsconfig.json), [vitest.config.ts](../vitest.config.ts)). Prefer `#/` for cross-module imports; relative paths within the same feature are fine.

## Enforced rules (ESLint `no-restricted-imports`)

- **No direct Prisma imports.** Banned: `@prisma/client`, `**/generated/prisma`, `#/generated/prisma`. Only [src/server/db.ts](../src/server/db.ts) and [prisma/seed.ts](../prisma/seed.ts) may bypass.
- **Domain layer** cannot import: Prisma, generated Prisma types, anything under `#/server`, `#/routes`, `#/features`, `#/components`, or `react` / `react-dom`.

## Stack

- React 19, `@base-ui/react`, Tailwind v4, `lucide-react`, `react-hook-form`, `react-i18next`
- Prisma 7 + PostgreSQL via Neon serverless driver; generated client lives in [src/generated/prisma/](../src/generated/prisma/) (do not commit)
- Clerk (`@clerk/tanstack-react-start`) — sign-in routes at [src/routes/sign-in.tsx](../src/routes/sign-in.tsx) and [src/routes/sign-in.$.tsx](../src/routes/sign-in.$.tsx); server-side helpers in [src/server/auth.ts](../src/server/auth.ts)
- TanStack Query for client state; server functions in [src/server/](../src/server/)
- Zod schemas in [src/shared/schemas/](../src/shared/schemas/), shared between client forms and server functions

## Cost / money conventions

- Decimal inputs accept `Decimal.Value`; normalize with `decimal.js`.
- Domain functions return full-precision `Decimal`. Round at the persistence or presentation boundary, never inside `domain/`.
- Invariants (empty-input behavior, negative `remaining`, etc.) live in [src/domain/README.md](../src/domain/README.md).
