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
| Money everywhere | **USD dollars** (a decimal Number), never cents — Salesforce currency fields are already dollars (`TotalAmount`, `Discount__c`, `Shipping_Amount__c`), and the app matches them end-to-end. `round2()` snaps to whole cents at each boundary; the only place cents appear is the Stripe API call (`amount = round(usd * 100)`). |
| Order date / activation | **`Order.EffectiveDate`** / **`Order.ActivatedDate`** |
| Shipping address | standard **`Order.Shipping*`** fields (+ `ShippingStateCode` / `ShippingCountryCode` because State & Country picklists are enabled) |
| Saved addresses (account) | standard **`ContactPointAddress`** parented to the shopper's **Person Account** (`ParentId`). label→`Name`, recipient→`AddressFirstName`/`AddressLastName`, `Street`/`City`/`StateCode`/`PostalCode`/`CountryCode`, `IsDefault`↔`IsPrimary`, `AddressType='Shipping'`. One default per shopper (app-enforced). Now possible because shoppers are Person Accounts — CPA rejects a bare Contact parent, which is why this used to be custom. |
| Wishlist (saved products) | standard **`Wishlist`** + **`WishlistItem`** — one `Wishlist` per shopper (parented to their Person Account + a `WebStore`, which the standard object requires), saved products are `WishlistItem` rows (`Product2Id`). Replaces the old custom junction object. |
| Registered shopper (login/signup) | standard **Person Account** (B2C) — one record that is both `Account` (Name + `PersonEmail`) and its backing `Contact` (`PersonContactId`). Created via `Account` insert with the `PersonAccount` record type; the app's identity is the backing Contact (holds `Password_Hash__c`; login is by `Contact.Email`). |
| Order account + shopper link | standard **`Account`** via **`Order.AccountId`** — a **registered** shopper's order lands on **their own Person Account**, which IS the shopper↔order link (order history queries `WHERE AccountId = personAccount`, real-time CDC resolves the owner via `Account.PersonContactId`). A **guest** order lands on the shared "Meridian Web Orders" catch-all Account (excluded from personal history; tracked by `Guest_Email__c`). No custom `Shopper__c` field. |
| Support requests + tracking | standard **`Case`** (`Origin`, `Subject`, `Description`, `Supplied*`, `Status`, `ContactId` for logged-in shoppers) + standard **`CaseComment`** for the customer-visible reply thread (only `IsPublished = true` comments are shown — internal notes never leak). No custom schema. |
| Promotions / coupons | standard Commerce objects — **`Coupon`** (code, `Status`, `StartDateTime`/`EndDateTime` for validity/expiry, `RedemptionLimit*` for usage limits) → **`Promotion`** (`IsActive`, `StartDate`/`EndDate`) → **`PromotionTarget`** (the discount: `PercentageDiscount` / `FixedAmountOff…` / `TargetType=Shipping`) + **`PromotionQualifier`** (`MinimumAmount` = min-subtotal); usage tracked via **`CouponCodeRedemption`**. A merchant creates/governs coupons in Salesforce; the app reads + applies them (the discount is still computed server-side against trusted prices). **Replaces** the old hardcoded BFF table — a standard-first win with no custom schema. `npm run sf:setup` seeds the demo codes. |

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
| `Order.Guest_Email__c` (Email) | Base Order has no customer-email field. |
| `Order.Discount__c` (Currency, **USD dollars**) | No standard order-level discount amount. |
| `Order.Promo_Code__c` (Text) | No standard promo/coupon field. |
| `Order.Shipping_Amount__c` (Currency, **USD dollars**) | No standard shipping-cost field on base Order. |
| `Order.Payment_Intent__c` (Text) | No standard payment reference on base Order (payments live in separate managed packages/OMS). |
| `Order.Tracking_Number__c` (Text) | No standard tracking-number field on base Order. |
| `Contact.Password_Hash__c` (Text) | No standard password store (by design — bcrypt hash only). |
| `Product2.*` (Origin, Roast, Tasting_Notes, …) | Coffee attributes with no standard analog. |

