# Meridian — Developer & Salesforce Guide

A single reference for how the Meridian storefront is built, how the runtime
flows (products, orders, accounts) work, and **exactly what was created in
Salesforce** so you can find, change, or recreate it.

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

```
/                     React app (Vite root)
  src/
    api/store.js      the ONLY data-access module the UI uses
    context/          CartContext, AuthContext
    pages/            Home, Shop, ProductDetail, Cart, Confirmation,
                      Login, Signup, Account, About, NotFound
    components/       Navbar, Footer, ProductCard, AuthForm, AuthLayout, …
    lib/              money.js (cents↔display), geo.js (coordinate labels)
  public/products/    16 bundled coffee photos
/server               Node BFF
  src/
    index.js          Express app (helmet, cors, cookies, routes)
    config.js         env-driven config
    routes/           products, orders, auth, account, health
    store/            catalog, orders, auth  ← branch on DATA_SOURCE
    sf/               Salesforce layer (see §5)
    data/products.js  the mock/seed catalog (source of truth for seeding)
    lib/              cache, errors, session (JWT cookie)
  docs/SALESFORCE_SETUP.md   org setup checklist
/docs/DEVELOPER_GUIDE.md     this file
/meridian-plan/docs/         original phase specs
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

- **Signup** (`POST /api/auth/signup`): validate → `sf/contacts.createShopper`
  bcrypt-hashes the password and creates a `Contact`
  (`FirstName`, `LastName`, `Email`, `Password_Hash__c`) → issue session cookie.
  Duplicate email → `409`.
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

### 10.5 Permission set
- **`Meridian_Web_Integration`** (label "Meridian Web Integration",
  id `0PSKa000006czzoOAA`). Grants read/edit field-level security on the
  API-created Order fields (`Shopper__c`, `Guest_Email__c`, `Discount_Cents__c`,
  `Promo_Code__c`, `Shipping_Cents__c`, `Payment_Intent__c`, `Tracking_Number__c`)
  and is **assigned to the integration user**. Created/updated and assigned by
  `npm run sf:setup`. Needed because a field created via the API has no FLS by
  default, so the integration user otherwise can't see it.

### 10.6 Account
- **`Meridian Web Orders`** — one Account that all web orders (guest and
  logged-in) are attached to. Created during setup (or by `npm run seed`).

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
> [`server/docs/SALESFORCE_SETUP.md`](../server/docs/SALESFORCE_SETUP.md)
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
| `POST /api/orders`                   | optional  | **Charge payment** then create the order (items + shipping + promo + payment); enforces stock, re-validates the promo. A decline → 402, no order |
| `GET /api/orders/:id`                | –         | One order by OrderNumber/Id (confirmation)  |
| `POST /api/promo/validate`           | –         | Validate a promo code against a subtotal → `{ code, discountCents, freeShipping, label }` |
| `GET /api/payment-config`            | –         | `{ provider, publishableKey }` — which card UI to render |
| `POST /api/auth/signup`              | –         | Create a shopper + session                  |
| `POST /api/auth/login`               | –         | Log in + session                            |
| `POST /api/auth/logout`              | –         | Clear session                               |
| `GET /api/auth/me`                   | cookie    | Current shopper profile or 401              |
| `PATCH /api/account/profile`         | required  | Update the shopper's name (updates Contact, re-issues session) |
| `GET /api/account/orders`            | required  | The shopper's order history                 |
| `GET /api/account/orders/:id`        | required  | One own order (ownership-scoped; 404 if not theirs) |
| `POST /api/account/orders/:id/cancel`| required  | Cancel own draft order; restores stock      |
| `POST /api/support`                  | –         | Create a Salesforce Case; returns `{ caseNumber }` |

**Inventory** is enforced server-side on `POST /api/orders`: a line exceeding
`Product2.Stock__c` → `409 insufficient_stock`; on success stock is decremented,
and restored on cancel. The product cache is invalidated so the storefront
reflects the new stock.

All errors are typed JSON: `{ "error": "<code>", "message": "<friendly text>" }`
with the right HTTP status.

---

## 13. Security posture (current)

- Order totals and unit prices are **always recomputed server-side** from
  Salesforce pricebook data; the client cannot set prices.
- Sessions are **httpOnly signed JWT cookies**; passwords are **bcrypt-hashed**
  in Salesforce and never returned to the client.
- `helmet`, CORS locked to `APP_ORIGIN`, JSON body size limit, strict input
  validation (`zod`).
- **Not yet done** (future phases): payments (Stripe), transactional email,
  rate limiting, deployment/CI, HTTPS/`COOKIE_SECURE=true` in production.
