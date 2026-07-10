# PROJECT_SPEC.md — Meridian

## What it is
An e-commerce storefront for a small single-origin coffee roaster. Customers
browse coffees, view details, add to a cart, and check out. Built to grow from a
learning project into a real, deployable product.

## Users
- **Shopper** (primary): browses and buys. No login needed to browse; account
  optional until checkout (guest checkout allowed).
- **Store operator**: manages products and views orders — via Salesforce
  directly (no custom admin UI in early phases).

## Core features (Phases 1–3)
- Product catalog (grid) with roast level, origin, tasting notes, price.
- Product detail page with description and add-to-cart.
- Cart: add, remove, change quantity, see total.
- Checkout that creates an order and shows a confirmation.

## Market-ready features (Phase 4)
- Shopper accounts + guest checkout.
- Real payments (Stripe).
- Order history for logged-in shoppers.
- Inventory/stock awareness.
- Transactional emails (order confirmation).
- Analytics, SEO, performance budget.

## Data model (conceptual — maps to Salesforce in Phase 3)
- **Product**: id, name, origin, roast (Light/Medium/Dark), priceCents,
  tastingNotes, description, image, active, stock.
- **Order**: id, shopper (or guest email), status, createdAt, totalCents.
- **OrderItem**: order, product, qty, unitPriceCents.

## Non-goals (for now)
- Multi-vendor / marketplace features.
- Subscriptions/recurring orders (could be a later phase).
- A custom admin dashboard (Salesforce is the admin).

## Success criteria
A shopper can go from landing page to confirmed, paid order; the order appears
in Salesforce; the app is deployed on a public URL and passes basic Lighthouse
and accessibility checks.
