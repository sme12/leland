# Code conventions

## Tools

- **Formatter:** Prettier ([prettier.config.js](../prettier.config.js)). `pnpm format` writes + autofixes.
- **Linter:** ESLint flat config ([eslint.config.js](../eslint.config.js)) based on `@tanstack/eslint-config`. `import/order`, `sort-imports`, and `import/no-cycle` are intentionally off.
- **TypeScript:** `strict`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`. Use `import type` for type-only imports.

## Naming

- Components and feature files: kebab-case (`customer-form.tsx`, `visit-queries.ts`).
- Routes follow TanStack's file-route convention: `_app.customers.$customerId.edit.tsx`.

See [architecture.md](./architecture.md) for path aliases, import restrictions, and cost/money conventions.
