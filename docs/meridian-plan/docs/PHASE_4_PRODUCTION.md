# PHASE_4_PRODUCTION.md — retrospective

**Status: complete.** Current status of everything this phase touches:
[`docs/DEVELOPER_GUIDE.md` §13](../../DEVELOPER_GUIDE.md) (security posture)
and [`docs/DEPLOYMENT.md`](../../DEPLOYMENT.md) (hosting).

## What was originally scoped
Turn the working app into something safe to put in front of real customers,
as independently-shippable sub-steps: shopper accounts + guest checkout,
payments (Stripe), tests, CI/CD, security hardening, performance/SEO, and
deployment.

## What actually shipped, per sub-step

**Shopper accounts.** The plan flagged the auth provider as an
expensive-to-reverse decision to make with the owner (Auth0/Clerk was one
option under consideration). What shipped instead: shoppers as Salesforce
`Contact` records, bcrypt-hashed passwords, and signed JWT sessions in an
httpOnly cookie — no third-party auth provider. Simpler, no external
dependency, and it composed cleanly with the later B2B work (a `Contact`
already had everything needed to add `AccountId`).

**Payments.** The plan described Stripe Checkout or PaymentIntents via the
BFF with webhook verification, marking the Salesforce Order paid only on a
confirmed webhook. What shipped: a **provider seam**
(`server/src/pay/index.js`) — `PAYMENT_PROVIDER=mock` by default (a fully
offline simulated charge, so checkout works with zero third-party accounts)
or `PAYMENT_PROVIDER=stripe` for real test-mode PaymentIntents, switchable by
one env var. Simpler than the original webhook design and, notably, the
*mock* path became permanent infrastructure rather than a throwaway — it's
what makes the whole app (and CI) runnable with no external accounts.

**Tests.** Playwright E2E, run against **mock mode** specifically so the
suite is hermetic (no live Salesforce/Stripe credentials needed) —
`e2e/checkout.spec.js` and `e2e/account.spec.js`. No Vitest/unit-test layer
was added on top.

**CI/CD.** GitHub Actions (`.github/workflows/ci.yml`) running lint, build,
and the Playwright suite on every push/PR — using no secrets, since
everything runs in mock mode.

**Security hardening.** Server-side recomputation of every price/total/
discount, `helmet`, CORS locked to `APP_ORIGIN`, `zod` input validation on
every route, and a production-mode guard that **refuses to start** with an
unset or default `SESSION_SECRET`.

**Performance/SEO.** Client-rendered per-route meta/OG tags + JSON-LD
structured data + a catalog-driven `/sitemap.xml` + `robots.txt`. No
SSR/prerendering — the plan left this open-ended and it was consciously not
pursued, since Google and other major crawlers execute JS.

**Deployment.** One Node process serves both the built SPA and `/api`
(same-origin, so the session cookie needs no CORS workaround) — a
`Dockerfile` for any container host and a `render.yaml` blueprint that
deploys immediately in mock mode with zero secrets to configure on first
deploy. Two real deploy bugs were hit and fixed along the way: a
`NODE_ENV=production` build failing because `npm ci` skips devDependencies
(so `vite` wasn't installed for the build step), and a blueprint with
unfilled required env vars blocking the first deploy.

## What happened after this phase
Nothing in the original plan anticipated B2B company accounts, catalog
discovery/search, promo codes, or theming — all landed as organic feature
work after Phase 4 shipped, using the same verify → commit → document loop
this phase established. See
[`docs/meridian-plan/docs/PROJECT_SPEC.md`](PROJECT_SPEC.md) for the complete
current feature set.
