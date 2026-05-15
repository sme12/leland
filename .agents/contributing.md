# Pull requests & commits

- NEVER COMMIT WITHOUT USER ASKING EXPLICITLY!
- Branch from `main`; PRs target `main`.
- Run `pnpm check` locally before pushing — same gate CI enforces (minus e2e).
- If you changed [prisma/schema.prisma](../prisma/schema.prisma), commit the generated migration under [prisma/migrations/](../prisma/migrations/). Don't commit [src/generated/prisma/](../src/generated/prisma/) — it rebuilds on install/build.
- Don't commit edits to [src/routeTree.gen.ts](../src/routeTree.gen.ts) that weren't produced by adding/removing route files.

## Commit messages

Conventional Commits — short imperative subject prefixed with a type: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, etc.
