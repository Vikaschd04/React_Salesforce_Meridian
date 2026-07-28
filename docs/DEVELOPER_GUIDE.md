# Meridian — Developer & Salesforce Guide

A reference for how the Meridian runtime flows (products, orders, accounts)
work, and **exactly what was created in Salesforce** so you can find,
change, or recreate it.

> For a file-by-file map of the whole codebase (every frontend/backend file,
> theming, discovery/search, promos, payments, SEO, testing/CI, git workflow),
> see [ARCHITECTURE.md](ARCHITECTURE.md) — read that one first if you're new
> here. This guide goes deep on the Salesforce side specifically. If you're
> asking "what is Express / a BFF / jsforce" rather than "what does this
> feature do," see [TECH_STACK_GUIDE.md](TECH_STACK_GUIDE.md) instead.

Last updated to match the current `main` branch.

---

## 1. What Meridian is

A single-origin coffee storefront built in three tiers:

```
Browser  ──►  React SPA (Vite)                     src/
                │  same-origin  /api  (JSON, httpOnly session cookie)
                ▼
              Node BFF (Express + jsforce)          server/
                │  HTTPS + OAuth 2.0 (Client Credentials)
                ▼
              Salesforce (system of record)         products, orders, shoppers
```

Key principle — **one swap point**: the React app only ever calls
[`src/api/store.js`](../src/api/store.js). It never talks to Salesforce or holds
secrets. Behind it, the BFF can run on **mock data** or **live Salesforce**,
toggled by one env var (`DATA_SOURCE`).

---

## 2. Repo layout

Full file-by-file breakdown: [ARCHITECTURE.md §2–3](ARCHITECTURE.md). Quick
orientation:

```
/                     React app (Vite root) — src/api/store.js is the ONLY
                      data-access module the UI uses
/server               Node BFF
  src/routes/         thin HTTP layer — products, orders, auth, account, …
  src/store/          mock ⇄ Salesforce switch (branches on DATA_SOURCE)
  src/sf/             Salesforce layer — the only files with field names (§5)
/docs                 every doc lives here — this guide, ARCHITECTURE.md,
                      SALESFORCE_CONVENTIONS.md, SALESFORCE_SETUP.md,
                      DEPLOYMENT.md, meridian-plan/ (project history)
```

---

## 3. Running it locally

```bash
# 1. Front end deps
npm install
# 2. BFF deps
cd server && npm install && cp .env.example .env   # then fill in .env
cd ..
# 3. Run both together (web :5173, BFF :8787)
npm run dev:all
```

The Vite dev server proxies `/api` → `http://localhost:8787` (see
[`vite.config.js`](../vite.config.js)), so the browser only ever talks to its
own origin.

**Server scripts** (run inside `server/`):

| Script            | What it does                                                       |
|-------------------|-------------------------------------------------------------------|
| `npm run dev`     | Start the BFF with auto-reload                                     |
| `npm run seed`    | Create/update the 16 `Product2` records + standard prices in SF   |
| `npm run sf:setup`| Create Order custom fields + Product Review object, grant standard-object access (Wishlist/ContactPointAddress/…) via the permission set, assign to the user |
| `npm run sf:check`| Read-only readiness check (auth, fields, account, products)       |

---

## 4. Configuration (`server/.env`)

`.env` is **git-ignored** — secrets never get committed. `.env.example`
documents every key.

| Variable            | Purpose                                                             |
|---------------------|---------------------------------------------------------------------|
| `DATA_SOURCE`       | `mock` (in-repo catalog) or `salesforce` (live org)                 |
| `PORT`              | BFF port (default 8787)                                             |
| `APP_ORIGIN`        | CORS origin (dev: `http://localhost:5173`)                          |
| `CACHE_TTL_SECONDS` | Product read cache TTL                                              |
| `SF_LOGIN_URL`      | **Your My Domain URL** (see §11) — e.g. `https://…my.salesforce.com`|
| `SF_CLIENT_ID`      | Connected App consumer key                                          |
| `SF_CLIENT_SECRET`  | Connected App consumer secret                                       |
| `SF_API_VERSION`    | REST/SOQL API version (e.g. `61.0`)                                 |
| `SF_ACCOUNT_NAME`   | Account that web orders attach to (`Meridian Web Orders`)           |
| `SESSION_SECRET`    | Secret that signs the shopper session JWT                          |
| `SESSION_TTL_DAYS`  | Session lifetime (default 30)                                       |
| `COOKIE_SECURE`     | `true` only over HTTPS (production)                                 |

---

## 5. How the BFF talks to Salesforce

**OAuth 2.0 Client Credentials flow** — a server-to-server login with no
interactive user. Implemented in [`server/src/sf/client.js`](../server/src/sf/client.js):

1. `POST {SF_LOGIN_URL}/services/oauth2/token` with
   `grant_type=client_credentials` + consumer key/secret.
2. Salesforce returns `{ access_token, instance_url }`, run **as** the Connected
   App's assigned integration user.
3. A `jsforce.Connection` is built from those and **cached** in memory.
4. `withConn(fn)` runs a call; if it fails with `INVALID_SESSION_ID`, it
   re-authenticates once and retries — so an expired token self-heals.

The `sf/` folder is the only place that knows Salesforce field names:

| File                | Responsibility                                                     |
|---------------------|--------------------------------------------------------------------|
| `sf/client.js`      | Auth, cached connection, retry                                     |
| `sf/mappers.js`     | Salesforce record ⇄ app shape; USD dollars (no unit conversion); field API names |
| `sf/catalog.js`     | Product SOQL queries                                               |
| `sf/orders.js`      | Create Order + OrderItems (Composite API); read/list orders        |
| `sf/contacts.js`    | Shopper Contact create/find, password hashing                      |
| `sf/seed.js`        | Populate products + prices                                         |
| `sf/wishlist.js`    | Standard `Wishlist`/`WishlistItem` CRUD                            |
| `sf/addresses.js`   | Standard `ContactPointAddress` CRUD                                |
| `sf/orderSummary.js`| Order Management — builds an `OrderSummary` per order (OMS objects)|
| `sf/setup-schema.js`| Create Order custom fields + Review object + permission set        |
| `sf/check.js`       | Readiness diagnostic                                               |

