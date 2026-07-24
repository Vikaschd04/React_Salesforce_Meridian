# Meridian — Developer & Salesforce Guide

A reference for how the Meridian runtime flows (products, orders, accounts,
B2B) work, and **exactly what was created in Salesforce** so you can find,
change, or recreate it.

> For a file-by-file map of the whole codebase (every frontend/backend file,
> theming, discovery/search, promos, payments, SEO, testing/CI, git workflow),
> see [ARCHITECTURE.md](ARCHITECTURE.md) — read that one first if you're new
> here. This guide goes deep on the Salesforce side specifically.

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
| `npm run sf:setup`| Create `Order.Shopper__c` + permission set, assign to the user    |
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
| `sf/mappers.js`     | Salesforce record ⇄ app shape; dollars⇄cents; field API names      |
| `sf/catalog.js`     | Product SOQL queries                                               |
| `sf/orders.js`      | Create Order + OrderItems (Composite API); read/list orders        |
| `sf/contacts.js`    | Shopper Contact create/find, password hashing                      |
| `sf/seed.js`        | Populate products + prices                                         |
| `sf/setup-schema.js`| Create `Order.Shopper__c` + permission set                        |
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
   `UnitPrice` (dollars) × 100 → `priceCents`, `Tasting_Notes__c` split on `;`.
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
     - an **`Order`**: `AccountId`, `Pricebook2Id`, `EffectiveDate` (today),
       `Status = 'Draft'`, `Total_Cents__c` (integer cents), and — if logged in —
       `Shopper__c` = the shopper's Contact Id.
     - one **`OrderItem`** per line, referencing the new order via
       `@{newOrder.id}`, with `Product2Id`, `PricebookEntryId`, `Quantity`,
       `UnitPrice`.
   - Reads the created order back and maps it: `orderId` = the Salesforce
     **`OrderNumber`** (e.g. `00000699`).
5. **UI** navigates to `/confirmation/:orderId`; the confirmation page can
   re-fetch it via `GET /api/orders/:id`.

Money is stored as **integer cents** everywhere in the app; Salesforce stores
dollars. Conversion happens only at the `sf/mappers.js` boundary.

---

## 8. Shopper accounts (signup / login)

Shoppers are **Salesforce Contacts**. Sessions are a **signed JWT in an httpOnly
cookie** (`meridian_session`), so the token is unreachable from page JavaScript.

- **Signup** (`POST /api/auth/signup`): validate → resolve an optional company
  (`companyName`, see §9b) → `sf/contacts.createShopper` bcrypt-hashes the
  password and creates a `Contact` (`FirstName`, `LastName`, `Email`,
  `Password_Hash__c`, and `AccountId` if buying for a company) → issue session
  cookie. Duplicate email → `409`.
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

- **Logged-in checkout** sets **`Order.Shopper__c`** (a custom Lookup → Contact)
  to the shopper's Contact Id.
- **Order history** (`GET /api/account/orders`, requires a session) runs
  `sf/orders.listOrdersForContact(contactId)`:
  ```sql
  SELECT ... FROM Order WHERE Shopper__c = :contactId ORDER BY CreatedDate DESC
  ```
  then loads the OrderItems for those orders in one query.
- **Guest checkout** still works: the order is created with **no** `Shopper__c`,
  attached only to the `Meridian Web Orders` account, and simply won't appear in
  anyone's history.

> Why a custom `Shopper__c` and not standard `BillToContactId`? This org's
> standard `Order` object does **not** expose `BillToContactId`, so a custom
> lookup is the reliable way to relate an Order to a Contact.

---

### 9b. B2B: company accounts (team buying)

A shopper can opt in to "buying for a company" at signup. Teammates are matched
purely by **work email domain** — no invite links or email-sending:

1. `lib/companyDomain.js` extracts the domain from the signup email
   (`jane@acme.com` → `acme.com`) and rejects free providers (gmail.com,
   yahoo.com, outlook.com, …) with a friendly `personal_email_domain` error.
