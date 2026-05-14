# Leland — Product Requirements Document

**Version:** 4.0
**Status:** Approved scope for proof-of-concept implementation
**Date:** 2026-05-14

---

## Changelog

### v4.0 — 2026-05-14

The add-visit flow gains a **Service** concept: every visit is now associated with one service from a fixed, preseeded list, and the service drives an auto-prefill of the charged amount. This is a breaking change to the domain model (new entity, new required FK on Visit) and to the add-visit flow ordering.

- **§3 Goals**: added the service-driven prefill goal.
- **§4 Non-goals**: removed "Service catalog or service-type field on visits" (now in scope); added explicit exclusions for service add/rename/archive UI.
- **§5.3 Flow B**: rewritten to match the new field order (date → customer → materials → service → charged → note) and to formalize Side-tracks A (new customer) and B (new material with strict-mode interstitial).
- **§6.1 Entities**: added `Service`; added `service_id` (NOT NULL FK) to `Visit`.
- **§6.3 Multi-tenancy**: `Service` joins the list of user-scoped entities. Preseeding of the 5 services happens at user provisioning time.
- **§7.3 Strict-mode invariant**: invariant unchanged. Picker display changes from "filter out zero-purchase materials" to "render them dimmed with a 'buy first →' affordance" that routes into purchase entry.
- **§7.4 Editing**: clarified that changing `Visit.service_id` does not re-prefill `price_charged`.
- **§7.5 Deletion**: `Service` follows the Material/Customer soft-archive pattern (no archive UI in v1).
- **§7.8 (new) Service price prefill**: the dirty-flag behavior governing `price_charged` auto-fill in the add-visit form.
- **§8.2 Visits — list**: clarified month grouping (already in the mockup).
- **§8.6 (new) Service price list**: minimal price-edit UI under Catalog.
- **§9.2 Validation**: visit dates may be back-dated but not future-dated; charged may be zero but not negative.
- **§10 Future considerations**: added configurable service list and per-service reporting.

### v3.0 — 2026-05-09

- **§2 Form factor and rollout**: replaced "no auth in v1" with Clerk-based authentication in v1; expanded users from one to two (primary + technical test account, fully isolated); changed internationalization from single locale to two locales (English, Russian), single currency unchanged.
- **§4 Non-goals**: tightened the auth non-goal from "Authentication UI, signup, password reset, multi-user account management" to the parts that remain out of scope (public signup, account self-service, multi-tenant product features). Authentication itself is now in v1.
- **§6.3 Multi-tenancy**: replaced "single hardcoded user" with the authenticated Clerk user, and noted that authorization is enforced via a request-scoped DB wrapper rather than ambient assumptions.
- **§9.1 Currency, locale, timezone**: noted EN + RU locales using CLDR plural rules.
- **§9.4 Concurrency**: refined "single-user, single-device" to "per-user, single-device" since v1 now has two users.
- **§10 Future considerations**: removed "Multi-user with auth" (auth is now in v1). Added "Public multi-user product (open signup, billing, multiple stylists)."

### v2.0 — 2026-05-09

- **§7.1 Cost attribution**: replaced all-time weighted average with a sliding-window model (last K=3 purchases). Prevents stale historical prices from distorting current unit costs. Fallback: uses all available purchases when fewer than 3 exist.

---

## 1. Summary

Leland is a mobile-first helper app for an independent hairstylist. It does two things:

1. Tracks purchases of materials (color, developer, shampoos, disposables, tools).
2. Tracks customer appointments and computes their true material cost and net, by linking material usage back to the user's purchase history.

The product exists because off-the-shelf salon-management software over-serves this use case. Leland is built for a single working hairstylist whose primary unmet need is _cost accuracy per appointment_, not scheduling, marketing, or client management.

## 2. Form factor and rollout

