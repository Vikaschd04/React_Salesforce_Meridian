# PHASE_1_REACT.md — retrospective

**Status: complete**, and substantially exceeded in scope. Current status of
everything this phase touches: [`docs/ARCHITECTURE.md` §2](../../ARCHITECTURE.md).

## What was originally scoped
A React storefront (Vite) with a modern, distinctive design. Browse → product
detail → cart → checkout → confirmation, running entirely on mock data behind
a single data-layer module (`src/api/store.js`) so the backend could be
swapped in later without touching pages. Design goals: a real visual identity
(not generic), bundled local product photography, mobile-responsive,
accessible (keyboard focus, `prefers-reduced-motion`).

## What actually shipped
Everything above, plus features never scoped for Phase 1 at all — added
organically once the backend existed and the storefront needed to feel
complete:

- **Dark/light theming** — a full token-driven theme system with no
  flash-of-wrong-theme on load, not part of the original Phase 1 design plan.
- **Catalog discovery** — search with typeahead, roast/origin/price filters,
  and sort, all URL-synced (`Shop.jsx` + `ShopControls.jsx` +
  `SearchSuggest.jsx`). The original scope was a plain grid.
- **Account pages** — profile, order history, order detail with a fulfillment
  timeline, and (after the B2B phase) a company order-history tab. None of
  this existed in Phase 1's original scope, which was guest-only browsing.
- **Payment UI** (`PaymentFields.jsx`), **promo code entry**
  (`PromoInput.jsx`), and **SEO** (`useSeo.js`, `JsonLd.jsx`) all landed as
  front-end work in later phases but live in the same `src/` tree this phase
  established.

## What stayed exactly as planned
The core architectural decision — **one data-access module, no page ever
calls `fetch` directly** — held for the entire life of the project and is
still the rule today (`src/api/store.js`; see
[`docs/ARCHITECTURE.md` §2.2](../../ARCHITECTURE.md)). Every later phase (BFF,
Salesforce, B2B) plugged in behind this seam with zero changes to any page
component.
