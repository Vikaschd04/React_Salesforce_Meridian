# PHASE_2_BFF.md — Node backend-for-frontend

Goal: a small Express server that the front end talks to, still using mock data,
so the contract is proven before Salesforce is involved.

## Scope
- New `/server` folder: Express + `jsforce` (installed now, used in Phase 3).
- Endpoints (see ARCHITECTURE §API surface):
  - `GET /api/products`, `GET /api/products/:id`
  - `POST /api/orders` (validate cart, compute total server-side — never trust
    client prices), `GET /api/orders/:id`.
- Server-side product source is a mock module for now (mirrors the front end's).
- Config via `dotenv`; `.env` git-ignored; `.env.example` committed.
- Typed JSON error responses `{ error, message }`; proper status codes.
- Basic hardening: `helmet`, input validation, CORS locked to the app origin.
- Simple in-memory cache for product reads (prep for Salesforce API limits).

## Wire the front end to the BFF
- Update `src/api/store.js` to `fetch('/api/...')`.
- Add a Vite dev proxy so `/api` → `http://localhost:<bff-port>`.
- Delete the front-end mock data path once the BFF works.

## Acceptance criteria
- [ ] `GET /api/products` returns the catalog; the React app renders it.
- [ ] `POST /api/orders` recomputes the total server-side and rejects mismatched
      or empty carts.
- [ ] Front end works end-to-end through the BFF with no direct mock imports.
- [ ] No secrets in the repo; `.env.example` lists every required key.
- [ ] Server starts with one command and has a `/health` endpoint.

## Out of scope here
Real Salesforce calls (Phase 3), auth/payments (Phase 4).