`store/catalog.js`, `store/orders.js`, `store/auth.js` each pick mock vs
Salesforce based on `DATA_SOURCE`; the route layer never changes.

---

## 6. Product catalog flow

1. UI calls `getProducts()` / `getProduct(id)` in `store.js` → `GET /api/products[/:id]`.
2. `routes/products.js` → `store/catalog.js` → (salesforce) `sf/catalog.js`.
3. SOQL selects active `Product2` records **plus** their standard-pricebook
   price via a subquery:
   ```sql
   SELECT ...fields..., (SELECT Id, UnitPrice FROM PricebookEntries
     WHERE Pricebook2.IsStandard = true AND IsActive = true LIMIT 1)
   FROM Product2
   WHERE IsActive = true AND Origin__c != null AND Roast__c != null
   ```
   The `Origin__c != null AND Roast__c != null` filter **scopes the query to
   Meridian coffees only**, so the org's pre-existing B2B Commerce products
   don't leak into the storefront.
4. `sf/mappers.js` converts each record to the app shape: `ProductCode` → `id`,
   `UnitPrice` → `price` (USD dollars, no conversion), `Tasting_Notes__c` split on `;`.
5. Product reads pass through a short in-memory TTL cache (Salesforce API limits).

`ProductCode` **is** the app's product id/slug (e.g. `yirgacheffe-koke`), which
keeps image URLs and links stable across environments.

---

## 7. Order creation flow (step by step)

Trigger: shopper clicks **Checkout** with a cart of `[{ id, qty }]`.

1. **UI** → `store.placeOrder(items)` → `POST /api/orders` (the session cookie
   rides along via `credentials: 'include'`).
2. **`routes/orders.js`** runs `optionalAuth` (decodes the session cookie into
   `req.user`, or null for a guest), validates the body with a strict `zod`
   schema (rejects empty carts, unknown fields, any client-supplied price).
3. **`store/orders.js`** → `sf/orders.createOrder(items, { contactId })`.
4. **`sf/orders.js`**:
   - Looks up each line's `Product2` + standard `PricebookEntry` **by ProductCode**.
   - **Recomputes the total server-side** from trusted pricebook prices — the
     client's prices are never trusted.
   - Resolves and caches two ids: the `Meridian Web Orders` **Account** and the
     **Standard Pricebook** (`getRefs()`).
   - Builds **one Composite API request** (`allOrNone: true`) that creates:
     - an **`Order`**: `AccountId` (the shopper's own Person Account if logged in,
       else the shared account — this carries the shopper link, no custom field),
       `Pricebook2Id`, `EffectiveDate` (today), `Status = 'Draft'`,
       `Discount__c` / `Shipping_Amount__c` (Currency, USD dollars).
     - one **`OrderItem`** per line, referencing the new order via
       `@{newOrder.id}`, with `Product2Id`, `PricebookEntryId`, `Quantity`,
       `UnitPrice`.
   - Reads the created order back and maps it: `orderId` = the Salesforce
     **`OrderNumber`** (e.g. `00000699`).
5. **UI** navigates to `/confirmation/:orderId`; the confirmation page can
   re-fetch it via `GET /api/orders/:id`.

Money is **USD dollars** (a decimal Number) everywhere — the app and Salesforce
match, so there's no unit conversion at the `sf/mappers.js` boundary. `round2()`
(in `server/src/lib/totals.js` and `src/lib/money.js`) snaps to whole cents at
each money boundary; the only place cents appear is the Stripe API call
(`amount = round(usd * 100)` in `pay/index.js`). The charged **grand total** is
`subtotal − discount + shipping + tax` (§9j) — computed server-side and shown
identically at checkout and on every order view via `orderPaidUsd`.

---

## 8. Shopper accounts (signup / login)

Shoppers are **Salesforce Contacts**. Sessions are a **signed JWT in an httpOnly
cookie** (`meridian_session`), so the token is unreachable from page JavaScript.

- **Signup** (`POST /api/auth/signup`): validate → `sf/contacts.createShopper`
  bcrypt-hashes the password and creates a **Person Account** — an `Account`
  insert with the `PersonAccount` record type (`FirstName`, `LastName`,
  `PersonEmail`), which auto-creates the backing `Contact`; the hash is then set
  on that Contact (`Password_Hash__c`). The app's identity is the backing Contact
  id → issue session cookie. Duplicate email → `409`. (See §9 for why the app
  stays Contact-keyed.)
- **Login** (`POST /api/auth/login`): find the Contact by email → `bcrypt.compare`
  against `Password_Hash__c` → issue cookie. Bad credentials → `400`.
- **Me** (`GET /api/auth/me`): decode the cookie → profile, or `401`.
- **Logout** (`POST /api/auth/logout`): clear the cookie.

The password **hash never leaves the server** and the plaintext password is
never stored. The JWT carries only id/email/name — never the hash.

`DATA_SOURCE=mock` keeps an in-memory user store so the app still runs offline;
the same bcrypt + cookie logic applies.

---

## 9. How orders are linked to a user

- **Logged-in checkout** sets **`Order.AccountId` to the shopper's own Person
  Account** (resolved from `Contact.AccountId`, cached). That standard link IS the
  shopper↔order relationship — there is no custom `Shopper__c` field.
