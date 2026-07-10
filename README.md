# Meridian — Single-Origin Coffee Storefront

A production-bound e-commerce storefront for a single-origin coffee roaster.
React SPA (Vite) → Node BFF → Salesforce, built in four phases.

**Phase 1 (this build):** a polished, responsive React storefront running on
mock data behind one swappable data-layer module. Browse → product detail →
cart → checkout → confirmation, with zero backend.

## Run it

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # production build to dist/
npm run preview  # preview the production build
npm run lint     # oxlint
```

Requires Node 18+.

## The data-layer swap point

All UI data access goes through **one** module: [`src/api/store.js`](src/api/store.js).
Pages and components never touch the catalog or a backend directly — they only
call `getProducts()`, `getProduct(id)`, and `placeOrder(items)` from the store.

This is deliberate. The store module evolves across phases **without the pages
changing**:

1. **Phase 1 (now):** returns mock data from `src/data/products.js` behind a
   small simulated latency.
2. **Phase 2/3:** the same functions call the BFF via `fetch('/api/...')`.
3. The BFF calls Salesforce.

Because every store function is already `async`, swapping the implementation is
isolated to this file (plus the server). A `/api` dev proxy is pre-wired in
[`vite.config.js`](vite.config.js) for when the BFF arrives.

> Enforced rule: only `src/api/store.js` may import from `src/data/`.

## Design

Cartographic / editorial system — "Meridian" = lines of longitude. The
signature element is each coffee's **origin coordinates** rendered in monospace
on a gold "meridian" hairline, on every card and detail page. Product art is
generated topographic-contour SVG seeded from each origin's coordinates (no
stock photos, nothing to 404). Design tokens live in
[`src/styles/tokens.css`](src/styles/tokens.css).

- Type: Fraunces (display) · Space Grotesk (body) · Space Mono (coordinates),
  bundled via `@fontsource` (no runtime CDN).
- Quality floor: mobile-responsive, visible `:focus-visible`, respects
  `prefers-reduced-motion`, semantic HTML.

## Structure

```
src/
  api/store.js         # the ONLY data-access module (swap point)
  data/products.js     # mock catalog (imported only by store.js)
  context/CartContext  # cart state (Context) + localStorage persistence
  lib/                 # money.js (cents→display), geo.js (coordinate labels)
  components/          # Navbar, ProductCard, BagArt, CoordTag, QtyStepper, states…
  pages/               # Catalog, ProductDetail, Cart, Confirmation, NotFound
  styles/              # tokens.css, global.css, app.css
```

## Conventions

- Money is stored as **integer cents**; formatted only at display time via
  `formatCents`.
- Every data-fetching screen handles loading and error states.
- No secrets in front-end code (none exist in Phase 1).

## Roadmap

- **Phase 2** — Node BFF (Express + jsforce) exposing `/api`, still on mock data.
- **Phase 3** — Connect to a Salesforce sandbox (products + orders).
- **Phase 4** — Shopper auth, Stripe payments, tests, CI/CD, deployment.
