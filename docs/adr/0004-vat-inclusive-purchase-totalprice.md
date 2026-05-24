# VAT-inclusive `Purchase.totalPrice`

Leland's existing schema stores `Purchase.totalPrice` and `Visit.priceCharged` as opaque `Decimal(10, 2)` values; there is no VAT logic anywhere in the codebase and the **Purchase** form labels the field simply "Total price". Until now, whatever the **Stylist** types is what gets stored, with no enforced convention. The MCP-driven **Receipt** import flow can no longer keep the convention implicit: Finnish _Kuitti_ receipts show VAT-exclusive line totals (_Veroton arvo_) plus a separate VAT summary (typically 25.5%), so the agent must commit to one number per **Material** line. VAT-exclusive would have matched the **Receipt**'s line columns and been rounding-stable; we picked VAT-inclusive instead.

**Decision:** `Purchase.totalPrice` is the **VAT-inclusive** share of the **Receipt**'s grand total (_Lasku Yhteensä_) attributable to that **Material** line. When a **Receipt** prints VAT-exclusive line totals, the agent computes per-line gross as `round(line_net_after_discount × (1 + vat_rate), 2)`, applying each line's own rate when the **Receipt** mixes rates. Per-line rounding drift versus _Lasku Yhteensä_ is accepted and never reconciled server-side.

**Why:**
- Symmetric with `Visit.priceCharged`, which is VAT-inclusive by Finnish retail convention. A future cost/revenue report stays comparable line-for-line; net-cost-vs-gross-revenue would silently inflate margin.
- Matches the cash-out number on the **Stylist**'s bank statement and the bottom of the **Receipt** — the figure they actually recognise and likely already type into the **Purchase** form today.
- Robust to the **Stylist**'s VAT-registration status. Small operators below the Finnish threshold cannot reclaim VAT on inputs, so gross **is** their real cost basis. For VAT-registered **Stylists**, the gross-vs-net difference is recoverable by back-computing from a known rate.
- Codifies the convention that was implicit in the UI rather than introducing a new one.

**Consequences worth flagging:**
- Reporting that needs net-of-VAT numbers (e.g. VAT-deductible cost basis for registered **Stylists**) must back-compute from a per-**Stylist** VAT rate, which Leland doesn't store. Out of scope until a **Stylist** asks for it.
- `sum(Purchase.totalPrice)` for one **Receipt** may differ from the printed _Lasku Yhteensä_ by a few cents because of per-line rounding. The drift is operationally harmless but will look weird to anyone reconciling by eye; the agent's confirmation summary should mention it the first time it appears.
- **Purchases** created before this ADR were entered under no enforced convention — some **Stylists** may have used net, some gross. Historical aggregates mixing pre- and post-ADR **Purchases** may be subtly off. We do not attempt automated detection or migration.
