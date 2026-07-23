# Salesforce conventions — prefer standard objects & fields

**Rule for all current and future work:** use the **standard Salesforce objects
and fields** Salesforce already provides. Create a **custom field/object only
when there is no standard equivalent** on the org — and when you do, record *why*
in this file.

This keeps the app aligned with how an admin actually runs the org (they edit the
**standard** fields — e.g. an order's `Status`), avoids schema sprawl, and makes
the data portable to other Salesforce tooling (reports, flows, list views).

## Before adding any custom field — checklist
1. **Is there a standard field for this?** Check `sobject.describe()` (or Setup →
   Object Manager). Order alone has `Status`, `TotalAmount`, `ActivatedDate`,
   `EffectiveDate`, `Shipping*`, `AccountId`, etc.
2. **Can a standard picklist be *extended* instead?** Adding values to a standard
   picklist (e.g. `OrderStatus`) is standard admin practice — it is **not** a
   custom field. We add `Shipped` / `Cancelled` to `Order.Status` this way.
3. **Only if neither applies**, add a custom field — minimal, well-named — and
   add a row to "Custom fields we keep" below with the justification.

## What we map to STANDARD today
| Concept | Standard field/object used |
|---|---|
| Product catalog | `Product2` + `Pricebook2` / `PricebookEntry` (standard price) |
| Order + line items | `Order` + `OrderItem` |
| Order lifecycle / status | **`Order.Status`** — Draft(=Placed) → Activated(=paid) → **Shipped** → Completed(=delivered), or **Cancelled**. New orders insert `Draft`, then the app activates them after payment; the merchant advances the rest **by changing `Status` in Salesforce**. |
| Merchandise subtotal | **`Order.TotalAmount`** (currency rollup of the line items — read-only) |
| Order date / activation | **`Order.EffectiveDate`** / **`Order.ActivatedDate`** |
| Shipping address | standard **`Order.Shipping*`** fields (+ `ShippingStateCode` / `ShippingCountryCode` because State & Country picklists are enabled) |
| Guest/individual-order account | standard **`Account`** ("Meridian Web Orders") via `Order.AccountId` |
| Company accounts (B2B team buying) | standard **`Account`** (one per business) + standard **`Contact.AccountId`** (an employee's employer) + standard **`Order.AccountId`** (a company-linked order lands on its own Account instead of the shared default — this is what makes the order "shared team history" instead of custom-built visibility rules) |
| Shoppers (login/signup) | standard **`Contact`** |
| Support requests | standard **`Case`** (`Origin`, `Subject`, `Description`, `Supplied*`) |

The order display status the UI shows is derived **only** from standard
`Order.Status` in [`server/src/sf/mappers.js`](../server/src/sf/mappers.js)
(`orderStatus()`): Draft→pending, Activated→paid, Shipped→shipped,
Completed→delivered, Cancelled→cancelled.

### Gotcha: activated orders are locked, and `Canceled` StatusCode is reserved
Two Salesforce behaviours bite when moving an order out of `Activated`. Both are
handled by `sf:setup` — don't undo them:
1. **Activated orders are locked.** Editing one requires the **Edit Activated
   Orders** user permission, which itself depends on **Activate Order** plus
   Read/Edit object permissions on Order. All are granted together on the
   `Meridian_Web_Integration` permission set (Salesforce rejects the deploy if
   any dependency is missing).
2. **Never map a Status value to the `Canceled` StatusCode.** That category is
   reserved for order amendments / reduction orders and can't be set by an
   ordinary update — it fails with `ENTITY_IS_LOCKED` *even on a Draft order*.
   Our `Cancelled` value is grouped under **`Draft`**, which makes cancelling a
   normal deactivation. Nothing in the app reads `StatusCode`, so this is
   invisible outside Salesforce.

Advancing `Activated → Shipped → Completed` needs neither, since those values
all sit inside the same `Activated` category.

## Custom fields we keep (no standard equivalent on this org)
Each is justified; all are created/granted by `npm run sf:setup`.
| Custom field | Why no standard field |
|---|---|
| `Order.Shopper__c` (Lookup→Contact) | `BillToContactId` / `ShipToContactId` are **not exposed** on this org's Order. |
| `Order.Guest_Email__c` (Email) | Base Order has no customer-email field. |
| `Order.Discount_Cents__c` (Number) | No standard order-level discount amount. |
| `Order.Promo_Code__c` (Text) | No standard promo/coupon field. |
| `Order.Shipping_Cents__c` (Number) | No standard shipping-cost field on base Order. |
| `Order.Payment_Intent__c` (Text) | No standard payment reference on base Order (payments live in separate managed packages/OMS). |
| `Order.Tracking_Number__c` (Text) | No standard tracking-number field on base Order. |
| `Account.Company_Domain__c` (Text) | The join key for B2B team buying — no standard field represents a normalized work-email domain used to auto-match teammates to their company's Account. First signer from a domain creates the Account; later signups with the same domain join it. |
| `Contact.Password_Hash__c` (Text) | No standard password store (by design — bcrypt hash only). |
| `Product2.*` (Origin, Roast, Tasting_Notes, …) | Coffee attributes with no standard analog. |

## Custom objects we keep (no standard equivalent on this org)
The checklist above is field-first ("is there a standard *field*?") — the
same question applies one level up before adding a whole custom *object*:
is there a standard object for this concept at all? For everything else in
this app the answer was yes (`Product2`, `Order`, `Account`, `Contact`,
`Case`). Product reviews are the first exception.

| Custom object | Why no standard object |
|---|---|
| `Meridian_Product_Review__c` | Star ratings + written reviews on a product are a Commerce Cloud B2C concept — this org is Sales Cloud, which has no standard review/rating object. Fields: `Product__c` (Lookup→Product2), `Contact__c` (Lookup→Contact), `Rating__c` (Number 1–5), `Title__c` (Text), `Body__c` (Long Text Area), `Reviewer_Name__c` (Text, a display-name snapshot). One review per (shopper, product) pair, enforced by the app, not a validation rule. Created/granted by `npm run sf:setup`. |
| `Meridian_Wishlist_Item__c` | A shopper's saved products — a B2C wishlist, with no standard object on Sales Cloud. A junction: `Contact__c` (Lookup→Contact) + `Product__c` (Lookup→Product2), one row per saved (shopper, product) pair. Created/granted by `npm run sf:setup`. Its permission grant is read/**create/edit/delete** (rows are added and removed) — note Salesforce requires `allowEdit` whenever `allowDelete` is granted, even though the app never edits a row. |
| `Meridian_Address__c` | A shopper's saved shipping addresses. **The standard `ContactPointAddress` object exists and is writable on this org** and has the right fields — but its `ParentId` only accepts `Account` or `Individual`, **not `Contact`** (verified: a real insert with a Contact parent fails `FIELD_INTEGRITY_EXCEPTION`). Meridian's shoppers are Contacts, so using it would require dragging in the whole `Individual` object layer — disproportionate. So a custom object keyed to `Contact__c`, mirroring the app's shipping shape (`Label__c`, `Recipient_Name__c`, `Street__c`, `City__c`, `State_Code__c`, `Postal_Code__c`, `Country_Code__c` as ISO-code text validated by the app, `Is_Default__c`). One default per shopper, enforced by the app. Full CRUD grant. |

> **Naming note:** this org already has an unrelated, pre-existing custom
> object literally named `Product_Review__c` (no `Contact__c`, uses
> `Reviewer_Email__c` instead, plus an `Is_Approved__c` moderation flag —
> someone else's setup, not part of this app). `sf:setup`'s existence probe
> matched that name and correctly refused to touch it (the follow-up
> permission grant failed safely, atomically, with zero changes to the org).
> Meridian's object is named `Meridian_Product_Review__c` — matching the
> `Meridian_Web_Integration` permission-set naming convention — specifically
> to avoid this collision. Don't rename it back to the shorter form.

## Deprecated (migrated to standard — left in the org for old data, unused by the app)
`Order.Total_Cents__c` → `TotalAmount`; `Order.Cancelled__c` /
`Order.Payment_Status__c` / `Order.Fulfillment_Status__c` → `Status`;
`Order.Shipped_Date__c` → dropped (no standard ship date; status + `ActivatedDate`
suffice). These are no longer read or written; they can be deleted from the org
once historical orders no longer need them.