- **Platform:** Mobile-first PWA. A native app is a future direction, not a v1 commitment.
- **Users:** Two users in v1 — the product owner's wife (primary) and a technical test account, both with real authenticated identities and fully isolated data. The technical user exists to exercise the multi-tenancy pattern in tests rather than relying on the pattern being nominally correct under a single user. Multi-user as a _product_ feature (public signup, multiple stylists, billing) is a future direction.
- **Auth:** Clerk-based authentication in v1. The data model's `user_id` (§6.3) carries the authenticated Clerk user ID. Both v1 users are provisioned manually (no public signup). User provisioning also preseeds the per-user service list (§6.3).
- **Internationalization:** Two locales (English, Russian) with CLDR plural rules; single currency. No FX, no timezone modeling beyond date-only fields.

## 3. Goals

- Capture material purchases with enough fidelity to derive per-unit cost.
- Capture appointments with line-item material usage.
- Capture the service type of each appointment, and use a per-user price list to auto-suggest the charged amount.
- Show per-appointment material cost, charged price, and derived net side by side.
- Show period totals (week, month) for revenue, material cost, and net.
- Provide per-customer and per-material drill-downs.

## 4. Explicit non-goals (v1)

These were considered during design and deliberately excluded from v1:

- Service catalog management beyond editing the default price of preseeded rows. No add, rename, or archive of services in the v1 UI.
- Per-service reporting (revenue by service, visit counts by service, service-based filtering).
- Charts of any kind.
- Custom date-range picker (presets only).
- Per-category roll-up reports.
- Public signup, account self-service (password reset UI, profile management), and multi-user product features such as multiple stylists per account or shared data. (Authentication itself is in v1; the v1 users are provisioned manually.)
- Stock depletion, FIFO accounting, lot-level inventory tracking.
- "What did I use on this customer last time?" view (deferred; data model supports it).
- Email or invoice OCR for automated purchase entry.

## 5. Personas and core user flows

### 5.1 Persona

A working hairstylist. Logs purchases ad-hoc when she handles receipts. Logs appointments after they happen, typically the same evening. Mobile-only. Limited tolerance for friction; will abandon the app if data entry feels heavier than mental shorthand.

### 5.2 Flow A — Record a purchase

1. Open Purchases.
2. Tap "Add purchase."
3. Pick a material from the catalog (or tap "+ New material" to add one inline; see Flow C).
4. Enter container count, size each, and total price.
    - For materials whose unit of measure is `piece`, the form collapses to count and total price.
5. Confirm date (default: today).
6. Save.

### 5.3 Flow B — Record an appointment

The visit form is a single scrolling form. Fields appear top-to-bottom in fill order, with a persistent action bar at the bottom showing CHARGED, COST, and a Save button. NET is not shown on this form — it surfaces in the visits list and stats screens (see §8.2, §8.3).

1. Open Visits.
2. Tap "Add visit."
3. Confirm date (default: today; future dates blocked, back-dating allowed — see §9.2).
4. Pick a customer (or create one inline; see Side-track A).
5. Add material line items: pick material → enter amount → see live unit cost and computed line cost → add another. Materials with no recorded purchases appear dimmed in the picker with a "buy first →" affordance (see §7.3). New materials can be added inline (see Side-track B).
6. Pick a service type from the preseeded list (Cut, Color, Cut + Color, Treatment, Other). The picker is a single-select bottom sheet. Picking a service prefills the Charged field from the service's default price (see §7.8).
7. Confirm or override Charged. Editing Charged marks it "touched"; subsequent service changes will not overwrite a touched value (§7.8).
8. Optionally add a free-text note.
9. Save. The Save button is disabled until: a customer is set, a service is set, every line item (if any) has a non-zero amount, and Charged is non-negative. A handwritten-style hint above the button names what is still missing.

Zero material line items is valid. A pure-labor visit (e.g., a cut with no consumables) records COST = 0 and NET = price_charged. The form does not require at least one line item.

#### Side-track A — Inline customer creation

1. In the customer picker, typing a name with no match surfaces a "create new customer '<query>'" CTA.
2. Tapping opens a New customer form (name required, comment optional).
3. On save, returns to the visit form with the new customer pre-selected.

#### Side-track B — Inline material creation with strict-mode interstitial

