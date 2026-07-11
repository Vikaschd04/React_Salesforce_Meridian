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
| Guest-order account | standard **`Account`** ("Meridian Web Orders") via `Order.AccountId` |
| Shoppers (login/signup) | standard **`Contact`** |
| Support requests | standard **`Case`** (`Origin`, `Subject`, `Description`, `Supplied*`) |

The order display status the UI shows is derived **only** from standard
`Order.Status` in [`server/src/sf/mappers.js`](../server/src/sf/mappers.js)
(`orderStatus()`): Draft→pending, Activated→paid, Shipped→shipped,
Completed→delivered, Cancelled→cancelled.

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
| `Contact.Password_Hash__c` (Text) | No standard password store (by design — bcrypt hash only). |
| `Product2.*` (Origin, Roast, Tasting_Notes, …) | Coffee attributes with no standard analog. |

## Deprecated (migrated to standard — left in the org for old data, unused by the app)
`Order.Total_Cents__c` → `TotalAmount`; `Order.Cancelled__c` /
`Order.Payment_Status__c` / `Order.Fulfillment_Status__c` → `Status`;
`Order.Shipped_Date__c` → dropped (no standard ship date; status + `ActivatedDate`
suffice). These are no longer read or written; they can be deleted from the org
once historical orders no longer need them.