> The shopper↔order link no longer needs a custom field: it's the standard
> **`Order.AccountId`** (a registered shopper's own Person Account). `BillToContactId`
> is still not exposed on this org's Order — but with Person Accounts, `AccountId`
> carries the link, so the old `Order.Shopper__c` was dropped.
>
> Money is **USD dollars** on these fields (`Order.Discount__c`, `Order.Shipping_Amount__c`
> are Currency), matching the standard `TotalAmount`. The old integer-cents fields
> (`Discount_Cents__c` / `Shipping_Cents__c`) are deprecated — see below.

## Custom objects we keep (no standard equivalent on this org)
The checklist above is field-first ("is there a standard *field*?") — the
same question applies one level up before adding a whole custom *object*:
is there a standard object for this concept at all? For everything else in
this app the answer was yes (`Product2`, `Order`, `Account`, `Contact`,
`Case`). Product reviews are the first exception.

| Custom object | Why no standard object |
|---|---|
| `Meridian_Product_Review__c` | Star ratings + written reviews on a product are a Commerce Cloud B2C concept — this org is Sales Cloud, which has no standard review/rating object (probed: no `ProductReview`). Fields: `Product__c` (Lookup→Product2), `Contact__c` (Lookup→Contact), `Rating__c` (Number 1–5), `Title__c` (Text), `Body__c` (Long Text Area), `Reviewer_Name__c` (Text, a display-name snapshot). One review per (shopper, product) pair, enforced by the app, not a validation rule. Created/granted by `npm run sf:setup`. |

> **Wishlist and saved addresses used to be custom objects here** —
> `Meridian_Wishlist_Item__c` and `Meridian_Address__c`. They are now the
> **standard `Wishlist`/`WishlistItem` and `ContactPointAddress`** objects (see the
> "map to STANDARD" table above). `ContactPointAddress` became viable once shoppers
> were modelled as **Person Accounts** — it parents to an Account, so the old
> "ParentId won't accept a Contact" blocker no longer applies. The custom objects
> are deprecated (see below).

> **Naming note:** this org already has an unrelated, pre-existing custom
> object literally named `Product_Review__c` (no `Contact__c`, uses
> `Reviewer_Email__c` instead, plus an `Is_Approved__c` moderation flag —
> someone else's setup, not part of this app). `sf:setup`'s existence probe
> matched that name and correctly refused to touch it (the follow-up
> permission grant failed safely, atomically, with zero changes to the org).
> Meridian's object is named `Meridian_Product_Review__c` — matching the
> `Meridian_Web_Integration` permission-set naming convention — specifically
> to avoid this collision. Don't rename it back to the shorter form.

## Standard platform capabilities we enable (not custom schema)
Some features lean on standard Salesforce *platform* capabilities rather than
new objects/fields. These are enabled via the Metadata API by `npm run sf:setup`,
consistent with the standard-first rule (no custom schema where a platform
feature already does the job).
| Capability | What / why |
|---|---|
| **Order Change Data Capture** | Real-time order tracking. `Order` is added to the standard `ChangeEvents` channel via a `PlatformEventChannelMember` metadata deploy, so the BFF can subscribe to `/data/OrderChangeEvent` (Streaming API) and push a merchant's status change to the shopper's order page live. PushTopic was **not** an option — it rejects the `Order` object ("'Order' is not supported"); CDC is the modern, supported path. Idempotent + non-fatal in `sf:setup`; if disabled the order page falls back to focus-refresh. |

## Deprecated (migrated to standard — left in the org for old data, unused by the app)
`Order.Total_Cents__c` → `TotalAmount`; `Order.Cancelled__c` /
`Order.Payment_Status__c` / `Order.Fulfillment_Status__c` → `Status`;
`Order.Shipped_Date__c` → dropped (no standard ship date; status + `ActivatedDate`
suffice).

**Standard-first cleanup (2026-07):**
- `Order.Shopper__c` → standard **`Order.AccountId`** (registered shopper's Person Account).
- `Order.Discount_Cents__c` → **`Order.Discount__c`** (Currency, USD dollars).
- `Order.Shipping_Cents__c` → **`Order.Shipping_Amount__c`** (Currency, USD dollars).
- `Meridian_Wishlist_Item__c` → standard **`Wishlist`/`WishlistItem`**.
- `Meridian_Address__c` → standard **`ContactPointAddress`**.

All of the above are **no longer read or written** by the app — safe to delete
from the org in Setup whenever historical rows are no longer needed (`sf:setup`
neither creates nor touches them anymore).

## Removed
`Account.Company_Domain__c` (and the whole B2B "company account / shared team
order history" feature) was **removed** — the app is now B2C only (one login =
one individual `Contact`, order history by the shopper's own Person Account via
`Order.AccountId`). The custom field
was deleted from the org by the removal. Any company `Account`s created during
the B2B phase are harmless leftovers (personal order history doesn't depend on
them). A shared-account feature may return later as a properly-governed one.