1. In the material picker, typing a name with no match surfaces a "create new material '<query>'" CTA. Alternatively, tapping a dimmed (zero-purchase) row's "buy first →" affordance enters this side-track at step 3 for that material.
2. New material form: name, unit of measure (`ml` / `g` / `piece` — locked after creation), category.
3. Strict-mode interstitial: a first-purchase form, required because cost cannot be computed for the visit line item without at least one purchase. She enters container count, size each, and total price (collapsed to count + total for `piece` materials). The computed per-unit cost is shown for confirmation.
4. On save, returns to the visit form with the new material added as a fresh line item, ready for amount entry.

### 5.4 Flow C — Onboarding the catalog and existing stock

On first use, the catalog is empty. The user:

1. Adds materials to the catalog (name, unit of measure, category) as she encounters them — usually inline from the purchase form or the visit form (Side-track B).
2. For materials currently sitting on her shelf at app start, records a "purchase" representing remaining quantity at original per-unit price (see §6.5 for the helper text).

The 5 services (Cut, Color, Cut + Color, Treatment, Other) are preseeded at user provisioning time and visible from the first visit. Their default prices may be edited (§8.6).

There is no separate onboarding wizard in v1; the catalog populates organically as she records first-time purchases and first-time visits.

## 6. Domain model

### 6.1 Entities

```
Material {
  id
  user_id
  name                  string
  unit_of_measure       enum: ml | g | piece
  category              enum (see §6.2)
  is_archived           boolean, default false
  created_at, updated_at
}

Customer {
  id
  user_id
  name                  string
  comment               string, optional
  is_archived           boolean, default false
  created_at, updated_at
}

Service {
  id
  user_id
  name                  string
  default_price         decimal, nullable     -- NULL = prompt for price each visit (e.g., "Other")
  display_order         integer
  is_archived           boolean, default false
  created_at, updated_at
}

Purchase {
  id
  user_id
  material_id           FK → Material
  total_quantity        decimal               -- in material's UoM
  total_price           decimal
  date                  date
  created_at, updated_at
}

Visit {
  id
  user_id
  customer_id           FK → Customer
  service_id            FK → Service, NOT NULL
  date                  date
  price_charged         decimal
  note                  string, optional
  created_at, updated_at
}

VisitLineItem {
  id
  visit_id              FK → Visit
  material_id           FK → Material
  amount                decimal               -- in material's UoM
  unit_cost             decimal               -- locked-in rate
  total_cost            decimal               -- = amount × unit_cost, persisted
}
```

### 6.2 Category enum

`Color, Developer, Bleach, Shampoo, Conditioner, Treatment, Styling, Tools, Disposables, Other`

Category is informational (used for grouping in views). It does not participate in cost logic. Categories apply to Materials only; Services do not have a category.

### 6.3 Multi-tenancy

`user_id` is present on `Material`, `Customer`, `Service`, `Purchase`, `Visit` from day 1. `VisitLineItem` inherits user scope via its parent `Visit`. All read and write queries are scoped by `user_id` via a request-scoped DB wrapper that injects the filter automatically — server functions never use an unscoped client. Every record is owned by the authenticated Clerk user (one of the two v1 users).

**Service preseeding.** At user provisioning time, the 5 services are inserted for the new user with the following defaults:

| `name`        | `default_price` | `display_order` |
|---------------|-----------------|-----------------|
| Cut           | (configurable)  | 1               |
| Color         | (configurable)  | 2               |
| Cut + Color   | (configurable)  | 3               |
| Treatment     | (configurable)  | 4               |
| Other         | NULL            | 5               |

Seed prices come from a configuration constant; the user can change them via §8.6. The seed is per-user — no shared/global service rows exist.

Isolation is verified by an end-to-end test that signs in as user A, creates records (including a price edit on a service), then signs in as user B and asserts that user A's records — including the edited service price — are not visible. This test exists from day 1 to ensure the pattern is exercised across all user-scoped entities, not just nominally present.

### 6.4 Unit of measure (UoM)

UoM lives on `Material` and is fixed for the lifetime of the material. The same physical product is always measured the same way. UoM determines:

- Which input fields the purchase form shows (three for ml/g, two for piece).
- The unit applied to amounts on line items.

Services have no UoM.

### 6.5 Container concept

The purchase form uses container-aware UI ("how many," "size each," "total price") because that matches the user's mental model. The container fields are scaffolding only. The persisted record stores `total_quantity = count × size_each` and `total_price`. The container breakdown is not retained.

