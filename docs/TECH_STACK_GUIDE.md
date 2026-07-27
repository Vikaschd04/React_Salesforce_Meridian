# Meridian — Tech Stack & Configuration Guide

A plain-language explainer for the tools, frameworks, and configuration behind
Meridian — written for anyone new to the stack (or new to this specific
combination of it). If [ARCHITECTURE.md](ARCHITECTURE.md) is "which file does
what," this doc is **"what is Node.js / Express / a BFF / jsforce, and how
does this project actually use each one."** It also inventories every
environment variable and config file in the repo in one place.

> Read this if you're asking "what does X mean" about the stack. Read
> [ARCHITECTURE.md](ARCHITECTURE.md) for the file-by-file map, and
> [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for how Salesforce data flows
> through each feature.

---

## 1. The three-tier shape, restated simply

```
Browser (React SPA)  →  same-origin /api  →  Node.js/Express BFF  →  jsforce  →  Salesforce
```

Three separate pieces of technology, three separate jobs:

| Piece | What it is | Its one job |
|---|---|---|
| **Node.js** | A JavaScript *runtime* (not a framework) | Runs the middleware's JS code outside a browser |
| **Express** | A *web framework* that runs on Node.js | Turns Node.js into an HTTP server with routing |
| **BFF** | An *architecture pattern*, not a library | Describes the *role* that Express app plays: a backend built for exactly one frontend |
| **jsforce** | A *client library* for Salesforce's APIs | Lets the Node.js code talk SOQL/CRUD/Streaming/Metadata to Salesforce |

The rest of this doc goes through each one, grounded in this repo's actual
code — then covers every configuration file and environment variable.

---

## 2. Node.js — the runtime

**What it is:** Node.js lets JavaScript run outside a web browser — as a
regular server process, with filesystem/network access a browser sandbox
would never allow. Without Node.js, JavaScript could only run inside a page.

**Why it matters here:** the storefront's *frontend* (React) and the
storefront's *middleware* (the BFF) are both written in JavaScript. That's a
deliberate choice — one language across the whole stack, one `package.json`
dependency ecosystem, and a developer who knows the frontend can read the
backend without a context switch.

**Where it shows up in this repo:**
- `server/package.json` → `"type": "module"` and `"engines": { "node": ">=18" }`
  — the BFF is plain ES modules (`import`/`export`, no bundler, no
  TypeScript compile step) running directly on Node.
- The entry point is literally `node src/index.js` (see the `start`/`dev`
  scripts) — there's no framework-specific CLI in front of it.
- `server/src/index.js` uses **built-in Node modules directly** —
  `node:path`, `node:url` — for resolving the built frontend's `dist/`
  folder in production. No wrapper library needed for that.
- The dev script (`"dev": "node --watch src/index.js"`) uses Node's own
  `--watch` flag (Node ≥18) to restart on file changes — no `nodemon`
  dependency required.

**In short:** Node.js is *why* the backend can be JavaScript at all; it's
the thing `node src/index.js` actually invokes.

---

## 3. Express — the web framework

**What it is:** Express is the most widely used HTTP framework for Node.js.
Node.js alone can open a socket and read raw bytes; Express adds the parts
every web server needs — URL routing, request/response helpers, a
composable **middleware chain**, JSON parsing — so you write route handlers
instead of a protocol parser.

**The middleware chain, concretely** — this is the actual code in
[`server/src/index.js`](../server/src/index.js), which is the clearest way
to see what Express *is*:

```js
const app = express()

app.use(helmet({ contentSecurityPolicy: { ... } }))   // security headers
app.use(cors({ origin: config.appOrigin, credentials: true })) // who can call this API
app.use(express.json({ limit: '32kb' }))               // parse JSON bodies
app.use(cookieParser())                                 // parse the session cookie
if (!config.isProd) app.use(morgan('dev'))              // request logging (dev only)

app.use('/', healthRoutes)
app.use('/', seoRoutes)
app.use('/api', authRoutes)
app.use('/api', accountRoutes)
// ...one app.use(...) per route module

app.use(notFoundHandler)   // catches any unmatched route
app.use(errorHandler)      // catches every thrown/rejected error — must be LAST

app.listen(config.port, () => { ... })
```

Every `app.use(...)` line adds one link to a chain that every request passes
through, top to bottom. That's the whole mental model: **a request enters at
the top, and each middleware either handles it, transforms it, or passes it
on with `next()`.**

**Route modules** (`server/src/routes/*.js`) are small Express `Router()`
instances — e.g. `orders.js` defines `POST /orders`, `GET /orders/:id`; they
get mounted onto the app with `app.use('/api', orderRoutes)`. Each handler is
wrapped in `asyncHandler` (see [`lib/errors.js`](../server/src/lib/errors.js))
so a thrown error or rejected promise is forwarded to `next(err)` automatically
— Express doesn't do that for `async` functions on its own, so this repo adds
a one-line helper rather than pulling in a dependency for it.

**Centralized errors:** every API error in this app has the same shape,
`{ error: 'some_code', message: 'human text' }`, with the right HTTP status.
That's enforced by one `errorHandler` middleware registered last — any route
can `throw badRequest(...)` / `throw notFoundError(...)` (from `lib/errors.js`)
and it's caught and formatted in exactly one place, instead of every route
formatting its own error responses.

**Static file serving:** in production, Express also serves the *built React
app* itself:
```js
if (config.isProd) {
  app.use(express.static(DIST_DIR, { index: false, maxAge: '1h' }))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  })
}
```
This means in production there's **one process, one origin** serving both
`/api/*` and the SPA's static files — no separate static-hosting service
needed, and the session cookie (same-origin) just works without CORS
gymnastics. In dev, Vite serves the frontend instead (see §7).

**Version in use:** `express@^4.19.2` (see [`server/package.json`](../server/package.json)).

---

## 4. BFF — the architecture pattern

**BFF = Backend-For-Frontend.** It's not a library or a framework — it's a
name for a specific role a backend plays: **a backend written for exactly
one frontend**, as opposed to a general-purpose API meant to serve many
different, unrelated clients.

**Why that distinction matters:** a generic public API has to be
defensive and generic — it can't assume much about who's calling it. A BFF
is the opposite: it's allowed to know *exactly* what its one frontend needs,
shape responses precisely for it, and own decisions that frontend should
never have to make itself.

**What Meridian's BFF specifically exists to do:**

1. **Hold secrets the browser must never see.** The Salesforce Connected App
   client secret, the session-signing key, and (if configured) the Stripe
   secret key all live only in `server/`'s environment — never shipped in
   any JS bundle. See `config.js` in §6.
2. **Enforce business rules the client can't be trusted with.** Order totals,
   discount math, and live stock checks are recomputed server-side on every
   checkout — the browser can send whatever cart it wants, the BFF is the
   only thing that decides the real price. (See `server/src/store/orders.js`.)
3. **Translate between "what the UI needs" and "what Salesforce has."** The
   React app never sees a Salesforce field name like `AccountId` or
   `PersonEmail` — it sees a clean shape like `{ orderId, status, items }`.
   That translation happens in `server/src/sf/mappers.js` and friends.
4. **Be swappable underneath.** Every route calls a `store/*.js` function,
   which internally branches on `DATA_SOURCE` — `mock` (in-memory data, for
   local dev with zero setup) or `salesforce` (a live org via jsforce). The
   *routes* and the *frontend* never know which one is active. This is what
   lets the whole app run fully offline for development and CI.

**The rule this enables:** *"only `server/src/sf/*.js` files are allowed to
know a Salesforce field name."* Everything above that layer — routes, the
store seam, the entire frontend — works with plain, storefront-shaped JSON.
That's the single architectural idea the whole codebase is organized around
(see [ARCHITECTURE.md §1](ARCHITECTURE.md)).

**Why not call Salesforce straight from the browser?** Two hard blockers:
Salesforce's OAuth Client Credentials flow requires a client secret, which
can never be embedded in browser-shipped code; and the browser would need to
be trusted with business logic (pricing, stock, permissions) it has no
business enforcing. The BFF is the only place both problems have one answer.

---

## 5. jsforce — the Salesforce client library

**What it is:** the Node.js SDK for Salesforce. It wraps Salesforce's REST,
SOAP, Streaming, Bulk, and Metadata APIs behind a JS client, so the BFF
doesn't hand-build raw HTTP calls, OAuth headers, or XML/SOAP envelopes.

**Where it's used — and *only* there:** every file under
[`server/src/sf/`](../server/src/sf/) (`orders.js`, `contacts.js`,
`catalog.js`, `cases.js`, `wishlist.js`, `addresses.js`, `reviews.js`,
`orderStream.js`, `setup-schema.js`, `seed.js`, `check.js`). Nowhere else in
the repo imports `jsforce` — that's the enforced boundary from §4.

**The five things jsforce is actually asked to do here:**

**a. Authenticate** — [`sf/client.js`](../server/src/sf/client.js). Meridian
performs the OAuth 2.0 **Client Credentials** flow itself (a plain `fetch`
POST to the org's token endpoint — no user login, no password, a
server-to-server credential exchange), then hands the resulting access token
to a `jsforce.Connection`:
```js
const conn = new jsforce.Connection({ instanceUrl, accessToken, version })
```
That `conn` object is what every other `sf/*.js` file uses. If a token
expires mid-request, `withConn()` catches the `INVALID_SESSION_ID` error,
re-authenticates once, and retries — so a stale token is invisible to
callers.

**b. Query data (SOQL)** — the most common usage, e.g. in `orders.js`:
```js
conn.query(`SELECT Id, OrderNumber, Status FROM Order WHERE AccountId = '${personAccountId}'`)
```
jsforce sends the SOQL over the REST API and parses the JSON response into
plain JS objects/arrays.

**c. Create / update / delete records** — jsforce's `sobject()` builder:
```js
conn.sobject('Account').create({ RecordTypeId, FirstName, LastName, PersonEmail })
conn.sobject('Order').update({ Id, Status: 'Activated' })
conn.sobject('Product2').update([{ Id, Stock__c: newQty }, ...]) // bulk array form
```
This is how signup creates a Person Account, checkout activates an order,
and stock is decremented/restored.

**d. Composite requests** — checkout creates an `Order` *and* its
`OrderItem` rows in a **single atomic call** via jsforce's composite request
builder (`orders.js`), so a failure partway through never leaves a
half-written order in the org.

**e. Streaming API (real-time)** — [`sf/orderStream.js`](../server/src/sf/orderStream.js):
```js
conn.streaming.createClient().subscribe('/data/OrderChangeEvent', handler)
```
This is the live order-tracking feature: jsforce's Streaming/CometD client
subscribes to Salesforce's **Change Data Capture** events, so when a
merchant edits an Order's Status in Salesforce, jsforce delivers that
change to the BFF — which relays it to the browser over Server-Sent Events.
See [ARCHITECTURE.md §4.9](ARCHITECTURE.md) for the full path.

**f. Metadata API (schema automation)** — [`sf/setup-schema.js`](../server/src/sf/setup-schema.js):
```js
conn.metadata.create('CustomField', [...])
conn.metadata.create('PlatformEventChannelMember', [...]) // enables Order CDC
```
This is what `npm run sf:setup` runs — it programmatically creates every
custom field/object this app needs and the permission set that grants
access to them, so a new org can be provisioned with one command instead of
a manual click-through of Setup.

**Version in use:** `jsforce@^3.5.0` (see [`server/package.json`](../server/package.json)).

---

## 6. Configuration reference

All server configuration is environment-variable driven and centralized in
one typed module: [`server/src/config.js`](../server/src/config.js). It
reads `process.env` once (via `dotenv/config`, which loads a local `.env`
file in dev — see below) and exports a single `config` object every other
file imports from. **Nothing reads `process.env` directly outside this
file** — that's deliberate, so every setting has one documented home.

### 6.1 Where `.env` lives, and why it's not committed

`server/.env` (git-ignored) holds real values in dev;
[`server/.env.example`](../server/.env.example) is the checked-in template
with every variable documented inline. Copy one to the other to get started:
```
cp server/.env.example server/.env
```
In production, these are set as real environment variables on the host
(Render, Docker, etc. — see [DEPLOYMENT.md](DEPLOYMENT.md)), not a file.

### 6.2 Full environment variable reference

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8787` | Port the BFF listens on. Vite's dev proxy (§7) targets this. |
| `APP_ORIGIN` | `http://localhost:5173` | Allowed CORS origin — must match where the frontend is served. |
| `NODE_ENV` | *(unset)* | `production` makes the BFF also serve the built SPA from `dist/` (§3) and enables the production config guard (§6.4). |
| `PUBLIC_URL` | falls back to `APP_ORIGIN` | Public site origin, used for absolute sitemap/canonical URLs. |
| `CACHE_TTL_SECONDS` | `60` | How long product reads are cached (`lib/cache.js`) — keeps the app under Salesforce API limits. |
| `DATA_SOURCE` | `mock` | `mock` = in-repo fake data, zero setup. `salesforce` = a live org via jsforce. The single switch the whole `store/` layer branches on. |
| `SF_LOGIN_URL` | `https://test.salesforce.com` | Salesforce My Domain host for the OAuth token request. Sandbox vs. production/Developer Edition use different hosts — see [SALESFORCE_SETUP.md](SALESFORCE_SETUP.md). |
| `SF_CLIENT_ID` / `SF_CLIENT_SECRET` | *(empty)* | Connected App credentials for the Client Credentials OAuth flow. Required when `DATA_SOURCE=salesforce`; validated by `assertSalesforceConfig()` (§6.4). |
| `SF_API_VERSION` | `61.0` | REST/SOQL API version used for every Salesforce call. |
| `SF_ACCOUNT_NAME` | `Meridian Web Orders` | The shared Account guest checkouts attach to (see [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for the Person Account model registered shoppers use instead). |
| `PAYMENT_PROVIDER` | `mock` | `mock` simulates a charge offline (test cards documented in `.env.example`). `stripe` uses real Stripe test-mode PaymentIntents (needs the two Stripe keys below + `npm i stripe`). |
| `PAYMENT_CURRENCY` | `usd` | Currency code passed to the payment provider. |
| `STRIPE_SECRET_KEY` | *(empty)* | Server-side only — never exposed to the browser. |
| `STRIPE_PUBLISHABLE_KEY` | *(empty)* | Safe to expose — used client-side to mount Stripe Elements. |
| `SESSION_SECRET` | insecure dev default | Signs the shopper's session JWT. **Must** be a long random string in production — the app refuses to boot with the default in `NODE_ENV=production` (§6.4). |
| `SESSION_TTL_DAYS` | `30` | How many days a login session lasts. |
| `COOKIE_SECURE` | `false` | Set `true` only behind HTTPS — marks the session cookie `Secure`. |
| `VITE_BFF_ORIGIN` *(frontend)* | `http://localhost:8787` | Read by `vite.config.js` (not `config.js`) — where Vite's dev proxy forwards `/api` and `/sitemap.xml` requests. |
| `E2E_PORT` *(test-only)* | `8799` | Read by `playwright.config.js` — port the E2E build runs on, kept separate from the normal dev port. |

### 6.3 How the config is *used*, not just defined

A few examples of `config.*` flowing into real behavior:

- `config.dataSource === 'salesforce'` gates: whether `store/*.js` calls
  `sf/*.js` or the in-memory mock, whether the CDC subscriber starts at all
  (`index.js`), and whether the mock-only `routes/dev.js` dev-trigger routes
  are mounted (they're **never** mounted in Salesforce mode — see `index.js`,
  `if (config.dataSource === 'mock') { ...mount dev routes... }`).
- `config.session.secret` signs every session JWT (`lib/session.js`); the
  cookie is named from `config.session.cookieName` (`meridian_session`) and
  its `Secure` flag comes straight from `config.session.secure`.
- `config.payment.provider` selects which module `server/src/pay/index.js`
  delegates to at checkout time.
- `config.isProd` decides both the static-file-serving branch in `index.js`
  (§3) and whether `morgan` request logging is attached at all (dev only).

### 6.4 Fail-fast guards

Two functions in `config.js` are called at boot and throw *before* the
server starts accepting traffic, rather than failing confusingly later:

- **`assertProductionConfig()`** — refuses to start in `NODE_ENV=production`
  if `SESSION_SECRET` is still unset or looks like the insecure placeholder
  (matches `/change-me|dev-only/i`). This exists specifically so a real
  deployment can never accidentally run with a guessable session-signing key.
- **`assertSalesforceConfig()`** — when `DATA_SOURCE=salesforce`, checks
  `SF_LOGIN_URL` / `SF_CLIENT_ID` / `SF_CLIENT_SECRET` are all present and
  throws a specific "missing: X, Y" error naming exactly what's absent,
  rather than letting the first Salesforce call fail with an opaque OAuth
  error.

### 6.5 Frontend build config — `vite.config.js`

[Vite](https://vite.dev) is the frontend's dev server and production
bundler (`react` + `react-dom` + `react-router-dom` on top of it — see the
root [`package.json`](../package.json)). Its one piece of custom
configuration is a **dev-only proxy**:
```js
server: {
  proxy: {
    '/api': { target: process.env.VITE_BFF_ORIGIN || 'http://localhost:8787', changeOrigin: true },
    '/sitemap.xml': { target: process.env.VITE_BFF_ORIGIN || 'http://localhost:8787', changeOrigin: true },
  },
}
```
In dev, the frontend (`localhost:5173`) and the BFF (`localhost:8787`) are
two separate processes on two separate ports. Without this proxy, the
browser's `fetch('/api/...')` calls would need CORS and the session cookie
would be cross-origin (fragile). The proxy makes them **appear** same-origin
to the browser — Vite silently forwards `/api/*` requests to the real BFF
port. In production there's no proxy needed at all, because Express serves
both the API and the built SPA from the one process (§3).

### 6.6 Linting — `.oxlintrc.json`

The project uses [oxlint](https://oxc.rs/), a Rust-based linter (much
faster than ESLint, API-compatible enough for this project's needs), run
via `npm run lint`. Config is minimal and React-specific:
```json
{
  "plugins": ["react", "oxc"],
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```
`rules-of-hooks` is an error (catches real bugs — hooks called
conditionally); `only-export-components` is a warning (a React Fast Refresh
best-practice, not a correctness issue), with constant exports (e.g. a
small config object alongside a component) explicitly allowed.

### 6.7 End-to-end tests — `playwright.config.js`

[Playwright](https://playwright.dev) drives a real Chromium browser against
a real running instance of the app. The key design choice: it runs against
**the actual production artifact** — `npm run build` output, served by the
real Express server, in `DATA_SOURCE=mock` / `PAYMENT_PROVIDER=mock`:
```js
webServer: {
  command: `npm run build && NODE_ENV=production DATA_SOURCE=mock PAYMENT_PROVIDER=mock SESSION_SECRET=e2e-only-secret-not-for-prod PORT=${PORT} node server/src/index.js`,
  url: baseURL,
  timeout: 120_000,
}
```
That means the suite is **hermetic** — no live Salesforce org or Stripe
account needed to run it — while still testing the exact bundle and server
code path that would ship. It runs on a dedicated port (`E2E_PORT`, default
`8799`) so it never collides with a dev server on `8787`/`5173`. See
[ARCHITECTURE.md](ARCHITECTURE.md) for what the individual `e2e/*.spec.js`
files cover.

### 6.8 CI — `.github/workflows/ci.yml`

Runs on every push to `main` and every pull request. One job, in order:
`npm ci` (both root and `server/`) → `npm run lint` → `npm run build` →
install a Playwright-managed Chromium → `npm run test:e2e` → upload the
Playwright HTML report as a build artifact (kept 7 days, uploaded even if a
step fails, via `if: ${{ !cancelled() }}`). Nothing in CI touches a live
Salesforce org — it's the same hermetic mock-mode build described in §6.7.

### 6.9 Security middleware, explained

Two more pieces of `index.js` worth calling out explicitly, since they're
config as much as they are code:

- **`helmet`** — sets a battery of security-related HTTP response headers in
  one call. This app configures its **Content-Security-Policy** explicitly
  (`defaultSrc 'self'`, allowing only same-origin scripts/styles plus
  `data:` images/fonts for the theme system, and `frameAncestors 'none'` to
  block clickjacking) rather than accepting Helmet's generic default.
- **`cors`** — configured with `origin: config.appOrigin, credentials: true`,
  meaning only the one configured frontend origin may call the API *with*
  cookies attached. This is what makes the session cookie usable
  cross-port in dev (§6.5's proxy) while staying locked down in production.

---

## 7. Putting it together — one request, start to finish

To make all of the above concrete, here's exactly what happens when a
logged-in shopper's browser loads their order history, in Salesforce mode:

1. **Browser** — `src/api/store.js`'s `getMyOrders()` calls
   `fetch('/api/account/orders', { credentials: 'include' })`.
2. **Vite proxy** (dev only) — forwards `/api/account/orders` to the BFF at
   `VITE_BFF_ORIGIN` unchanged; the browser never knows there are two ports.
3. **Express middleware chain** — `helmet` → `cors` (checks the request's
   origin against `APP_ORIGIN`) → `express.json()` → `cookieParser()` →
   route matching finds `GET /account/orders` in `routes/account.js`.
4. **Auth middleware** — `requireAuth` (from `lib/session.js`) verifies the
   session JWT from the cookie; attaches `req.user`, or responds `401`.
5. **Route → store seam** — the handler calls `store/orders.listOrders(user)`,
   which checks `config.dataSource` and, since it's `salesforce`, calls
   `sf/orders.listOrdersForContact(user.id)`.
6. **jsforce** — builds and sends a SOQL query over the Salesforce REST API
   via the authenticated `conn`, using the cached OAuth token from
   `sf/client.js` (re-authenticating once, transparently, if it had expired).
7. **Mapping** — `sf/mappers.js` turns raw Salesforce field names
   (`OrderNumber`, `Status`, `AccountId`, …) into the clean shape the
   frontend expects (`{ orderId, status, items, … }`) — this is the BFF
   boundary from §4 in action.
8. **Response** — the route handler `res.json(...)`s that shape back through
   the same middleware chain (now running in reverse for response headers)
   to the browser.

Every layer in that chain is one of the concepts covered above: Node.js runs
the process, Express is the framework structuring steps 3–4 and 8, the "BFF"
label describes what step 5–7 are doing conceptually, and jsforce is what
step 6 is built on.

---

## Related docs
- [ARCHITECTURE.md](ARCHITECTURE.md) — the file-by-file map and every
  cross-cutting feature (theming, discovery, promos, real-time, etc.)
- [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) — how each feature's data flows
  through Salesforce, plus the full org inventory and API reference
- [SALESFORCE_CONVENTIONS.md](SALESFORCE_CONVENTIONS.md) — the
  standard-fields-first rule and why each custom field/object exists
- [SALESFORCE_SETUP.md](SALESFORCE_SETUP.md) — connecting a real org from
  scratch (Connected App, OAuth, `npm run sf:setup`)
- [DEPLOYMENT.md](DEPLOYMENT.md) — hosting, environment variables in
  production, Docker, Render
