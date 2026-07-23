# PHASE_2_BFF.md — retrospective

**Status: complete**, and substantially exceeded in scope. Current status of
everything this phase touches: [`docs/ARCHITECTURE.md` §3](../../ARCHITECTURE.md).

## What was originally scoped
A small Express server (`/server`) the front end talks to — still on mock
data, so the client↔server contract was proven before Salesforce entered the
picture. Planned surface: `GET /api/products`, `GET /api/products/:id`,
`POST /api/orders` (server-side total computation, client prices never
trusted), `GET /api/orders/:id`. Basic hardening (`helmet`, input validation,
CORS locked to the app origin) and a mock product module mirroring the front
end's.

## What actually shipped
The original four endpoints, plus an API surface roughly four times larger —
every one of these was added in a later phase, none was part of the Phase 2
plan:

- **Auth & accounts**: `/api/auth/signup|login|logout|me`,
  `/api/account/profile`, `/api/account/orders[/:id]`,
  `/api/account/orders/:id/cancel`, `/api/account/company/orders`.
- **Commerce extras**: `/api/promo/validate`, `/api/payment-config`.
- **Support**: `/api/support` (creates a Salesforce `Case`).
- **Infra**: `/sitemap.xml`, `/health`.

Full current reference: [`docs/DEVELOPER_GUIDE.md` §12](../../DEVELOPER_GUIDE.md).

The **store-layer swap pattern** (`server/src/store/*.js` branching on
`DATA_SOURCE`) that this phase established for `catalog.js` scaled cleanly to
every later module (`orders.js`, `auth.js`, `companies.js`,
`promos.js`, `support.js`) with the exact same shape — this was the one
architectural bet from Phase 2 that paid off unchanged for the rest of the
project.

## What changed from the original plan
The original mock product module was meant to be temporary scaffolding,
replaced once Salesforce arrived. Instead, `server/src/data/products.js`
became a **permanent, load-bearing file** — it's both the mock catalog *and*
the seed source of truth (`npm run seed` reads it to populate Salesforce),
which wasn't the original intent but turned out to be the right call: mock
and live data start out identical, and the whole app stays runnable offline
indefinitely rather than mock mode being a disposable bootstrap phase.