For opening stock (partially-used containers at app start), the form's helper text should suggest:

> For partially used stock, enter remaining quantity and what that quantity originally cost (`remaining × original per-unit price`).

## 7. Cost attribution and core invariants

### 7.1 Cost attribution

When a `VisitLineItem` is written, its `unit_cost` is derived from the **last K=3 purchases** of that material (by `date`, descending), owned by the current user, that exist at write time:

```
recent_purchases = last 3 purchases of this material, ordered by date desc
unit_cost = Σ recent_purchases.total_price / Σ recent_purchases.total_quantity
```

If fewer than 3 purchases exist, all available purchases are used (minimum 1; the strict-mode invariant in §7.3 guarantees at least one exists).

`total_cost = amount × unit_cost`. Both `unit_cost` and `total_cost` are persisted ("locked in"). Subsequent purchases never alter past line items.

**Rationale.** The previous model (v1.0) averaged across _all_ purchases ever recorded. This caused stale historical prices — from purchases long since consumed — to drag the average away from the user's current cost reality. K=3 keeps the window tight enough to reflect recent pricing while smoothing out single-purchase variance. The value K=3 was chosen because it typically spans 2–6 months of purchase history for the most frequently used materials in this domain, which balances recency against stability. No time-based window (e.g., "last 6 months") is used because it would require a fallback for materials purchased less frequently, adding complexity without meaningful accuracy gains over a count-based window.

**Date-ordering tie-break.** If multiple purchases share the same `date`, they are additionally ordered by `created_at` descending to produce a deterministic selection.

### 7.2 Net per visit

```
net = price_charged − Σ line_item.total_cost
```

`net` is a derived value computed on display. Not persisted.

### 7.3 Strict-mode invariant

A `VisitLineItem` cannot be created for a material with zero purchases at write time. The invariant is enforced at write; the picker displays zero-purchase materials in a **dimmed** state with a `buy first →` affordance that routes the user into purchase entry for that material (via Side-track B, §5.3, entering at step 3). After completing the inline purchase, the user returns to the visit form and the material becomes selectable.

Rationale: prevents zero-cost contamination and makes the cost engine predictable, while keeping the existence of un-purchased materials visible to the user rather than silently filtering them out. Future automation (e.g., parsing email invoices) is the planned mitigation for the friction of recording first purchases.

### 7.4 Editing

Any field on any record can be edited freely. Specifically:

