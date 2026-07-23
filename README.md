# Meridian — Single-Origin Coffee Storefront

A production-ready e-commerce storefront for a single-origin coffee roaster:
**React SPA (Vite) → Node BFF (Express) → Salesforce** (system of record for
products, orders, and shopper accounts).

Browse → filter/search → product detail → cart → checkout (payment) →
confirmation → account (order history, B2B company team-order history) —
backed by real Salesforce `Product2`/`Order`/`Contact`/`Account` records, with
dark/light theming, promo codes, and SEO throughout.

**→ For a full file-by-file map of how everything is wired together, see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).** That's the doc to read first.

## Run it

```bash
# Front end
npm install
# BFF
cd server && npm install && cp .env.example .env && cd ..

npm run dev:all      # web :5173 + BFF :8787, both mock (no Salesforce needed)
npm run build        # production build to dist/
npm run lint         # oxlint
npm run test:e2e     # Playwright E2E suite (mock mode)
```

Requires Node 18+ (22 pinned for deployment — see `.node-version`). The app
runs fully offline out of the box: `DATA_SOURCE=mock` and
`PAYMENT_PROVIDER=mock` are the defaults, so no Salesforce org or Stripe
account is required to develop or run the E2E suite.

To connect a real Salesforce org, follow
[server/docs/SALESFORCE_SETUP.md](server/docs/SALESFORCE_SETUP.md), then set
`DATA_SOURCE=salesforce` in `server/.env`.

## Architecture, one seam per layer

```
Browser → React SPA → src/api/store.js (the ONLY module that calls fetch)
            │  same-origin  fetch('/api/...')
            ▼
          Node BFF (Express) → server/src/store/*.js (mock ⇄ Salesforce switch)
            │  OAuth Client Credentials + jsforce
            ▼
          Salesforce (Product2, Order, Contact, Account, Case)
```

Every layer has exactly one seam where the next layer can be swapped without
touching anything upstream — which is also what makes the app runnable
end-to-end with zero external dependencies. Full detail:
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Docs

| Doc | What's in it |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | File-by-file map: every frontend/backend file, cross-cutting systems (theming, discovery, promos, payments, SEO, testing/CI), git workflow, deployment |
| [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) | Salesforce data flows (catalog, checkout, accounts, B2B), the full org inventory, and the API reference |
| [docs/SALESFORCE_CONVENTIONS.md](docs/SALESFORCE_CONVENTIONS.md) | The standard-fields-first rule and every custom field's justification |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Hosting, environment variables, Docker, Render |
| [server/docs/SALESFORCE_SETUP.md](server/docs/SALESFORCE_SETUP.md) | One-time checklist to connect a Salesforce org from scratch |

## Design

Cartographic / editorial system — "Meridian" = lines of longitude. The
signature element is each coffee's **origin coordinates** rendered in
monospace on a gold hairline, on every card and detail page. Fully
light/dark-themed (design tokens in
[`src/styles/tokens.css`](src/styles/tokens.css)); type is Fraunces (display),
Space Grotesk (body), Space Mono (coordinates), bundled via `@fontsource` —
no runtime CDN.

## Conventions

- **One data-access module**: only `src/api/store.js` calls `fetch`; only
  `server/src/store/*.js` decides mock vs. Salesforce; only
  `server/src/sf/*.js` knows a Salesforce field's API name.
- Money is stored as **integer cents** everywhere, formatted only at display
  time (`src/lib/money.js`); every price/discount/total is recomputed
  **server-side** from trusted Salesforce data — the client never sets a
  price.
- Every data-fetching screen handles loading and error states.
- **No secrets in front-end code, ever.** Secrets live only in
  `server/.env` (git-ignored) or the hosting platform's environment
  variables.
- Salesforce work prefers **standard objects/fields**; a custom field is
  added only when no standard equivalent exists, and the reason is recorded
  in [docs/SALESFORCE_CONVENTIONS.md](docs/SALESFORCE_CONVENTIONS.md).
