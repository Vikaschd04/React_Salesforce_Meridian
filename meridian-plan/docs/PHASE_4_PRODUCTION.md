# PHASE_4_PRODUCTION.md — market-ready

Goal: turn the working app into something safe to put in front of real
customers. Tackle as sub-steps; each is independently shippable.

## 4a. Shopper accounts + guest checkout
- Email/password or a provider (e.g. Auth0/Clerk) — decide with the owner
  (this is an expensive-to-reverse choice; ASK).
- Sessions via httpOnly, secure cookies handled by the BFF. Never store tokens
  in localStorage.
- Guest checkout: collect email only; still create the Salesforce Order.

## 4b. Payments (Stripe)
- Stripe Checkout or Payment Intents via the BFF. Client secret never leaves
  the server. Verify webhooks. Mark the Salesforce Order paid only on the
  confirmed webhook, not on client redirect.
- Compute all amounts server-side.

## 4c. Testing
- Vitest unit tests for the data layer, cart logic, and BFF handlers.
- Playwright e2e for the core purchase flow.
- Target meaningful coverage on money/order paths, not a blanket %.

## 4d. CI/CD
- GitHub Actions: install → lint → build → test on every PR.
- Separate deploy workflow to staging then production.

## 4e. Deployment
- Front end: static host/CDN (e.g. Vercel/Netlify/Cloudflare).
- BFF: a Node host (e.g. Render/Fly/Railway/a container).
- Env vars per environment; point staging at a Salesforce sandbox, prod at prod.

## 4f. Security & hardening
- `helmet`, rate limiting, input validation, dependency audit.
- Secrets in the host's secret manager, not in the repo.
- CSP, HTTPS everywhere, CSRF protection on state-changing routes.

## 4g. Performance, SEO, a11y
- Code-split routes; lazy-load images; set a performance budget.
- Meta tags, Open Graph, sitemap, semantic markup.
- Pass Lighthouse (perf/a11y/SEO) and an axe accessibility check.

## 4h. Ops & polish
- Error monitoring (e.g. Sentry) and basic analytics.
- Transactional order-confirmation email.
- Legal pages: privacy, terms, returns.

## Acceptance criteria
- [ ] A real (test-mode) payment produces a paid Salesforce Order via webhook.
- [ ] Logged-in shopper can see order history; guest checkout works.
- [ ] CI runs lint/build/test on PRs; deploys are automated.
- [ ] App is live on a public URL over HTTPS.
- [ ] Lighthouse and accessibility checks pass at an agreed threshold.
- [ ] No secret is present anywhere in the repository history.