- **Order history** (`GET /api/account/orders`, requires a session) runs
  `sf/orders.listOrdersForContact(contactId)`, which resolves the shopper's Person
  Account and queries:
  ```sql
  SELECT ... FROM Order WHERE AccountId = :personAccountId ORDER BY CreatedDate DESC
  ```
  then loads the OrderItems for those orders in one query. Ownership checks
  (`getOrder`, `cancelOrder`) compare the order's `AccountId` to the shopper's
  Person Account the same way.
- **Guest checkout** still works: the order lands on the shared `Meridian Web
  Orders` account (not a Person Account), so it never appears in any shopper's
  personal history; guests track it by order number + `Guest_Email__c`.

> Why `AccountId` and not a custom shopper field? Once shoppers are **Person
> Accounts**, a registered shopper's Person Account uniquely identifies them, so
> `Order.AccountId` is a clean standard link — no custom field needed. The app is
> still Contact-keyed for identity/login (session = backing Contact id); order
> reads just translate that Contact → its Person Account. (Standard
> `BillToContactId` remains unexposed on this org's `Order`, but it's not needed.)

**B2C only:** every shopper is an individual (one login = one person). There's
no company/team-account concept — a shopper sees only their own orders, and an
order-by-id read (`GET /api/account/orders/:id`) 404s unless they placed it. (A
shared/company-account feature was removed and may return later, governed.)

---

### 9c. Product reviews & ratings

Any logged-in shopper can leave one star rating + written review per product.
There's no standard Salesforce object for this on a Sales Cloud org (reviews
are a Commerce Cloud B2C concept, not present here), so this was the first
feature to add a whole new **custom object**, `Meridian_Product_Review__c`. See
[SALESFORCE_CONVENTIONS.md](SALESFORCE_CONVENTIONS.md) for the object's schema
and justification.

- `GET /api/products/:id/reviews` (public) → `{ reviews, average, count,
  myReview }`. `sf/reviews.js` resolves the app's ProductCode slug to the
  real `Product2` Id via `sf/catalog.js`'s `getProduct()` — same pattern
  `sf/orders.js` uses for order lines — which also gives the 404-if-missing
  behavior for free. `myReview` is populated only when the request carries a
  session and that shopper has already reviewed the product.
- `POST /api/products/:id/reviews` (requires a session) — one review per
  shopper per product, enforced **server-side** (not a Salesforce validation
  rule): `sf/reviews.js` checks for an existing `Product__c`+`Contact__c` row
  before insert and throws a 409 (`already_reviewed`) if found.
- **No moderation queue and no verified-purchase requirement** — a review is
  visible immediately on submission. The merchant can remove an inappropriate
  one directly in Salesforce (same pattern as order fulfillment — no custom
  admin UI exists or is planned for this). Both are explicit, deliberate cuts
  for this phase, not gaps that were missed.
- **Catalog-grid star badges are not implemented** — only the product detail
  page shows ratings. Adding them to `ProductCard.jsx`/the Shop grid would
  mean either an aggregate query per catalog list fetch or reworking the
  shared, cached `store/catalog.js` query that checkout pricing also depends
  on — deliberately out of scope for this pass; the reviews endpoint already
  returns `average`/`count`, so this is a cheap follow-up later.
- Mock mode (`store/reviews.js`) mirrors every rule above with an in-memory
  array, including the 404-on-missing-product and 409-on-duplicate behavior —
  confirmed to match the Salesforce path exactly (an earlier draft of the
  mock path let a nonexistent product return an empty list instead of 404;
  fixed before this shipped).

---

### 9d. Wishlist / favorites

Logged-in shoppers can save coffees to a wishlist — a heart on every product
card and detail page, plus a Wishlist tab in the account showing saved
coffees. Server-persisted (keyed to the shopper's Person Account) so it follows
them across devices.

- Backed by the **standard `Wishlist` + `WishlistItem`** objects. Each shopper
  gets one `Wishlist` (parented to their Person Account + a `WebStore`, which the
  standard object requires — `SF_WEBSTORE_NAME` picks it, defaulting to the first
  store on the org); saved products are `WishlistItem` rows (`Product2Id`). One
  row per saved (shopper, product) — see [SALESFORCE_CONVENTIONS.md](SALESFORCE_CONVENTIONS.md).
- `GET /api/account/wishlist` → `string[]` of saved product slugs (tiny
  payload; the UI joins to full products from the catalog it already loads).
  `POST` adds (idempotent — `sf/wishlist.js` skips if a row exists, so no
  duplicate per pair), `DELETE /:productId` removes. All require a session.
- **v1 requires login to save** — a guest tapping the heart is routed to
  `/login` (matches how reviews gate on auth). Guest-wishlist +
  merge-on-login is out of scope.
- Client state lives in `WishlistContext` (a `Set` of saved ids, so the heart
  on any card reflects state via `has(id)` with no per-card fetch); `toggle`
  is optimistic and reverts on failure. Mirrors `CartContext`, but
  server-persisted rather than `localStorage`.
- Mock mode (`store/wishlist.js`, in-memory `Map<contactId, Set>`) mirrors the
  same rules incl. the 404-on-missing-product check.

---

### 9e. Saved addresses

Logged-in shoppers save shipping addresses (Addresses account tab) and pick
one at checkout instead of retyping.

- **Standard object**, parented to the shopper's **Person Account**: saved
  addresses are standard **`ContactPointAddress`** rows (`ParentId` = the person
  account). `ContactPointAddress` only accepts an `Account`/`Individual` parent —
  which is exactly why this became viable once shoppers were modelled as Person
  Accounts (it was a custom object back when shoppers were bare Contacts). App
  shape ⇄ standard fields: label→`Name`, recipient→`AddressFirstName`/
  `AddressLastName`, ISO `StateCode`/`CountryCode` picklists (validated by
  `src/data/regions.js`, flowing into the Order's `ShippingStateCode`/
  `ShippingCountryCode` at checkout), `IsDefault`↔`IsPrimary`,
  `AddressType='Shipping'`. Only the app's own `Shipping` rows are read/written.
- CRUD API under `/api/account/addresses` (`GET`/`POST`/`PATCH`/`DELETE`), all
  requiring a session. **One default per shopper**, enforced server-side
  (`sf/addresses.js`/`store/addresses.js` clear the flag on the shopper's other
  addresses whenever one is set default) — verified live that setting a new
  default flips the old one off. The first address a shopper saves becomes the
  default automatically.
- Checkout integration (`Checkout.jsx`): a logged-in shopper with saved
  addresses sees a picker above the shipping form; the **default auto-fills** on
  load, selecting another fills the form from it, and a "Save this address for
  next time" checkbox persists a newly-typed one (best-effort — never blocks
  the order). Guests see no picker and check out exactly as before.
