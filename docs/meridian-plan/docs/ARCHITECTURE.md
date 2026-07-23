# ARCHITECTURE.md — how the architecture evolved (historical)

> **This is not the current architecture map.** That's
> [`docs/ARCHITECTURE.md`](../../ARCHITECTURE.md) (repo-root `docs/`, one
> level up from this folder) — a living, detailed file-by-file reference kept
> in sync with the code. This file stays here only to record how the shape
> that was originally planned compares to what actually got built, and to
> point you at the current doc so the two never have to be kept in sync by
> hand.

## What was originally planned

```
Browser (React SPA, Vite)
        │  HTTPS, JSON, session cookie (httpOnly)
        ▼
Node BFF (Express + jsforce)   ← holds all secrets, manages Salesforce tokens
        │  HTTPS, OAuth 2.0
        ▼
Salesforce (sandbox → prod)    ← products, orders, business logic
```

Three tiers, one BFF holding all secrets, Salesforce as the system of record.
**This top-level shape held.** What changed is everything inside it.

## What actually got built on top of that shape

- **A second seam, not just one.** The original plan had one swap point
  (mock → BFF → Salesforce for data). The shipped app has **two**
  independent seams: `DATA_SOURCE=mock|salesforce` (products, orders,
  accounts) *and* `PAYMENT_PROVIDER=mock|stripe` (payments) — so the entire
  app, including checkout, runs fully offline with zero external accounts.
  Neither seam was in the original architecture doc.
- **A whole B2B data model** (`Account`-as-company, domain-based team
  matching, shared order visibility) that didn't exist in the original plan
  at all — the original scope was single-shopper only.
- **Client-side systems with no backend equivalent in the original plan**:
  the dark/light theme system (token-driven, no-FOUC), catalog
  search/filter/sort (URL-synced), promo codes, and per-route SEO — none of
  these were scoped in Phases 1–3.
- **A standard-fields-first rewrite.** An early version of the Order model
  leaned on more custom fields than turned out to be necessary; mid-project
  this was refactored down to standard `Order.Status`/`TotalAmount`/etc.,
  documented as an explicit rule in
  [`docs/SALESFORCE_CONVENTIONS.md`](../../SALESFORCE_CONVENTIONS.md) so
  future work doesn't regress it.
- **A real deploy pipeline** (Docker, a Render blueprint, GitHub Actions CI
  running lint/build/Playwright) that the original plan named as a Phase 4
  goal but didn't design.

## Why this file isn't kept as a duplicate map

Maintaining two "current architecture" documents means one of them silently
goes stale — which is exactly what happened to the original version of this
file (it described a Phase-1-era app with no theming, no B2B, no discovery,
long after those shipped). Going forward, **only
[`docs/ARCHITECTURE.md`](../../ARCHITECTURE.md) is updated when the codebase
changes.** This file is a one-time historical note and isn't expected to
change again.
