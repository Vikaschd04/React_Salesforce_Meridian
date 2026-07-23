# CLAUDE.md — Meridian project memory

> **Status:** the original four-phase build (below) is complete and the
> project has grown past it — B2B accounts, catalog discovery/search, promo
> codes, dark/light theming, SEO, and a full deploy pipeline all shipped after
> Phase 4 and were never part of the original plan. This file now documents
> **how work actually happens in this repo**, not a build sequence to follow.
> For what the app does today, read [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md)
> and [`docs/DEVELOPER_GUIDE.md`](../DEVELOPER_GUIDE.md) — not this folder.

## Project
Meridian — a single-origin coffee storefront. React SPA front end, Node BFF,
Salesforce backend. It's a real, deployed, market-ready store, not a demo.

## Tech stack (as actually built)
- Front end: React 19 + Vite, React Router v7, plain CSS with a token-driven
  dark/light theme system. JavaScript, not TypeScript.
- BFF: Node + Express + `jsforce`, with a `mock`/`salesforce` data-source seam
  and a `mock`/`stripe` payment-provider seam — every store module mirrors the
  same business rules in both branches, so the whole app runs offline.
- Backend: Salesforce, via OAuth 2.0 Client Credentials (no interactive user).
- Tests: Playwright E2E (mock mode, hermetic) + GitHub Actions CI on every
  push/PR. No Vitest unit-test layer was added — E2E coverage was judged
  sufficient at this size.

## Repo layout
```
/                 web app (Vite root)
/server           Node BFF
/docs             every doc in the repo — start with ARCHITECTURE.md
docs/meridian-plan/  this folder — project history, not day-to-day reference
```
Full file-by-file map: [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md).

## How work actually happens here
The four-phase plan below was useful to bootstrap the project but stopped
being how work happens once Phase 4 shipped. Since then, every addition
(B2B accounts, discovery/search, promos, theming, order-status live refresh,
the Salesforce standard-fields refactor, deployment) followed this loop
instead:

- **Plan mode for non-trivial changes** — think through the approach, get it
  confirmed, then execute. Trivial fixes (a spacing bug, a copy change) skip
  straight to execution.
- **Small, reversible commits.** Conventional commit prefixes (`feat:`,
  `fix:`, `refactor:`, `docs:`, `test:`, `chore:`), each scoped to one change
  and buildable/lintable on its own. See recent `git log` for the actual
  pattern in use.
- **Verify before calling anything done** — `npm run build` + `npm run lint`
  clean, and for backend/Salesforce changes, an actual functional test (mock
  mode at minimum; live Salesforce when the change touches org schema or
  permissions) — not just "the code looks right." Several bugs in this
  project's history (order-status staleness, the `ENTITY_IS_LOCKED` on
  cancel) only surfaced because of this verification step, not from reading
  the diff.
- **Docs are updated alongside the change**, not as a separate cleanup pass —
  when a feature lands, the relevant section of `ARCHITECTURE.md` or
  `DEVELOPER_GUIDE.md` is updated in the same or a following commit.

## Coding conventions (still enforced)
- **One data-access module** on each side of the wire: `src/api/store.js` is
  the only file that calls `fetch`; `server/src/store/*.js` is the only place
  that decides mock vs. Salesforce; `server/src/sf/*.js` is the only place
  that knows a Salesforce field's API name. Swapping an implementation should
  never require touching a page/route/component.
- Store money as **integer cents**; format only at display time
  (`src/lib/money.js`). Every price, discount, and total is **recomputed
  server-side** from trusted data — the client never sets a price.
- Handle loading and error states on every data-fetching screen.
- Meet the quality floor: responsive to mobile, visible keyboard focus,
  respect `prefers-reduced-motion`, semantic HTML, both themes supported by
  every component (style from `tokens.css` custom properties, never
  hardcoded colors).
- **No secrets in front-end code, ever.** Secrets live only in
  `server/.env` (git-ignored) or the hosting platform's environment
  variables.
- Prefer **standard Salesforce objects/fields**; a custom field is added only
  when no standard equivalent exists, and the reason is recorded in
  [`docs/SALESFORCE_CONVENTIONS.md`](../SALESFORCE_CONVENTIONS.md). This rule
  was added mid-project (see `docs/meridian-plan/docs/PHASE_3_SALESFORCE.md`)
  after an early version leaned on custom fields the org didn't need.

## Skills policy
Before hand-writing anything a **Skill** covers, check available skills and
read that SKILL.md first — this applied throughout the build (distinctive
UI/design decisions, document generation) and still applies to future work.

## Definition of done
Build + lint clean → change is actually verified (not just read) → committed
with a message explaining *why* → the relevant doc updated if the change
affects architecture, the Salesforce data model, or the API surface.

---

## Original four-phase plan (historical)

Kept for reference — this is *what was originally scoped*, not what exists
today. See `docs/meridian-plan/docs/PHASE_1_REACT.md` through
`PHASE_4_PRODUCTION.md` for what each phase actually shipped versus planned,
and `docs/meridian-plan/docs/PROJECT_SPEC.md` for the current full spec.

1. **Phase 1** — React storefront on mock data behind one data-layer module.
2. **Phase 2** — Node BFF (Express + jsforce) exposing `/api`, still mock.
3. **Phase 3** — Connect a Salesforce sandbox for products + orders.
4. **Phase 4** — Shopper auth, payments, tests, CI/CD, deployment.

Everything after Phase 4 (B2B, discovery, promos, theming, SEO) was organic
feature work, each planned and executed the same way described above under
"How work actually happens here."