- Mock mode (`store/addresses.js`, in-memory `Map<contactId, Address[]>`)
  mirrors the same one-default invariant so both modes behave identically.

---

### 9f. Real-time order tracking (Change Data Capture → SSE)

When a merchant changes an order's `Status` in Salesforce, the shopper's order
page updates **live** — no reload, no manual Refresh.

- **Salesforce side**: `Order` is on the standard Change Data Capture channel
  (enabled by `sf:setup`; see SALESFORCE_CONVENTIONS.md). Any `Order` change
  publishes to `/data/OrderChangeEvent`.
- **BFF subscriber** (`sf/orderStream.js`, salesforce mode, booted once at
  startup): subscribes to the CDC channel via the jsforce Streaming API. A CDC
  event carries only the changed fields + record ids — **not** the owner — so
  the subscriber does one SOQL lookup (`Account.PersonContactId`, `OrderNumber`,
  `Status`) to resolve the shopper's backing Contact, then publishes
  `{contactId, orderId, status}` to an in-process event bus
  (`lib/orderEvents.js`). It self-heals: on transport drop / token expiry it
  resets the connection and re-subscribes with capped backoff.
- **SSE endpoint** `GET /api/account/orders/stream` (`requireAuth`): holds an
  open `text/event-stream`, forwards only bus events whose `contactId` matches
  the logged-in shopper (verified in tests: a second shopper receives nothing),
  with a 25s heartbeat.
- **Browser** (`useOrderStream.js`): both the order **detail** page
  (`OrderDetail.jsx` — silently re-fetches the viewed order, flashes the
  timeline) and the order **list** (`Orders.jsx` — re-fetches the list)
  subscribe, so status updates land on both without a reload. While the stream
  is connected, an in-flight status tag (`isLiveStatus`: pending/paid/shipped)
  **glows** — the same visual cue on both pages. There's no manual Refresh
  button; `useRefreshOnFocus` is the invisible fallback, so a missed event
  (e.g. while disconnected) is always recoverable on the next focus.
- **Mock parity**: with no Salesforce, a mock-only dev-trigger
  `POST /api/dev/orders/:id/advance` (mounted **only** when `DATA_SOURCE=mock`)
  advances an order one step and publishes to the same bus — so the live path is
  demoable and E2E-testable (`e2e/realtime.spec.js`) with zero Salesforce.

---

### 9g. Support-ticket tracking

The contact form opens a Salesforce `Case`; shoppers can then **track** it.

- **Linkage**: `POST /api/support` runs under `optionalAuth`, so a logged-in
  shopper's Case is created with `ContactId` set (plus `SuppliedName`/
  `SuppliedEmail` always). `sf/cases.js`.
- **List/detail** (`requireAuth`): `GET /api/account/tickets` lists the
  shopper's Cases (matched by `ContactId` **or** `SuppliedEmail`);
  `GET /api/account/tickets/:caseNumber` returns one Case (scoped — 404 unless
  it's theirs) with its **public reply thread**: `CaseComment` rows where
  `IsPublished = true`, oldest-first. **Internal comments (`IsPublished = false`)
  are never returned** — verified live.
- **Status** comes straight from the standard `Case.Status` (New / On Hold /
  Escalated / Closed). The merchant works the Case in Salesforce Service; the
  customer sees the status + public replies under **Account → Support**.
- **Mock parity**: mock persists created cases; a mock-only dev-trigger
  `POST /api/dev/cases/:caseNumber/reply` `{ body, status? }` appends a public
  reply / bumps status, standing in for a merchant Salesforce update
  (`e2e/support.spec.js`).

### 9h. Guest order tracking

A public page (`/track`) lets a **guest** check an order **without an account**.
It's guest-only: a logged-in shopper hitting `/track` is redirected to their
`/account/orders` (they track there) — never to the login page.

- `POST /api/orders/track` `{ orderId, email }` returns the order **only if**
  `email` case-insensitively matches the order's `Guest_Email__c` (the checkout
  email, set on every order). Any mismatch → a **generic** not-found, so an
  order number alone can't be probed (`store/orders.js` / `sf/orders.js`
  `trackOrder`). The read-only page reuses `OrderTimeline`.
