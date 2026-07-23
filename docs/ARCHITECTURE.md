# Meridian — Architecture & File Map

This is the file-by-file reference: what every frontend and backend file does,
how they connect, and how the project is version-controlled and deployed. If
you only read one doc to get oriented in this codebase, read this one.

For the Salesforce data model (objects, fields, org inventory) and the API
reference, see [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md). For the "why standard
fields" rule, see [SALESFORCE_CONVENTIONS.md](SALESFORCE_CONVENTIONS.md). For
hosting/env vars, see [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 1. The three tiers, at a glance

```
Browser
  │  React SPA (Vite) — src/
  │  every data call goes through ONE module: src/api/store.js
  ▼
same-origin  fetch('/api/...')   (httpOnly session cookie rides along)
  │
  ▼
Node BFF (Express) — server/
  │  every route calls a store/*.js module, which branches on DATA_SOURCE
  │  mock   → server/src/data/products.js + in-memory Maps
  │  salesforce → server/src/sf/*.js  (OAuth Client Credentials + jsforce)
  ▼
Salesforce (system of record) — Product2, Order, Contact, Account, Case
```

**The one rule that shapes this whole codebase:** every layer has exactly one
seam where the *next* layer can be swapped without touching anything upstream.

- UI pages/components never call `fetch` — only `src/api/store.js` does.
- BFF routes never contain Salesforce logic — only `server/src/store/*.js`
  (which picks mock or `sf/*.js`) does.
- Only `server/src/sf/*.js` files know a Salesforce field's API name.

This is why the app can run **entirely offline** (`DATA_SOURCE=mock`,
`PAYMENT_PROVIDER=mock`) with identical UI behavior to the live-Salesforce,
live-Stripe configuration — every store module mirrors the same business rules
(stock checks, promo validation, order-status transitions) in both branches.

---

## 2. Frontend (`src/`)

### 2.1 Entry point & routing

| File | Role |
|---|---|
| [`index.html`](../index.html) | Vite entry HTML. Contains the **no-FOUC theme script** — reads `localStorage`/`prefers-color-scheme` and sets `<html data-theme>` *before* React mounts, so there's never a flash of the wrong theme. |
| [`src/main.jsx`](../src/main.jsx) | Mounts `<App/>` wrapped in `ThemeProvider`, `AuthProvider`, `CartProvider`, and the router. |
| [`src/App.jsx`](../src/App.jsx) | All routes (`react-router-dom` v7). Renders `Navbar` + `Footer` around a `<Routes>` outlet; keys the `<main>` on `location.pathname` so the CSS page-enter animation replays on navigation (collapses under `prefers-reduced-motion`). Nested `/account/*` routes render inside `AccountLayout`. |

**Full route table:**
```
/                        Home.jsx
/shop                    Shop.jsx            (discovery: search/filter/sort)
/product/:id             ProductDetail.jsx
/cart                    Cart.jsx
/checkout                Checkout.jsx
/confirmation/:orderId   Confirmation.jsx
/login                   Login.jsx
/signup                  Signup.jsx
/account                 AccountLayout.jsx → Profile.jsx        (index)
/account/orders          AccountLayout.jsx → Orders.jsx
/account/orders/:id      AccountLayout.jsx → OrderDetail.jsx
/account/company         AccountLayout.jsx → Company.jsx        (only if user.company)
/about                   About.jsx
/contact                 Contact.jsx
*                        NotFound.jsx
```

### 2.2 `src/api/` — the single data-access module

| File | Role |
|---|---|
| [`src/api/store.js`](../src/api/store.js) | **The only file allowed to call `fetch`.** One exported async function per backend operation (`getProducts`, `placeOrder`, `signup`, `getCompanyOrders`, …). Internally every call goes through a private `request()` helper: `fetch('/api'+path, { credentials: 'include', cache: 'no-store' })`, converting any failure into a typed `StoreError { code, status, message }`. `cache: 'no-store'` matters specifically for order/account data — a merchant can change an order's status in Salesforce at any time, so the browser must never serve a stale cached response. |

### 2.3 `src/context/` — app-wide state

| File | Role |
|---|---|
| [`AuthContext.jsx`](../src/context/AuthContext.jsx) | Holds the logged-in shopper's profile (`{ id, email, firstName, lastName, company }`), fetched via `getMe()` on mount. Exposes `login`, `signup`, `logout`, `updateProfile`, `refresh`. `user.company` (set only for B2B shoppers) is what `AccountLayout` checks to decide whether to render the "Company" tab. |
| [`CartContext.jsx`](../src/context/CartContext.jsx) | Cart state (`{ id, qty }[]`) persisted to `localStorage`. Joins cart line items against live `getProducts()` data so prices/names/stock are always current, not stale from when the item was added. |
| [`ThemeContext.jsx`](../src/context/ThemeContext.jsx) | Light/dark theme. Reads the initial value the `index.html` script already set on `<html data-theme>` (so no re-render flash), then keeps the attribute, the `theme-color` meta tag, and `localStorage` in sync on every `toggleTheme()`/`setTheme()` call. |

### 2.4 `src/pages/` — one file per route

| File | Role |
|---|---|
| `Home.jsx` | Landing page — hero, featured coffees (`getProducts()`), origin ticker (`CoordTicker`). |
| `Shop.jsx` | **Discovery/catalog page.** Filters (search text, roast, origin country, price bucket) and sort all live in the URL via `useSearchParams` — a filtered view is shareable and survives a refresh/back-button. See §4.1. |
| `ProductDetail.jsx` | One coffee's full detail (origin, tasting notes, process, altitude/lat-long) + `RelatedProducts`. |
| `Cart.jsx` | Cart line items with `QtyStepper`, subtotal, link to checkout. Guards against navigating to checkout while the cart is still hydrating from `localStorage`. |
| `Checkout.jsx` | Shipping form (state/country dependent dropdowns via `src/data/regions.js`) → `PromoInput` → `PaymentFields` → `placeOrder()`. |
| `Confirmation.jsx` | Post-checkout receipt; re-fetches the order by id so a refresh always shows current data. |
| `Login.jsx` / `Signup.jsx` | Thin wrappers around `AuthForm.jsx` / `AuthLayout.jsx`. `Signup.jsx` owns the "I'm buying for a company" checkbox state (§4.4 in DEVELOPER_GUIDE.md). |
| `About.jsx` / `Contact.jsx` | Static content page / support form (`sendSupportRequest` → Salesforce `Case`). |
| `NotFound.jsx` | 404 page. |
| `account/AccountLayout.jsx` | Tab shell (`Profile` / `Order history` / `Company` — last tab conditional on `user.company`) shared by the nested account routes; requires auth (redirects to `/login` if `user` is null). |
| `account/Profile.jsx` | Edit name; `updateProfile()`. |
| `account/Orders.jsx` | The shopper's **own** order history (`getMyOrders()`). Exports `formatOrderDate` (reused by `Company.jsx`). |
| `account/OrderDetail.jsx` | One order — own or (view-only) a teammate's. Shows `OrderTimeline`, a "Placed by … · view-only" banner and hides Cancel when `isOwner === false`. Uses `useRefreshOnFocus` + a manual Refresh button so a merchant-side status change in Salesforce shows up without a hard reload. |
| `account/Company.jsx` | Shared team order history (`getCompanyOrders()`) — only reachable/rendered when `user.company` is set. |

### 2.5 `src/components/` — reusable UI

| File | Role |
|---|---|
| `Navbar.jsx` / `MobileMenu.jsx` / `AccountMenu.jsx` | Site header, responsive mobile drawer, and the logged-in-shopper dropdown. |
| `Footer.jsx` | Site footer (nav links, brand). |
| `ProductCard.jsx` / `ProductImage.jsx` | Catalog grid tile; image component with a graceful fallback to the origin-accent color while the photo loads. |
| `CoordTag.jsx` / `CoordTicker.jsx` | The "coordinates as design element" motif — renders `lat, long` in monospace on cards/detail pages; the ticker scrolls a strip of origins on the homepage. |
| `Breadcrumbs.jsx` | Breadcrumb trail (Home / Shop / product name, etc.). |
| `ShopControls.jsx` | The Shop page's filter/search/sort bar — fully controlled, parent (`Shop.jsx`) owns the actual filtering logic. |
| `ActiveFilters.jsx` | Chips showing currently-applied Shop filters, each removable. |
| `SearchSuggest.jsx` | Typeahead search box implementing the ARIA combobox pattern (full keyboard nav) over the loaded catalog — suggests matching coffees and tasting notes. |
| `RelatedProducts.jsx` | "You might also like" strip on `ProductDetail`, calls `getProducts()` and picks by shared roast/origin. |
| `QtyStepper.jsx` | +/− quantity control used in Cart and ProductDetail. |
| `PromoInput.jsx` | Promo code entry on Checkout — calls `applyPromo()`, shows the discount inline. |
| `PaymentFields.jsx` | Card number/expiry/CVC inputs for checkout (mock or Stripe-ready — see §4.3). |
| `OrderTimeline.jsx` | Visual Paid → Shipped → Delivered (or Cancelled) progress, driven by the order's `status`. |
| `AuthForm.jsx` / `AuthLayout.jsx` | Shared login/signup form + page chrome (includes the company-signup toggle). |
| `ThemeToggle.jsx` | Sun/moon button calling `useTheme().toggleTheme()`. |
| `Spinner.jsx` / `ErrorState.jsx` | Shared loading and error UI used on every data-fetching screen. |
| `JsonLd.jsx` | Injects a `<script type="application/ld+json">` structured-data block (see §4.5). |

### 2.6 `src/lib/` — small pure helpers & hooks

| File | Role |
|---|---|
| `money.js` | `formatCents(cents)` — the only place currency is formatted. Money is stored as **integer cents** everywhere in the app. |
| `geo.js` | Formats `{lat, long}` into the coordinate-label strings used by `CoordTag`. |
| `useSeo.js` | Sets `document.title` + meta description/OG tags per route (§4.5). |
| `useRefreshOnFocus.js` | Re-runs a callback when the tab regains focus/visibility — used on account pages so a Salesforce-side order-status change appears without a manual reload. |
| `useParallax.js` / `useTilt.js` / `useReveal.js` | Small scroll/hover motion hooks for the homepage's design flourishes; all respect `prefers-reduced-motion`. |

### 2.7 `src/data/` and `src/styles/`

| File | Role |
|---|---|
| `data/regions.js` | `US_STATES`, `CA_PROVINCES`, `COUNTRIES`, and `regionsFor(countryCode)` — drives the dependent state/country dropdowns on Checkout/Signup so only valid ISO codes are ever sent to Salesforce. |
| `styles/tokens.css` | Design tokens (CSS custom properties) — color, spacing, type scale. Both themes are defined here as two token blocks selected by `[data-theme]`; every component consumes tokens, never hardcoded colors, so theme-switching needs no per-component changes. |
| `styles/global.css` | Resets, base element styles, typography. |
| `styles/app.css` | Component-level styles (BEM-ish class names matching each component). |

---

## 3. Backend (`server/`)

### 3.1 Entry point & wiring

| File | Role |
|---|---|
| [`server/src/index.js`](../server/src/index.js) | Express app setup: `helmet` (CSP), `cors` (locked to `APP_ORIGIN`), JSON body parsing (32kb limit), `cookie-parser`, request logging (dev only). Mounts every route module under `/api` (plus `/health` and `/sitemap.xml` unprefixed). **In production**, also serves the built SPA (`express.static(dist/)` + a catch-all `GET *` → `index.html` SPA fallback) — one process serves both the API and the front end, same-origin, so the session cookie needs no CORS workaround. |
| [`server/src/config.js`](../server/src/config.js) | Reads every env var once at startup into a typed `config` object; `assertProductionConfig()` **refuses to start** in `NODE_ENV=production` with an unset `SESSION_SECRET` or the dev default, so a misconfigured prod deploy fails loudly instead of running insecurely. |

### 3.2 `server/src/routes/` — HTTP layer (thin)

Each file maps HTTP verbs/paths to a `store/*.js` call; validates input with `zod`; never touches Salesforce directly.

| File | Mounted paths | Delegates to |
|---|---|---|
| `products.js` | `GET /api/products`, `GET /api/products/:id` | `store/catalog.js` |
| `orders.js` | `POST /api/orders`, `GET /api/orders/:id` | `store/orders.js` |
| `account.js` | `GET/PATCH /api/account/profile`, `GET /api/account/orders[/:id]`, `POST /api/account/orders/:id/cancel`, `GET /api/account/company/orders` | `store/orders.js`, `store/auth.js` (all require a session) |
| `auth.js` | `POST /api/auth/signup\|login\|logout`, `GET /api/auth/me` | `store/auth.js` |
| `promo.js` | `POST /api/promo/validate` | `store/promos.js` |
| `payment.js` | `GET /api/payment-config` | `pay/index.js` |
| `support.js` | `POST /api/support` | `store/support.js` |
| `seo.js` | `GET /sitemap.xml` | `store/catalog.js` (builds the sitemap from the live/mock catalog) |
| `health.js` | `GET /health` | — (liveness probe for the deploy platform) |

### 3.3 `server/src/store/` — the mock⇄Salesforce swap point

Each file exports the same function signatures regardless of data source; every export checks `config.dataSource === 'salesforce'` once and branches.

| File | Mock implementation | Salesforce implementation |
|---|---|---|
| `catalog.js` | Filters `server/src/data/products.js` | `sf/catalog.js` — cached behind a short TTL (`lib/cache.js`) |
| `orders.js` | In-memory order Map, stock tracked in-memory | `sf/orders.js` |
| `auth.js` | In-memory user Map, same bcrypt hashing | `sf/contacts.js` |
| `companies.js` | In-memory domain→company Map | `sf/companies.js` |
| `promos.js` | *(no branch — promo codes are a static in-repo table, same in both modes)* | |
| `support.js` | Mock: logs + returns a fake case number | `sf/cases.js` |

### 3.4 `server/src/sf/` — the only files that speak Salesforce

| File | Exports | Salesforce object(s) |
|---|---|---|
| `client.js` | `getConnection()`, `withConn(fn)`, `resetConnection()` | — (OAuth Client Credentials auth; see §5) |
| `mappers.js` | Field-name lists + record⇄app-shape converters (`orderFromSf`, `productFromSf`, `orderStatus()`) | — (shared helper, no calls of its own) |
| `catalog.js` | `getProducts`, `getProduct`, `getProductsByCodes` | `Product2`, `PricebookEntry` |
| `orders.js` | `createOrder`, `getOrder`, `cancelOrder`, `listOrdersForContact`, `listOrdersForCompany` | `Order`, `OrderItem`, `Account`, `Pricebook2`, `Product2` |
| `contacts.js` | `findByEmail`, `createShopper`, `verifyPassword`, `updateShopper`, `toProfile` | `Contact` |
| `companies.js` | `findOrCreateCompanyAccount` | `Account` (keyed by `Company_Domain__c`) |
| `cases.js` | `createCase` | `Case` |
| `seed.js` | *(script, not imported at request time)* — `npm run seed` | `Product2` + `PricebookEntry` |
| `setup-schema.js` | *(script)* — `npm run sf:setup` | creates custom fields, extends `OrderStatus` picklist, creates/updates the `Meridian_Web_Integration` permission set |
| `check.js` | *(script)* — `npm run sf:check` | read-only org readiness report |

See [DEVELOPER_GUIDE.md §10](DEVELOPER_GUIDE.md#10-everything-created-in-salesforce-inventory)
for the exact field list created in the org, and
[SALESFORCE_CONVENTIONS.md](SALESFORCE_CONVENTIONS.md) for which fields are
standard vs. custom and why.

### 3.5 `server/src/lib/` — cross-cutting helpers

| File | Role |
|---|---|
| `errors.js` | `ApiError` + typed constructors (`badRequest`, `notFoundError`, `paymentError`, …) and the central Express error handler — every error response is `{ error: <code>, message: <friendly text> }` with the right HTTP status. |
| `session.js` | Signs/verifies the shopper session **JWT**, stored in an httpOnly cookie (`meridian_session`); carries `{ id, email, firstName, lastName, company }` — never the password hash. |
| `totals.js` | Pure order-math: subtotal, discount, shipping, grand total — all in integer cents. Used identically by checkout, promo validation, and order creation so the number the shopper sees is always the number that gets charged. |
| `cache.js` | Tiny TTL wrap-cache (`cache.wrap(key, fn)`) used for product reads, to stay under Salesforce API limits. |
| `companyDomain.js` | `domainFromEmail(email)`, `assertCompanyDomainAllowed(domain)` — free-email-provider blocklist for B2B signup (gmail.com, yahoo.com, outlook.com, …). |

### 3.6 `server/src/pay/`

| File | Role |
|---|---|
| `index.js` | Payment provider seam. `PAYMENT_PROVIDER=mock` (default) simulates a charge fully offline — a specific test card number (`4000000000000002`) triggers a decline path, everything else succeeds — so checkout works with zero third-party accounts. `PAYMENT_PROVIDER=stripe` uses real Stripe test-mode PaymentIntents; the `stripe` SDK is **lazy-imported** so mock mode carries no extra dependency. Single entry point: `charge()` → `{ paymentId, status }` or throws a 402 `ApiError` on decline. |

### 3.7 `server/src/data/`

| File | Role |
|---|---|
| `products.js` | The mock catalog **and** the seed source of truth — `npm run seed` reads this same file to populate `Product2` + `PricebookEntry` in Salesforce, so mock and live data start out identical. |

---

## 4. Cross-cutting systems

### 4.1 Discovery / catalog filtering (`Shop.jsx` + `ShopControls.jsx` + `ActiveFilters.jsx` + `SearchSuggest.jsx`)

All filter state (`q` search text, `roast`, `origin` country, `price` bucket,
`sort`) is synced to the URL via `useSearchParams` — never local-only state.
That makes any filtered/sorted view a shareable link and survives a page
refresh or the browser back button. `SearchSuggest` layers a typeahead on top,
implementing the ARIA combobox pattern (arrow keys, Enter, Escape) against the
already-loaded product list — no separate search endpoint.

### 4.2 Promo codes (`PromoInput.jsx` → `POST /api/promo/validate` → `store/promos.js`)

A small static table (`WELCOME10`, `MERIDIAN5`, `FREESHIP`) — no per-user
limits or expiry (explicitly out of scope). `validatePromo()` is the single
source of truth and is called **twice**: once when the shopper applies the
code (to show the discount), and again inside `sf/orders.js createOrder`
during checkout — so a forged/stale client-side discount can never change
what's actually charged.

### 4.3 Payments (`PaymentFields.jsx` → `placeOrder()` → `server/src/pay/index.js`)

See §3.6. `GET /api/payment-config` tells the front end which UI to render
(`{ provider: 'mock' | 'stripe', publishableKey }`); `PaymentFields.jsx`
renders plain card inputs for mock, or is ready to swap in Stripe Elements
once `PAYMENT_PROVIDER=stripe` is set.

### 4.4 Theming (`ThemeContext.jsx` + `ThemeToggle.jsx` + `tokens.css` + inline script in `index.html`)

See §2.3 and §2.7. Three pieces work together: the **inline script** in
`index.html` sets `<html data-theme>` before React even loads (no flash of
wrong theme), `ThemeContext` keeps it in sync with `localStorage` and the
`theme-color` meta tag after that, and every component styles itself purely
from CSS custom properties in `tokens.css` — so no component needs
theme-aware JS, only the tokens change.

### 4.5 SEO (`useSeo.js` + `JsonLd.jsx` + `routes/seo.js` + `public/robots.txt`)

Client-rendered per-route `<title>`/meta description/Open Graph tags
(`useSeo`), JSON-LD structured data per page type (`JsonLd` — `Product`,
`Organization`, `BreadcrumbList`), a catalog-driven `/sitemap.xml` generated
server-side from the live product list (`routes/seo.js`), and a static
`robots.txt`. No SSR/prerendering — if guaranteed crawler-visible HTML is ever
needed, that's a future addition, not implemented here.

### 4.6 Testing & CI

| File | Role |
|---|---|
| `playwright.config.js` | Playwright E2E config — runs against the app in **mock mode** (hermetic, no live Salesforce/Stripe needed). |
| `e2e/checkout.spec.js` | End-to-end: browse → add to cart → checkout → confirmation. |
| `e2e/account.spec.js` | End-to-end: signup → login → order history → account pages. |
| `.github/workflows/ci.yml` | GitHub Actions — on every push/PR: `npm run lint`, `npm run build`, `npm run test:e2e`. All in mock mode; no secrets required, so CI runs identically for any contributor/fork. |

Run locally: `npm run test:e2e` (from repo root; starts the app itself per
`playwright.config.js`'s `webServer` block).

---

## 5. How the BFF authenticates to Salesforce

**OAuth 2.0 Client Credentials flow** — a server-to-server login with no
interactive user, implemented entirely in
[`server/src/sf/client.js`](../server/src/sf/client.js):

1. `POST {SF_LOGIN_URL}/services/oauth2/token` with `grant_type=client_credentials`
   + the Connected App's consumer key/secret (from `server/.env`, never
   committed).
2. Salesforce returns `{ access_token, instance_url }`, running as the
   Connected App's assigned **Run-As** integration user
   (`vikask@deloitte.demoorg` in this org).
3. A `jsforce.Connection` is built from those and cached in module memory —
   not re-authenticated on every request.
4. `withConn(fn)` wraps every Salesforce call: if `fn` fails with
   `INVALID_SESSION_ID` (expired token), it re-authenticates once and retries
   automatically — so an expired token self-heals without a request failing.

No Salesforce secret is ever visible to the frontend or committed to git —
`server/.env` is the only place they exist, and it's git-ignored (see
`.gitignore` and `.env.example` for the required keys).

---

## 6. Git workflow & repository layout

### 6.1 Remote & branch
- **Remote:** `https://github.com/Vikaschd04/React_Salesforce_Meridian.git`
- **Branch:** `main` (single-branch workflow — no long-lived feature branches;
  small commits land directly on `main`).

### 6.2 Commit convention
Conventional commit prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`,
`chore:`. Recent history shows the pattern:
```
ed92b7e fix(sf): order cancellation failed with ENTITY_IS_LOCKED
92a662f feat(b2b): company accounts + shared team order history
cb21226 fix: spacing after breadcrumbs/shipping rows + opaque mobile nav
a926f60 test: Playwright E2E suite (mock mode) + GitHub Actions CI
daa325c feat: SEO — per-route meta/OG + JSON-LD structured data
798e0df feat: production serving (single Node service) + Docker/Render deploy config
```
Each commit is scoped to one change, buildable/lintable on its own, with a
message explaining **why**, not just what changed.

### 6.3 What's git-ignored
`server/.env` (all Salesforce/Stripe/session secrets), `node_modules/`,
`dist/`. See `.gitignore`. **Rule: secrets only ever live in `server/.env`
locally, or as environment variables on the hosting platform — never in
front-end code, never committed.**

### 6.4 Top-level repo layout
```
/                        React app (Vite root)
  src/                   see §2
  public/products/       bundled coffee photos + robots.txt
  e2e/                   Playwright specs
  index.html             Vite entry + no-FOUC theme script
  vite.config.js         dev server + /api and /sitemap.xml proxy to the BFF
  playwright.config.js
  package.json           root (frontend) scripts — see §6.5
/server                  Node BFF
  src/                   see §3
  docs/SALESFORCE_SETUP.md   one-time org setup checklist
  package.json           server scripts — see §6.5
/docs
  ARCHITECTURE.md         this file
  DEVELOPER_GUIDE.md       Salesforce data flows + full API reference
  SALESFORCE_CONVENTIONS.md  standard-vs-custom field rule
  DEPLOYMENT.md            hosting/env vars/Docker/Render
/.github/workflows/ci.yml  lint + build + Playwright on every push/PR
Dockerfile                multi-stage build (SPA + BFF)
render.yaml                Render blueprint (deploys in mock mode out of the box)
.node-version               pins Node 22 for hosting platforms
```

### 6.5 Scripts

**Root** (`package.json`):
| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server only (`:5173`) |
| `npm run dev:server` | BFF only, via `server/`'s own `dev` script |
| `npm run dev:all` | Both together (`concurrently`) — the normal way to develop |
| `npm run build` | Production build → `dist/` |
| `npm start` | Run the BFF in production mode (serves `dist/` + `/api`) |
| `npm run serve` | `build` then `start` — local production smoke test |
| `npm run lint` | `oxlint` |
| `npm run test:e2e` | Playwright E2E suite |

**`server/`** (`server/package.json`):
| Script | What it does |
|---|---|
| `npm run dev` | BFF with auto-reload (`node --watch`) |
| `npm run seed` | Create/update the 16 `Product2` + `PricebookEntry` records in Salesforce from `src/data/products.js` |
| `npm run sf:setup` | Idempotently create every custom field + extend the `Status` picklist + create/update the permission set, in the live org |
| `npm run sf:check` | Read-only readiness report — auth, fields, account, products |

### 6.6 Deployment

One Node process serves both the built SPA and `/api` — see
[DEPLOYMENT.md](DEPLOYMENT.md) for the full walkthrough. Short version:
`Dockerfile` for any container host, `render.yaml` for a one-click Render
blueprint (deploys immediately in `mock`/`mock` mode with no secrets needed;
flip `DATA_SOURCE=salesforce` and/or `PAYMENT_PROVIDER=stripe` once real
credentials are added to the host's environment variables).
