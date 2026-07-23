# PHASE_3_SALESFORCE.md — retrospective

**Status: complete**, and later **substantially refactored**. Current status:
[`docs/DEVELOPER_GUIDE.md`](../../DEVELOPER_GUIDE.md) (data flows + full org
inventory) and [`docs/SALESFORCE_CONVENTIONS.md`](../../SALESFORCE_CONVENTIONS.md)
(the rule this phase's refactor produced).

## What was originally scoped
Replace the BFF's mock data with real Salesforce records: products from
Salesforce, checkout creating real `Order` records. Decisions to be made with
the owner: `Product2`/`Pricebook2` vs. a custom `Coffee__c` object for
products (recommended `Product2` for realism), and standard `Order`/
`OrderItem` vs. custom for orders (recommended standard). Add fields to match
the product spec (origin, roast, tasting notes, image, stock). Connected App
with OAuth.

## What actually shipped
The recommended path was taken: **standard `Product2`/`Pricebook2` and
standard `Order`/`OrderItem`**, connected via OAuth 2.0 **Client Credentials**
flow (server-to-server, no interactive user — see
[`docs/ARCHITECTURE.md` §5](../../ARCHITECTURE.md)) against the org's My
Domain host.

## What changed significantly from the original plan
The original Phase 3 scope stopped at "connect Salesforce and make it work."
What actually happened mid-project was a **deliberate, documented refactor**
toward standard fields, triggered by a real bug: the merchant was editing the
standard `Order.Status` field in Salesforce expecting it to drive fulfillment,
but the app was reading a custom `Fulfillment_Status__c` field instead — so
merchant changes were silently ignored.

That bug produced a lasting rule (recorded in
[`docs/SALESFORCE_CONVENTIONS.md`](../../SALESFORCE_CONVENTIONS.md)): **prefer
standard objects/fields; add a custom field only when no standard equivalent
exists, and record why.** Under that rule:
- `Order.Status` (extended with `Shipped`/`Cancelled` picklist values) became
  the single source of truth for the order lifecycle, replacing three custom
  fields (`Cancelled__c`, `Payment_Status__c`, `Fulfillment_Status__c`).
- `Order.TotalAmount` (a standard rollup) replaced a custom `Total_Cents__c`.
- What's left custom is a short, justified list — `Shopper__c` (no standard
  `BillToContactId` on this org's Order), `Guest_Email__c`,
  `Discount_Cents__c`, `Promo_Code__c`, `Shipping_Cents__c`,
  `Payment_Intent__c`, `Tracking_Number__c`, and later
  `Account.Company_Domain__c` for B2B — each with no standard equivalent,
  each documented.

A second thing this phase didn't anticipate: **Salesforce locks activated
orders.** Moving an order out of `Activated` (e.g. to `Cancelled`) needs the
"Edit Activated Orders" permission and a specific `StatusCode` grouping choice
— undocumented in the original plan, discovered the hard way, now recorded as
a gotcha in `SALESFORCE_CONVENTIONS.md` so it isn't rediscovered.

## What wasn't in the original plan at all
The B2B company-account model (`Account` as company, `Contact.AccountId`,
domain-based team matching) — this phase's object model turned out to be
exactly what B2B needed later, with only one new field
(`Account.Company_Domain__c`) required to support it.