- **Live updates** (same event stream as order history): the track response also
  includes a short-lived, order-scoped **`streamToken`** (a JWT carrying only the
  order number, `lib/session.js`). The page opens the **public**
  `GET /api/orders/track/stream?token=…` SSE — no session; the token is the
  authorization — which forwards the shared order-events bus filtered by
  **orderId** (vs the account stream's contactId filter). On a status change the
  page silently re-fetches (reusing the verified email) and the status tag glows,
  exactly like order history. `useOrderStream(onUpdate, url)` is reused with the
  token URL.

### 9i. Promotions / coupons (standard Commerce objects)

Promo codes live in **Salesforce**, not a code table — a merchant creates and
governs them there, the storefront reads + applies them.

- **The model** (all standard, no custom schema): **`Coupon`** (the code —
  `Status`, `StartDateTime`/`EndDateTime` for validity/expiry,
  `RedemptionLimitAllBuyers`/`RedemptionLimitPerBuyer`) → **`Promotion`**
  (`IsActive`, `StartDate`/`EndDate`) → **`PromotionTarget`** (the discount:
  `AdjustmentType` `PercentageDiscount` / `FixedAmountOff…`, or
  `TargetType=Shipping` for free shipping) + **`PromotionQualifier`**
  (`QualifierType=TransactionTotal`, `MinimumAmount` = min-subtotal). Usage is
  tracked in **`CouponCodeRedemption`**.
- **Read path** ([`sf/promos.js`](../server/src/sf/promos.js) — the only file that
  reads these): `getCouponRule(code)` resolves a code to a normalized
  `{ kind, value, minSubtotal, validity, limits, label }` (all money in USD
  dollars; cached briefly).
  [`store/promos.js`](../server/src/store/promos.js) then runs one shared
  `evaluate()` for the date/active/min/limit checks and computes the discount —
  **server-side, against the trusted subtotal**, exactly as before. Mock mode
  keeps a static table with the same shape (so the app runs offline and E2E can
  test expiry/limit via the `EXPIRED10` / `ONCE5` codes).
- **Validation** (`POST /api/promo/validate`, `optionalAuth`) surfaces friendly
  errors: `promo_invalid` / `promo_inactive` / `promo_expired` / `promo_min` /
  `promo_limit`. The same check re-runs at order creation (a code can go
  invalid between cart and checkout).
- **Redemption tracking**: after a promo order is created, the app writes a
  `CouponCodeRedemption` (`CouponId`, `Transaction`=order #, `Buyer`=contact/
  email) — best-effort, never fails the paid order. Limits are enforced by
  counting these (a small race window under simultaneous checkouts is accepted).
- **Seeding**: `npm run sf:setup` seeds the demo codes idempotently
  (`WELCOME10` 10% off, `MERIDIAN5` $5 off over $25, `FREESHIP` free shipping);
  add more in Salesforce.

### 9j. Order Management — OrderSummary + tax

Every order also produces a standard **`OrderSummary`** (with `OrderItemSummary`
+ `OrderDeliveryGroupSummary`), showcasing Salesforce Order Management. It
**supplements** the Order — status/cancel/real-time still ride `Order.Status`
(§9f). [`sf/orderSummary.js`](../server/src/sf/orderSummary.js) owns the OMS objects.

- **Tax**: a flat `SF_TAX_RATE` (default 8%) on the post-discount subtotal,
  computed server-side (`lib/totals.computeTax`), added to the charge, and written
  as **one `OrderItemTaxLineItem` per product line** — the total tax is apportioned
  across the lines by amount (largest-remainder, so the per-line cents sum exactly
  to the total), so every `OrderItemSummary` carries its own tax and
  `OrderSummary.TotalTaxAmount` rolls up to the same total. The UI
  shows a Tax row (cart, checkout, confirmation, order detail); `orderPaidUsd` is
  tax-inclusive. The client preview rate (`TAX_RATE` in `src/lib/money.js`) is
  kept in sync with the server.
- **Pipeline** (in `createOrder`, best-effort — never fails the paid order): the
  order composite creates the `Order` + `OrderDeliveryGroup` + product lines
  (`Type = 'Order Product'`, linked to the group via `OrderDeliveryGroupId`) + a
  `Delivery Charge` line for shipping; then the tax line is added, the order is
  activated, and the standard **`createOrderSummary`** action runs
  (`orderLifeCycleType = 'UNMANAGED'`). Reads (`getOrder`/history/track) surface
  the resulting **summary number**; the displayed line items exclude the delivery
  charge (shipping is its own row).
- **Three org-specific gotchas** `sf:setup` / the pipeline handle:
  1. **`OrderItem.OrderDeliveryGroupId`** (standard) is FLS-hidden from the
     integration user — `sf:setup` grants it (createOrderSummary needs items on a
     delivery group).
  2. A pre-existing (foreign) **`B2B_UpdateStockOnOrder`** trigger decrements
     `Product2.Available_Qty__c` on activation for `Order Product` lines and throws
     if short (an `AuraHandledException`, which surfaces as a hard error over the
     API). We don't use that field for Meridian inventory — **`Stock__c` is the
     single source of truth**. To keep the foreign trigger from blocking activation
     *and* to avoid a confusing second stock number, the pipeline **mirrors**
     `Available_Qty__c` to the current `Stock__c` (capped at its precision-5 max,
     99999) just before activating: the trigger then subtracts the ordered qty from
     the same value the app subtracts from `Stock__c`, so the two fields always
     agree. (See [`sf/orders.js`](../server/src/sf/orders.js) `createOrder`.)
  3. We **don't** create an OMS discount adjustment — this org's B2B adjustment
     handling rewrites source `OrderItem` prices, which would corrupt reads. The
     discount stays on `Order.Discount__c`, so `OrderSummary.GrandTotalAmount` is
     pre-discount on promo orders. The app's totals come from the Order + tax and
     always match the charge.
- **Setup** (`sf:setup`): a "Meridian Shipping" `Product2` + $0 `PricebookEntry`
  (the delivery-charge line references a product) and a "Meridian Standard
  Shipping" `OrderDeliveryMethod`; the FLS grant above; and `Available_Qty__c`
  mirrored to `Stock__c` as a baseline. `sf:check` reports "Order Management ready".

---

## 10. Everything created in Salesforce (inventory)

This is the full list of what Meridian added to the org
`00D5f000007J7VoEAK` (My Domain `deloittetrngdec1.my.salesforce.com`). Integration
run-as user: **`vikask@deloitte.demoorg`**.

### 10.1 Standard objects used (not created — just used)
`Product2`, `Pricebook2` (Standard Price Book), `PricebookEntry`, `Order`,
`OrderItem`, `Account`, `Contact`, `PermissionSet`, `PermissionSetAssignment`.

### 10.2 Custom fields on `Product2` (created manually during setup)
| API name             | Type          | Notes                          |
|----------------------|---------------|--------------------------------|
| `Origin__c`          | Text (120)    | e.g. "Gedeb, Ethiopia"         |
| `Roast__c`           | Picklist      | Light / Medium / Dark          |
| `Tasting_Notes__c`   | Text (255)    | semicolon-separated            |
| `Process__c`         | Text (60)     | Washed / Natural / Honey / …   |
| `Altitude_Meters__c` | Number (6,0)  |                                |
| `Latitude__c`        | Number (9,6)  | decimal degrees                |
| `Longitude__c`       | Number (9,6)  | decimal degrees                |
| `Stock__c`           | Number (6,0)  |                                |
| `Weight_Grams__c`    | Number (6,0)  |                                |
| `Accent__c`          | Text (10)     | hex color for the UI           |
| `Image_Path__c`      | Text (255)    | e.g. `/products/x.jpg`         |

### 10.3 `Order` — standard-first (see [SALESFORCE_CONVENTIONS.md](SALESFORCE_CONVENTIONS.md))
The order **lifecycle rides the standard `Status` field**; the merchandise total
is the standard `TotalAmount` rollup. Only concepts with no standard equivalent
on this org are custom.

**Standard fields used:** `Status` (Draft→Activated→**Shipped**→Completed, or
**Cancelled** — the last two added to the standard picklist by `sf:setup`),
`TotalAmount` (merchandise subtotal), `EffectiveDate` / `ActivatedDate`,
`AccountId`, and the `Shipping*` address fields. New orders insert as `Draft`,
the app activates them to `Activated` after payment, and **the merchant advances
the rest by changing `Status` in Salesforce** — the storefront reads it back.
`AccountId` is the **registered shopper's own Person Account** (or the shared
`Meridian Web Orders` Account for guests) — and that standard link IS the
shopper↔order relationship, so order history is `WHERE AccountId = personAccount`
(no custom shopper field).