2. `store/companies.js` → `sf/companies.js` finds an `Account` where
   `Company_Domain__c` matches; if found, the new Contact **joins it as-is**
   (the typed company name is only used the first time); otherwise it creates
   a new `Account { Name, Company_Domain__c }`.
3. The Contact's standard `AccountId` is set to that company Account. The
   shopper's session (JWT) carries `company: { id, name } | null`.

**Order linkage & shared visibility:** a company-linked shopper's checkout sets
`Order.AccountId` to their **own company's** Account (`sf/orders.js
createOrder`) instead of the shared `Meridian Web Orders` default. Because of
that single field:
- `GET /api/account/company/orders` (`sf/orders.js listOrdersForCompany`) lists
  every order under that Account — any teammate's order, most recent first,
  each with a `placedByName` (from `Order.Shopper__r.FirstName/LastName`).
- `GET /api/account/orders/:id` is relaxed from "must be my own order" to
  "mine, **or** under my company's Account" — a teammate can **view** (not
  cancel) another's order; the response's `isOwner: false` tells the UI to hide
  the Cancel button. Cancelling stays restricted to whoever placed the order,
  company or not — deliberately, to avoid needing an approval workflow this
  phase doesn't build.
- Guest/individual checkout is completely unaffected — it keeps using the
  shared default Account exactly as before.

A Contact belongs to at most one company (set once, at signup) — there's no
account switcher or a way to join a company after the fact yet.

---

### 9c. Product reviews & ratings

Any logged-in shopper can leave one star rating + written review per product.
There's no standard Salesforce object for this on a Sales Cloud org (reviews
are a Commerce Cloud B2C concept, not present here), so this is the first
feature to add a whole new **custom object**, `Meridian_Product_Review__c` — every
prior custom addition (B2B, order lifecycle) only added fields to existing
standard objects. See [SALESFORCE_CONVENTIONS.md](SALESFORCE_CONVENTIONS.md)
for the object's schema and justification.

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
coffees. Server-persisted (keyed to the shopper's Contact) so it follows them
across devices.

- Backed by a junction custom object **`Meridian_Wishlist_Item__c`**
  (`Contact__c` + `Product__c`); one row per saved (shopper, product). No
  standard wishlist object exists on Sales Cloud — see
  [SALESFORCE_CONVENTIONS.md](SALESFORCE_CONVENTIONS.md).
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

- **Standard-vs-custom, decided by evidence:** Salesforce's standard
  `ContactPointAddress` exists and is writable on this org, but its `ParentId`
  only accepts `Account`/`Individual`, **not `Contact`** — proven by a real
  insert that failed `FIELD_INTEGRITY_EXCEPTION`. Our shoppers are Contacts, so
  the app uses a custom `Meridian_Address__c` keyed to `Contact__c`. Its fields
  mirror the app's `shipping` shape (ISO `State_Code__c`/`Country_Code__c` text,
  validated by `src/data/regions.js`, flowing into the Order's standard
  `ShippingStateCode`/`ShippingCountryCode` at checkout).
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
  the subscriber does one SOQL lookup (`Shopper__c`, `OrderNumber`, `Status`)
  and publishes `{contactId, orderId, status}` to an in-process event bus
  (`lib/orderEvents.js`). It self-heals: on transport drop / token expiry it
  resets the connection and re-subscribes with capped backoff.
- **SSE endpoint** `GET /api/account/orders/stream` (`requireAuth`): holds an
  open `text/event-stream`, forwards only bus events whose `contactId` matches
  the logged-in shopper (verified in tests: a second shopper receives nothing),
  with a 25s heartbeat.
- **Browser** (`useOrderStream.js` → `OrderDetail.jsx`): opens an `EventSource`,
  and on an `order-update` for the viewed order silently re-fetches (reusing the
  existing `load({silent})`), briefly flashing the timeline. A "● Live"
  indicator shows while connected. Focus-refresh + the Refresh button remain as
  fallback, so a missed event (e.g. while disconnected) is always recoverable.
- **Mock parity**: with no Salesforce, a mock-only dev-trigger
  `POST /api/dev/orders/:id/advance` (mounted **only** when `DATA_SOURCE=mock`)
  advances an order one step and publishes to the same bus — so the live path is
  demoable and E2E-testable (`e2e/realtime.spec.js`) with zero Salesforce.

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
`AccountId` is the shared `Meridian Web Orders` Account for guests/individual
shoppers, or the shopper's **own company Account** when they belong to one (see
§9b) — that single field is what makes an order part of a company's shared
order history, with no extra visibility logic needed beyond a `WHERE AccountId`.

The display status is derived **only** from `Status` in
[server/src/sf/mappers.js](../server/src/sf/mappers.js) `orderStatus()`:
Draft→pending, Activated→paid, Shipped→shipped, Completed→delivered,
Cancelled→cancelled.

**Custom fields kept** (no standard equivalent; **API-created** by `sf:setup`):
| API name          | Type          | Purpose                                   |
|-------------------|---------------|-------------------------------------------|
| `Shopper__c`      | Lookup→Contact| links an order to the shopper (BillToContactId isn't available on this org). Child rel `Web_Orders`. |
| `Guest_Email__c`  | Email         | contact email captured at checkout        |
| `Discount_Cents__c` | Number (12,0) | promo discount, in cents (paid = TotalAmount − discount + shipping) |
| `Promo_Code__c`   | Text (40)     | the applied promo code                    |
| `Shipping_Cents__c` | Number (12,0) | shipping charged, in cents              |
| `Payment_Intent__c` | Text (64)   | payment provider charge id (`pi_mock_…` / Stripe PaymentIntent) |
| `Tracking_Number__c` | Text (64)  | tracking, shown on the account order timeline |

*Deprecated (migrated to standard, left in the org unused):* `Total_Cents__c`
→ `TotalAmount`; `Cancelled__c` / `Payment_Status__c` / `Fulfillment_Status__c`
→ `Status`; `Shipped_Date__c` dropped.

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

### 10.4d `Meridian_Wishlist_Item__c` — new custom object (no standard equivalent)
A junction for the B2C wishlist — one row per saved (shopper, product).
Created via `npm run sf:setup` (§9d above). AutoNumber name field
(`MWL-{0000}`).

| API name     | Type              | Purpose                    |
|--------------|-------------------|----------------------------|
| `Contact__c` | Lookup → Contact  | the shopper who saved it   |
| `Product__c` | Lookup → Product2 | the saved coffee           |

### 10.4e `Meridian_Address__c` — new custom object (standard didn't fit)
Saved shipping addresses. Standard `ContactPointAddress` exists but can't
parent to a Contact (§9e) — so a custom object keyed to `Contact__c`. Created
via `npm run sf:setup`. AutoNumber name field (`MAD-{0000}`).

| API name           | Type             | Purpose                          |
|--------------------|------------------|----------------------------------|
| `Contact__c`       | Lookup → Contact | the shopper                      |
| `Label__c`         | Text (80)        | "Home", "Office"                 |
| `Recipient_Name__c`| Text (120)       | name on the parcel               |
| `Street__c`        | Text (255)       |                                  |
| `City__c`          | Text (80)        |                                  |
| `State_Code__c`    | Text (10)        | ISO code (validated by the app)  |
| `Postal_Code__c`   | Text (20)        |                                  |
| `Country_Code__c`  | Text (10)        | ISO code                         |
| `Is_Default__c`    | Checkbox         | one default per shopper          |

### 10.4f Order Change Data Capture (platform capability, not schema)
`Order` is added to the standard `ChangeEvents` channel via a
`PlatformEventChannelMember` (`ChangeEvents_OrderChangeEvent`) metadata deploy in
`npm run sf:setup` — no custom object/field. This lets the BFF subscribe to
`/data/OrderChangeEvent` for real-time order updates (§9f). Idempotent and
non-fatal; `sf:check` reports whether it's on.

### 10.5 Permission set
- **`Meridian_Web_Integration`** (label "Meridian Web Integration"). Grants
  read/edit field-level security on every API-created field (the Order
  fields, `Account.Company_Domain__c`, and every `Meridian_Product_Review__c` /
  `Meridian_Wishlist_Item__c` field above) and object-level access on `Order`,
  `Meridian_Product_Review__c` (read/create, `viewAllRecords: true` — the
  integration user reads every shopper's reviews for the aggregate rating, but
  the app never edits or deletes one), and `Meridian_Wishlist_Item__c`
  (read/create/edit/delete — wishlist rows are added and removed; Salesforce
  requires `allowEdit` alongside `allowDelete` even though the app never edits
  a row), and `Meridian_Address__c` (full read/create/edit/delete — addresses
  are added, edited, deleted, and re-defaulted). Assigned to the integration
  user. Created/updated and assigned by `npm run sf:setup`. Needed because a
  field or object created via the API has no access by default, so the
  integration user otherwise can't see it.

### 10.6 Account
- **`Meridian Web Orders`** — one Account that guest/individual web orders are
  attached to. Created during setup (or by `npm run seed`).
- **Company accounts** — one real Account per business buying as a team,
  created on demand at signup (see §9b) and keyed by the custom
  `Company_Domain__c` field. Not seeded; these accumulate from real usage.

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
> `npm run sf:setup` (Shopper__c + permission set) and `npm run seed` (products).
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
- **Field-level security on API-created fields.** `Order.Shopper__c` was created
  via the Metadata API and needed the `Meridian_Web_Integration` permission set
  to become visible to the integration user (else SOQL reports "No such column").
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
| `POST /api/promo/validate`           | –         | Validate a promo code against a subtotal → `{ code, discountCents, freeShipping, label }` |
| `GET /api/payment-config`            | –         | `{ provider, publishableKey }` — which card UI to render |
| `POST /api/auth/signup`              | –         | Create a shopper + session; optional `companyName` links/creates a company (§9b) |
| `POST /api/auth/login`               | –         | Log in + session                            |
| `POST /api/auth/logout`              | –         | Clear session                               |
| `GET /api/auth/me`                   | cookie    | Current shopper profile (incl. `company`) or 401 |
| `PATCH /api/account/profile`         | required  | Update the shopper's name (updates Contact, re-issues session) |
| `GET /api/account/orders`            | required  | The shopper's own order history             |
| `GET /api/account/orders/:id`        | required  | One order — own, or (view-only) a teammate's under the same company; 404 if neither |
| `POST /api/account/orders/:id/cancel`| required  | Cancel **own** draft order; restores stock (teammates' orders can't be cancelled) |
| `GET /api/account/company/orders`    | required  | Shared order history for the shopper's company (any teammate); 404 if not part of one |
| `GET /api/account/wishlist`          | required  | The shopper's saved product ids (slugs)     |
| `POST /api/account/wishlist`         | required  | Save a product (`{productId}`); idempotent; returns the updated id list |
| `DELETE /api/account/wishlist/:productId` | required | Unsave a product; returns the updated id list |
| `GET /api/account/addresses`         | required  | The shopper's saved addresses (default first) |
| `POST /api/account/addresses`        | required  | Save a new address; returns the updated list |
| `PATCH /api/account/addresses/:id`   | required  | Edit or set-default (enforces one default); returns the list |
| `DELETE /api/account/addresses/:id`  | required  | Remove an address; returns the list         |
| `GET /api/account/orders/stream`     | required  | SSE — live order-status updates for the shopper (§9f) |
| `POST /api/dev/orders/:id/advance`   | required  | **Mock mode only** — advance an order one step (simulates a merchant); drives the live stream in dev/E2E |
| `POST /api/support`                  | –         | Create a Salesforce Case; returns `{ caseNumber }` |

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