- Editing a `Purchase` (price, quantity, date) does **not** recompute past `VisitLineItem` costs.
- Editing `VisitLineItem.amount` recomputes `total_cost` against the stored `unit_cost`. The unit cost itself is not re-derived.
- Editing `VisitLineItem.material_id` recomputes both `unit_cost` (against the new material's last 3 purchases at edit time) and `total_cost`.
- Editing `Visit.service_id` does **not** alter `price_charged`. The service-price prefill (§7.8) applies only to the add-visit form, and only while `price_charged` is untouched in that session.
- Editing `Service.default_price` does **not** alter `price_charged` on past visits. Visits carry their own charged amounts.
- To correct a past visit's cost following a purchase correction, the user edits the line item directly.

### 7.5 Deletion

- `Purchase`, `Visit`, `VisitLineItem`: hard delete. Aggregates recompute. No cascade — visits referencing materials whose purchases were deleted continue to display their locked-in costs correctly.
- `Material`, `Customer`, `Service`: soft archive (`is_archived = true`). Archived records are excluded from pickers but remain visible in historical purchases and visits. No archive UI for `Service` ships in v1; the column exists for schema symmetry and the request-scoped wrapper applies the same filter uniformly.

### 7.6 Opening stock

No special concept. Initial inventory is recorded as ordinary `Purchase` rows. Form helper text guides the user toward sensible estimates for partially-used containers (§6.5).

### 7.7 Per-material aggregate

A derived view, not persisted:

```
purchased = Σ purchase.total_quantity     -- for this material, this user
used      = Σ line_item.amount            -- across all visits, this user
remaining = purchased − used
```

`remaining` may be negative; this is not a bug. A negative value is a visual cue that a purchase has not been recorded yet.

### 7.8 Service price prefill

When the user picks a service in the add-visit form, `price_charged` is auto-filled with the service's `default_price`. The form maintains a session-local **dirty flag** on `price_charged`:

- Initial state: clean. Picking a service prefills the field and leaves it clean.
- User-initiated edits to `price_charged` set the flag to dirty.
- When the user changes the service selection while the flag is clean, `price_charged` re-prefills with the new service's default.
- When the user changes the service selection while the flag is dirty, `price_charged` is left as-is.

If the picked service has `default_price = NULL` (e.g., "Other" by default), no prefill occurs; the field remains empty for manual entry, and Save remains disabled until the user supplies a value (non-negative; see §9.2).

The dirty flag is UI state only; it is not persisted. It is not used on the edit-visit form — saved values are always preserved across edits there (see §7.4).

## 8. Views (v1)

### 8.1 Purchases — list

Grouped by category. Each row shows material name, container summary, date, price.

### 8.2 Visits — list

Chronological, most recent first, grouped by month (e.g., "MAY 2026", "APRIL 2026"). Each row shows date, customer, price charged, material cost. Net is not displayed in the row; it is implied by the side-by-side charged and cost figures. The service name is not displayed in the list (see §4).

### 8.3 Period totals

Period selector: presets only — _This week, Last week, This month, Last month_. Weeks are ISO 8601 (Monday–Sunday).

For the selected period, display:

- Visit count
- Total revenue (Σ price_charged)
- Total material cost (Σ line_item.total_cost across visits in period)
- Net (revenue − material cost)

No charts. Numbers only. No per-service or per-category breakdowns (see §4).

### 8.4 Customer detail

For a single customer:

- Header: name, optional comment, lifetime visit count, lifetime revenue, lifetime net.
- List of all that customer's visits with per-visit numbers.

### 8.5 Material detail

For a single material:

- Header: name, UoM, category.
- Aggregate panel: purchased, used, implied remaining (per §7.7).
- List of all purchases of this material with totals and dates.

### 8.6 Service price list

A minimal price-edit surface, accessed from Catalog. Displays the preseeded services in `display_order`. Each row shows the service name and a single editable `default_price` field. No add, no rename, no archive in v1.

The "Other" row's `default_price` is NULL by default and renders as `— set price` (read-only on the row; the actual prompt happens during visit entry). The user may set a numeric default for Other if she wants to; she may also clear any service back to NULL.

Editing a `default_price` here updates the seed for future visits only. Past visits' `price_charged` is unaffected (see §7.4).

## 9. Cross-cutting behavior

### 9.1 Currency, locale, timezone

v1 is single-currency. The UI is available in two locales (English, Russian) with CLDR plural rules so Russian's three plural forms render correctly. Dates are date-only fields throughout; date and number formatting use the platform's `Intl` APIs based on the active locale. Currency symbol is configuration, not user-managed.

### 9.2 Validation

Numeric inputs (quantities, prices) must be non-negative. The app does not enforce upper bounds.

- `price_charged` may be zero (a comp or freebie) but not negative.
- `VisitLineItem.amount` must be strictly greater than zero when the line item exists. Zero line items on a visit is valid (see §5.3).
- **Visit date:** any past date is allowed (back-dating); future dates are blocked.
- **Purchase date:** no date restriction.

### 9.3 Audit trail

`created_at` and `updated_at` are stored on all entities. No further audit log in v1.

### 9.4 Concurrency

Per-user, single-device assumption — each user uses one device at a time. No conflict resolution required.

## 10. Future considerations (not committed)

- Email/invoice OCR for automated purchase entry. This is the planned mitigation for strict-mode friction (§7.3).
- "What did I use on this customer last time?" view. Data model supports it; needs only a UI.
- Per-category cost roll-ups in period totals.
- Per-service reporting: revenue and visit counts by service, service-based filtering in views.
- Configurable service catalog: add, rename, and archive services beyond the preseeded 5.
- Native app.
- Public multi-user product (open signup, billing, multiple stylists per account).
- Custom date range picker.
- Charts.
- Configurable K value for cost-window size (currently hardcoded at 3).

---

_End of PRD v4.0_