The display status is derived **only** from `Status` in
[server/src/sf/mappers.js](../server/src/sf/mappers.js) `orderStatus()`:
Draft→pending, Activated→paid, Shipped→shipped, Completed→delivered,
Cancelled→cancelled.

**Custom fields kept** (no standard equivalent; **API-created** by `sf:setup`):
| API name          | Type          | Purpose                                   |
|-------------------|---------------|-------------------------------------------|
| `Guest_Email__c`  | Email         | contact email captured at checkout        |
| `Discount__c`     | Currency (12,2) | promo discount in **USD** (paid = TotalAmount − discount + shipping) |
| `Promo_Code__c`   | Text (40)     | the applied promo code                    |
| `Shipping_Amount__c` | Currency (12,2) | shipping charged, in **USD**          |
| `Payment_Intent__c` | Text (64)   | payment provider charge id (`pi_mock_…` / Stripe PaymentIntent) |
| `Tracking_Number__c` | Text (64)  | tracking, shown on the account order timeline |

*Deprecated (migrated to standard, none read/written by the app):* `Shopper__c` →
standard `AccountId`; `Discount_Cents__c` → `Discount__c` (USD); `Shipping_Cents__c`
→ `Shipping_Amount__c` (USD); `Total_Cents__c` → `TotalAmount`; `Cancelled__c` /
`Payment_Status__c` / `Fulfillment_Status__c` → `Status`; `Shipped_Date__c` dropped.
Most are already removed from the org; `Total_Cents__c` (plus the
`Meridian_Wishlist_Item__c` / `Meridian_Address__c` objects) are retained holding
migrated-duplicate data and can be dropped from Setup later. Full table in the
"Deprecated" section of [SALESFORCE_CONVENTIONS.md](SALESFORCE_CONVENTIONS.md).

The org has
**State & Country picklists enabled**, so the BFF writes the ISO code fields
`ShippingCountryCode` / `ShippingStateCode` (Salesforce derives the text
`ShippingCountry` / `ShippingState`).

### 10.4 Custom field on `Contact`
| API name           | Type       | Purpose                                     |
|--------------------|------------|---------------------------------------------|
| `Password_Hash__c` | Text (255) | bcrypt hash of the shopper's password       |

### 10.4b `Case` (support) — no setup
The contact form creates a standard **`Case`** (`Origin='Web'`, `Subject`,
`Description`, `SuppliedName`, `SuppliedEmail`) and reads back its `CaseNumber`.
No custom fields or config required.

### 10.4c `Meridian_Product_Review__c` — new custom object (no standard equivalent)
The first Meridian feature to add a whole custom **object**, not just a field
on a standard one — created via `npm run sf:setup` (§9c above,
[SALESFORCE_CONVENTIONS.md](SALESFORCE_CONVENTIONS.md) for the justification).
AutoNumber name field (`PR-{0000}`).

| API name             | Type              | Purpose                        |
|-----------------------|-------------------|--------------------------------|
| `Product__c`          | Lookup → Product2 | the reviewed coffee            |
| `Contact__c`          | Lookup → Contact  | the reviewing shopper          |
| `Rating__c`           | Number (1,0)      | 1–5 stars                      |
| `Title__c`            | Text (120)        | review headline                |
| `Body__c`             | Long Text Area (4000) | the written review         |
| `Reviewer_Name__c`    | Text (120)        | display-name snapshot at review time |

