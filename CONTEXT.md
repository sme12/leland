# Leland

Leland is a single-operator business app for independent hair stylists. One **Stylist** runs their own practice: they keep a roster of **Customers**, perform **Visits** that consume **Materials** from stock, and replenish stock by recording **Purchases**. All data is per-stylist; there is no team or organisation concept.

## Language

### People

**Stylist**:
The independent hair professional who owns and operates the practice. The single tenant of all data.
_Avoid_: User (use only at the auth/Clerk layer), operator, account, salon.

**Customer**:
A person the **Stylist** serves. Belongs to exactly one **Stylist**.
_Avoid_: Client, buyer, patient.

### Stock

**Material**:
A distinct stockable item the **Stylist** consumes during work (a tube of colour, a bottle of developer, a pack of disposable gloves). A **Material** is a _type_, not a physical instance — quantities live on **Purchases** and **VisitLineItems**. Identity is `(name, category, unitOfMeasure)` per **Stylist**.
_Avoid_: Product, SKU, item, inventory item.

**Category**:
A fixed enum classifying a **Material**: `color`, `developer`, `bleach`, `shampoo`, `conditioner`, `treatment`, `styling`, `tools`, `disposables`, `other`.
_Avoid_: Type, kind, group.

**Unit of measure**:
A fixed enum on a **Material**: `ml` for liquids, `g` for solids/powders, `piece` for countable items. Fixed at creation; cannot change.
_Avoid_: Measure, unit, uom.

**Catalog**:
The full set of **Materials** belonging to one **Stylist**. Distinct from **Stock** — the **Catalog** is the list of types, **Stock** is the running quantity.
_Avoid_: Inventory, library.

**Stock** / **Remaining**:
Derived running quantity per **Material**: sum of **Purchase** `totalQuantity` minus sum of **VisitLineItem** `amount`. Can be negative — that means usage was recorded before the corresponding **Purchase** was entered (a known and accepted state).
_Avoid_: Inventory, on-hand.

### Stock acquisition

**Purchase**:
A single recorded stock-acquisition event for one **Material** on one date: `(material, totalQuantity, totalPrice, date)`. The unit of stock change. Multiple identical tubes from one receipt collapse into one **Purchase** (e.g. 6 × 60ml tubes → one row with `totalQuantity = 360`).
_Avoid_: Restock, acquisition, transaction, supply event.

**Receipt** (Finnish: _Kuitti_):
An external document — PDF, photo, email — attesting to one or more **Purchases**. **Not a persisted entity in Leland.** Treated as ephemeral input to the import flow; vendor, invoice number, totals, and VAT are intentionally discarded.
_Avoid_: Invoice, bill, document — and explicitly _do not_ model this as a Leland entity.

**Import**:
The act of turning a **Receipt**'s contents into one or more **Purchase** rows (creating new **Materials** inline when needed). Today: manual data entry. In v1 of MCP: agent-mediated and committed atomically via `commit_import`.
_Avoid_: Upload, sync, ingest.

### Work delivered

**Service**:
A kind of work the **Stylist** offers (e.g. "Cut & colour"). Has a default price; a **Visit** can charge a different price.
_Avoid_: Treatment, procedure, appointment.

**Visit**:
A customer-facing event: one **Customer**, one **Service**, one date, a price charged, plus the **Materials** consumed during it (via **VisitLineItems**).
_Avoid_: Appointment, booking, session, event.

**Visit Draft**:
A provisional estimate for a same-day or future **Visit** that is not yet work delivered.
_Avoid_: Appointment, booking, tentative visit.

**Material Estimate**:
An estimated amount of one **Material** for one **Visit Draft**, even if that **Material** has not yet been purchased.
_Avoid_: VisitLineItem, usage, consumption, line.

**Estimated Price**:
The amount the **Stylist** expects to charge for a **Visit Draft**.
_Avoid_: Price charged, revenue, payment.

**Publish**:
The act of turning the current contents of a **Visit Draft** into a **Visit**.
_Avoid_: Save, complete, finalize.

**Discard**:
The act of removing a **Visit Draft** without creating a **Visit**.
_Avoid_: Delete, cancel, archive.

**VisitLineItem**:
The use of an `amount` of one **Material** during one **Visit**. Carries a `unitCost` derived at the time the line is locked, plus the resulting `totalCost`. Cost values, once locked, are not retroactively recomputed.
_Avoid_: Usage, consumption, line, charge.

## Relationships

- A **Stylist** owns many **Customers**, **Materials**, **Services**, **Purchases**, **Visits**. Nothing is shared across stylists.
- A **Material** has many **Purchases** (stock in) and many **VisitLineItems** (stock out).
- A **Customer** has many **Visits**. A **Visit** belongs to exactly one **Customer** and exactly one **Service**.
- A **Visit** has many **VisitLineItems**. Each **VisitLineItem** references exactly one **Material**.
- A **Customer** has many **Visit Drafts**. A **Visit Draft** belongs to exactly one **Customer** and exactly one **Service**.
- A **Visit Draft** remains a draft until published, at which point it becomes a **Visit**, affects **Stock**, and its **Estimated Price** is converted to a charged price.
- When a **Visit Draft** becomes a **Visit**, its **Material Estimates** become **VisitLineItems** with costs locked at that moment.
- A **Visit Draft** has many **Material Estimates**. Each **Material Estimate** references exactly one **Material**.
- A **Receipt** is _not_ a Leland entity; an **Import** translates it into many **Purchases** (and possibly some new **Materials**).

## Example dialogue

> **Dev:** "When the stylist uploads a Kuitti with five different products, do we create one Purchase or five?"
> **Domain expert:** "Five — one **Purchase** per distinct **Material**. The Kuitti itself we don't store. If they bought six tubes of the same colour, that's still one **Purchase** with `totalQuantity = 6 × tube size`."
>
> **Dev:** "And if the same colour appears on a receipt I imported last week?"
> **Domain expert:** "Then it should match the existing **Material** in the **Catalog**, not create a new one. We never want two **Materials** with the same `(name, category, unit)`."
>
> **Dev:** "If the stylist plans next week's colouring visit and wants to estimate materials, is that a **Visit**?"
> **Domain expert:** "No — it is a **Visit Draft** with **Material Estimates**. It only becomes a **Visit** when it is published, and only then do we create **VisitLineItems** and change **Stock**."

## Flagged ambiguities

- **"User"** was overloaded between the Clerk-authenticated identity and the domain operator. Resolved: at the **domain** layer, the operator is **Stylist**. The string `userId` survives in code only as a foreign key — it identifies a Clerk subject, which always maps 1:1 to a **Stylist**.
- **"Invoice"** vs **"Receipt"** vs **"Bill"** — colloquially mixed. Resolved: use **Receipt** (matches the Finnish _Kuitti_ on the source documents). **Receipt** is _never_ persisted.
- **"Inventory"** was tempting for both **Catalog** and **Stock**. Resolved: they're different concepts — **Catalog** is the list of material _types_, **Stock** is the running quantity. Don't say "inventory" for either.
- **"Draft visit"** sounded like a subtype of **Visit**. Resolved: use **Visit Draft** for the provisional estimate; it is not a **Visit** until published.
- **"Publish"** and **"Save"** were easy to conflate. Resolved: **Publish** uses the current **Visit Draft** contents and does not require a separate **Save**.
