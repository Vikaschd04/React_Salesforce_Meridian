# ARCHITECTURE.md — Meridian

## Shape
```
Browser (React SPA, Vite)
        │  HTTPS, JSON, session cookie (httpOnly)
        ▼
Node BFF (Express + jsforce)   ← holds all secrets, manages Salesforce tokens
        │  HTTPS, OAuth 2.0
        ▼
Salesforce (sandbox → prod)    ← products, orders, business logic
```

## Why a BFF (backend-for-frontend)
The browser must never hold Salesforce client secrets or long-lived tokens. The
BFF is the security boundary: it authenticates to Salesforce, refreshes tokens,
shapes responses for the UI, and exposes a small, clean `/api`. It also lets us
cache and rate-limit against Salesforce API limits.

## The one swap point
All UI data access lives in `src/api/store.js`. It evolves in three steps
without the pages changing:
1. Phase 1 — returns mock data.
2. Phase 2/3 — calls the BFF (`fetch('/api/...')`).
3. BFF calls Salesforce.

## API surface (BFF)
- `GET  /api/products` — list active products
- `GET  /api/products/:id` — one product
- `POST /api/orders` — create an order from cart items
- `GET  /api/orders/:id` — order status (Phase 4: scoped to the shopper)
- Auth + payment routes added in Phase 4.

## Salesforce integration
- Products: standard `Product2` (+ `PricebookEntry`) or a custom object — decide
  in Phase 3.
- Orders: standard `Order`/`OrderItem` objects, or custom — decide in Phase 3.
- Auth: server-to-server via **Client Credentials** or **JWT Bearer** flow
  (no interactive user login for the integration account). Shopper login is a
  separate concern handled in the BFF (Phase 4).

## Environments
- Salesforce: Developer sandbox (build) → Full/Partial sandbox (staging) → prod.
- App hosting (Phase 4): static front end on a CDN host; BFF on a Node host;
  environment variables per environment.

## Cross-cutting
- Secrets only in `/server/.env` (git-ignored). `.env.example` documents keys.
- CORS handled at the BFF. Front end talks only to same-origin `/api` via a
  dev proxy locally and same host in prod.
- Errors: BFF returns typed JSON errors; UI shows friendly messages.