### 10.4d Wishlist — standard `Wishlist` + `WishlistItem` (no custom object)
The B2C wishlist uses the **standard** objects. One `Wishlist` per shopper
(`AccountId` = their Person Account, `OwnerId` = integration user, `WebStoreId`
required — picked via `SF_WEBSTORE_NAME`), and a `WishlistItem` (`Product2Id`)
per saved coffee. `sf:setup` grants object CRUD; there's no custom schema.
See [§9d](#9d-wishlist--favorites).

### 10.4e Saved addresses — standard `ContactPointAddress` (no custom object)
Saved shipping addresses are standard **`ContactPointAddress`** rows parented to
the shopper's Person Account (`ParentId`) — viable now that shoppers are Person
Accounts (CPA needs an Account/Individual parent). App shape maps to
`Name`/`AddressFirstName`/`AddressLastName`/`Street`/`City`/`StateCode`/
`PostalCode`/`CountryCode`/`IsDefault`/`IsPrimary`, `AddressType='Shipping'`.
`sf:setup` grants object CRUD (+ FLS on the org's required `received_from_SAP__c`
flag). See [§9e](#9e-saved-addresses).

### 10.4f Order Change Data Capture (platform capability, not schema)
`Order` is added to the standard `ChangeEvents` channel via a
`PlatformEventChannelMember` (`ChangeEvents_OrderChangeEvent`) metadata deploy in
`npm run sf:setup` — no custom object/field. This lets the BFF subscribe to
`/data/OrderChangeEvent` for real-time order updates (§9f). Idempotent and
non-fatal; `sf:check` reports whether it's on.

### 10.5 Permission set
- **`Meridian_Web_Integration`** (label "Meridian Web Integration"). Grants
  read/edit field-level security on every API-created field (the Order
  fields and every `Meridian_Product_Review__c` field above) and object-level
  access on: `Order`; `Meridian_Product_Review__c` (read/create,
  `viewAllRecords: true` — the integration user reads every shopper's reviews for
  the aggregate rating, but the app never edits or deletes one); the **standard**
  `Wishlist` / `WishlistItem` and `ContactPointAddress`
  (read/create/edit/delete — rows are added, edited, removed, re-defaulted; the
  integration user *owns* the rows it creates, so no `viewAllRecords` is needed);
  plus the parent objects those depend on — `Contact` / `Account` / `WebStore`
  (Read), which Salesforce requires before it will accept Read on
  Wishlist/ContactPointAddress. Assigned to the integration user.
  Created/updated and assigned by `npm run sf:setup`. Needed because a field or
  object created via the API — and standard objects not on the integration user's
  profile — have no access by default.

### 10.6 Accounts
- **Registered shoppers** are **Person Accounts** (B2C) — created at signup via
  an `Account` insert with the `PersonAccount` record type (auto-creates the
  backing Contact). Their orders attach to their own person account. Requires
  Person Accounts enabled + the `PersonAccount` record type available to the
  integration user (verified by `sf:check`; grant the record type via the
  permission set if a create is ever blocked). Nothing custom to create.
- **`Meridian Web Orders`** — the shared catch-all Account that **guest** orders
  attach to. Created during setup (or by `npm run seed`).

### 10.6b Support (standard, no custom schema)
- **`Case`** — created by the contact form (`Origin = Web`); linked to the
  shopper's `Contact` when logged in. Customers track it (status + replies) via
  §9g. Nothing to create — standard object.
- **`CaseComment`** — the customer-visible reply thread; only `IsPublished =
  true` comments are shown. The integration user needs Read on both (confirmed
  by `sf:check`).

### 10.6c Promotions / coupons (standard, no custom schema)
- **`Promotion` / `Coupon` / `PromotionTarget` / `PromotionQualifier`** — the
  promo definition (§9i). `sf:setup` seeds the demo codes (WELCOME10, MERIDIAN5,
  FREESHIP) idempotently; merchants add more in Salesforce.
- **`CouponCodeRedemption`** — one row per redeemed promo order (usage tracking).
- The permission set grants the integration user Read on the promo objects (with
  `viewAllRecords` so merchant-created coupons are visible) and Read+Create on
  `CouponCodeRedemption`.

### 10.7 Connected App
- **`Meridian BFF`** — OAuth enabled, scopes `api` + `refresh_token`, with the
  **Client Credentials flow enabled** and a **Run-As** integration user. Its
  consumer key/secret live only in `server/.env`.

### 10.8 Data records (seeded, re-runnable via `npm run seed`)
- **16 `Product2`** records (`ProductCode` = the app slug) with all custom fields.
- **16 standard `PricebookEntry`** records (one per product, price in USD).
- Created at runtime by app usage: **`Contact`** records (shoppers) and
  **`Order` + `OrderItem`** records (checkouts). As of writing: 16 products,
  3 shopper contacts, 3 shopper-linked orders.

> To recreate this org from scratch: do the manual steps in
> [`SALESFORCE_SETUP.md`](SALESFORCE_SETUP.md)
> (§1–§4: Product2/Order/Contact fields, the Account, the Connected App), then
> `npm run sf:setup` (Order custom fields + permission set) and `npm run seed` (products).
> `npm run sf:check` verifies all of it.

---

## 11. Things to know / gotchas

- **My Domain is required.** The Client Credentials flow only issues tokens from
  the org's My Domain host (`https://…my.salesforce.com`), not
  `login`/`test.salesforce.com`. Using the generic host returns
  `request not supported on this domain`. Set `SF_LOGIN_URL` to My Domain.
- **Shared org / B2B scoping.** This org already has a B2B Commerce catalog
  (hundreds of `Product2` records). The storefront query filters on
  `Origin__c != null AND Roast__c != null` so only Meridian coffees show. If you
  add coffees without those fields they won't appear.
- **Field-level security on API-created fields.** `Order.Discount__c` /
  `Order.Shipping_Amount__c` (and the other custom Order fields) are created via
  the Metadata API and need the `Meridian_Web_Integration` permission set to
  become visible to the integration user (else SOQL reports "No such column").
  The same permission set grants access to the **standard** objects the app uses
  off-profile (Wishlist/WishlistItem/ContactPointAddress), which have parent-object
  dependencies (Contact/Account/WebStore Read) that must be granted together.
- **Field API names use underscores** (`Tasting_Notes__c`, not `TastingNotes__c`)
  because Salesforce derives them from the field label. The canonical list lives
  in `PRODUCT_FIELDS` in [`server/src/sf/mappers.js`](../server/src/sf/mappers.js).
- **No secrets in the repo.** Everything sensitive is in `server/.env`
  (git-ignored). The front end holds nothing sensitive.

---

## 12. API reference

| Method & path                        | Auth      | Purpose                                     |
|--------------------------------------|-----------|---------------------------------------------|
| `GET /health`                        | –         | Liveness                                    |
| `GET /api/products`                  | –         | List active Meridian products               |
| `GET /api/products/:id`              | –         | One product by slug                         |
| `GET /api/products/:id/reviews`      | optional  | `{ reviews, average, count, myReview }` — `myReview` set only when logged in and reviewed |
| `POST /api/products/:id/reviews`     | required  | Submit a review; `409 already_reviewed` if the shopper already reviewed this product |
| `POST /api/orders`                   | optional  | **Charge payment** then create the order (items + shipping + promo + payment); enforces stock, re-validates the promo. A decline → 402, no order |
| `GET /api/orders/:id`                | –         | One order by OrderNumber/Id (confirmation)  |
| `POST /api/promo/validate`           | optional  | Validate a promo code (read from Salesforce Coupon/Promotion) against a subtotal (USD) → `{ code, couponId, discount, freeShipping, label }`; friendly `promo_*` errors (§9i) |
| `GET /api/payment-config`            | –         | `{ provider, publishableKey }` — which card UI to render |
| `POST /api/auth/signup`              | –         | Create an individual shopper + session      |
| `POST /api/auth/login`               | –         | Log in + session                            |
| `POST /api/auth/logout`              | –         | Clear session                               |
| `GET /api/auth/me`                   | cookie    | Current shopper profile or 401              |
| `PATCH /api/account/profile`         | required  | Update the shopper's name (updates Contact, re-issues session) |
| `GET /api/account/orders`            | required  | The shopper's own order history             |
| `GET /api/account/orders/:id`        | required  | One of the shopper's own orders; 404 otherwise |
| `POST /api/account/orders/:id/cancel`| required  | Cancel **own** draft order; restores stock  |
| `GET /api/account/wishlist`          | required  | The shopper's saved product ids (slugs)     |
| `POST /api/account/wishlist`         | required  | Save a product (`{productId}`); idempotent; returns the updated id list |
| `DELETE /api/account/wishlist/:productId` | required | Unsave a product; returns the updated id list |
| `GET /api/account/addresses`         | required  | The shopper's saved addresses (default first) |
| `POST /api/account/addresses`        | required  | Save a new address; returns the updated list |
| `PATCH /api/account/addresses/:id`   | required  | Edit or set-default (enforces one default); returns the list |
| `DELETE /api/account/addresses/:id`  | required  | Remove an address; returns the list         |
| `GET /api/account/orders/stream`     | required  | SSE — live order-status updates for the shopper (§9f) |
| `GET /api/account/tickets`           | required  | The shopper's support tickets (Cases), most recent first (§9g) |
| `GET /api/account/tickets/:caseNumber` | required | One ticket + its public reply thread; 404 if not theirs |
| `POST /api/support`                  | optional  | Create a Salesforce Case (links `ContactId` when logged in); returns `{ caseNumber }` |
| `POST /api/orders/track`             | –         | Public guest order tracking by `{ orderId, email }` (§9h); returns the order + a `streamToken`; generic 404 on mismatch |
| `GET /api/orders/track/stream`       | token     | Public SSE — live status for one order, authorized by the `?token=` from `/orders/track` (§9h) |
| `POST /api/dev/orders/:id/advance`   | required  | **Mock mode only** — advance an order one step (simulates a merchant); drives the live stream in dev/E2E |
| `POST /api/dev/cases/:caseNumber/reply` | –      | **Mock mode only** — append a public reply / set status on a ticket (simulates a merchant Case update) |

**Inventory** is enforced server-side on `POST /api/orders`: a line exceeding
`Product2.Stock__c` → `409 insufficient_stock`; on success stock is decremented,
and restored on cancel. The product cache is invalidated so the storefront
reflects the new stock.

All errors are typed JSON: `{ "error": "<code>", "message": "<friendly text>" }`
with the right HTTP status.

---

## 13. Security posture (current)

- Order totals, unit prices, and promo discounts are **always recomputed
  server-side** from Salesforce pricebook data; the client cannot set a price.
- Sessions are **httpOnly signed JWT cookies**; passwords are **bcrypt-hashed**
  in Salesforce and never returned to the client.
- `helmet`, CORS locked to `APP_ORIGIN`, JSON body size limit, strict input
  validation (`zod`).
- Production **refuses to start** with an unset/default `SESSION_SECRET`
  (`config.js` → `assertProductionConfig()`); `COOKIE_SECURE=true` is required
  in prod so the session cookie only ever travels over HTTPS.
- Payments go through a provider seam (`server/src/pay/index.js`) — mock by
  default, real Stripe test-mode PaymentIntents with `PAYMENT_PROVIDER=stripe`.
- CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) runs lint,
  build, and the Playwright E2E suite on every push/PR.
- **Still not implemented:** transactional email (order receipts are
  in-browser only), rate limiting, and SSR/prerendering for guaranteed
  crawler-visible HTML (SEO is currently client-rendered — see
  [ARCHITECTURE.md §4.5](ARCHITECTURE.md)).
