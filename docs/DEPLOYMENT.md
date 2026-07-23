# Deploying Meridian

Meridian ships as **one Node service**: the Express BFF serves the built React
SPA (`dist/`) **and** the `/api` routes on a single origin. Same-origin keeps the
httpOnly session cookie simple and avoids CORS in production.

```
browser ──▶  Node/Express (one origin)
                ├── GET /            → dist/index.html (SPA, deep-link fallback)
                ├── GET /assets/*    → static build output
                ├── GET /sitemap.xml → generated from the live catalog
                └── /api/*           → BFF (catalog, orders, auth, …)
```

## Build & run (any host)
```bash
npm ci --include=dev         # root deps incl. vite (--include=dev in case
                             # NODE_ENV=production, which otherwise skips devDeps)
npm run build                # → dist/
npm --prefix server ci --omit=dev
NODE_ENV=production node server/src/index.js
```
`NODE_ENV=production` is what makes the server serve `dist/` + the SPA fallback.
Convenience: `npm run serve` (build + start) for a local prod smoke test.

## Environment
Set these in the host's environment (never commit real secrets):

| Var | Required | Notes |
|-----|----------|-------|
| `NODE_ENV` | yes | `production` (enables static serving) |
| `PORT` | host-set | the platform injects it; falls back to 8787 |
| `PUBLIC_URL` | recommended | public origin, used for sitemap/canonical URLs |
| `SESSION_SECRET` | **yes** | long random string; the server **refuses to start** in prod with the dev default |
| `COOKIE_SECURE` | yes | `true` (cookies over HTTPS) |
| `DATA_SOURCE` | yes | `mock` or `salesforce` |
| `PAYMENT_PROVIDER` | yes | `mock` or `stripe` |
| `SF_LOGIN_URL`, `SF_CLIENT_ID`, `SF_CLIENT_SECRET`, `SF_ACCOUNT_NAME` | if `salesforce` | see [SALESFORCE_SETUP.md](SALESFORCE_SETUP.md) |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` | if `stripe` | also `npm i stripe` |

Start in **mock/mock** to verify the deploy, then flip `DATA_SOURCE=salesforce`
and/or `PAYMENT_PROVIDER=stripe` once those secrets are in place.

## Docker
```bash
docker build -t meridian .
docker run -p 8787:8787 \
  -e NODE_ENV=production \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  -e COOKIE_SECURE=true \
  -e DATA_SOURCE=mock -e PAYMENT_PROVIDER=mock \
  meridian
```
The multi-stage [Dockerfile](../Dockerfile) builds the SPA, then runs the BFF
with production-only server deps and the built `dist/`.

## Render (blueprint)
[`render.yaml`](../render.yaml) defines a single web service and **deploys
immediately in mock mode** — no secrets to fill on the first deploy
(`SESSION_SECRET` is auto-generated; health check is `/health`). In Render:
**New + → Blueprint**, point it at the repo, Apply.

To **go live**, open the service → **Environment**, add the vars, and redeploy:
`PUBLIC_URL` (your `…onrender.com` URL), `DATA_SOURCE=salesforce` + `SF_LOGIN_URL`
/ `SF_CLIENT_ID` / `SF_CLIENT_SECRET` / `SF_ACCOUNT_NAME`, and (for real payments)
`PAYMENT_PROVIDER=stripe` + `STRIPE_*`.

Node is pinned via [`.node-version`](../.node-version) (22). The same shape works
on Railway, Fly, or any container host (build command + `node server/src/index.js`).

## Notes
- **SEO** is client-rendered (per-route meta + JSON-LD) plus a catalog-driven
  `/sitemap.xml` and `robots.txt`. If you need guaranteed crawler HTML, add SSR
  or prerendering later (out of scope here).
- **CI** ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) lints, builds,
  and runs the Playwright E2E suite in mock mode on every push/PR — no secrets.
