# Domain Layer

`src/domain` contains pure business logic. Functions in this directory do not
perform IO and must not import Prisma, React, server functions, routes, features,
or components.

## Cost Invariants

- Decimal and quantity inputs accept `Decimal.Value` and are normalized with
  `decimal.js`.
- Domain functions return full-precision `Decimal` values. Rounding belongs to
  persistence or presentation code.
- `computeUnitCost([], ...)` returns `0`.
- `computeUnitCost(purchases, k)` returns `0` when `k <= 0`.
- Visit costs are derived from locked line-item `totalCost` values.
- Material `remaining` can be negative; it means usage has been recorded before
  the corresponding purchase was entered.

## Test Pattern

Tests use small hand-built objects and UTC date-only helpers. Avoid DB fixtures,
mocks, server functions, and generated Prisma types in this layer.
