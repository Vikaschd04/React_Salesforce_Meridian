# PROMPT.md — picking up work in this repo

> **Status:** this used to be the literal kickoff prompt pasted into Claude
> Code to bootstrap the project from nothing (see the original version below).
> That build is long finished. This file now documents how to **pick up a new
> piece of work** in an already-mature, already-deployed app — the situation
> every session since Phase 4 has actually been in.

## Before making any change
1. Read [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) — the file-by-file map
   of the whole codebase. This replaces reading `PROJECT_SPEC.md` +
   `ARCHITECTURE.md` from scratch every time.
2. For anything touching Salesforce data, also read
   [`docs/DEVELOPER_GUIDE.md`](../DEVELOPER_GUIDE.md) (data flows + full org
   inventory) and [`docs/SALESFORCE_CONVENTIONS.md`](../SALESFORCE_CONVENTIONS.md)
   (the standard-fields-first rule).
3. Check available **Agent Skills** and read the SKILL.md of any that apply
   before hand-writing equivalent work.

## How to work
- **Non-trivial change** (new feature, schema change, anything touching more
  than a couple of files): use plan mode, produce a short plan, confirm it,
  then execute. Don't plan further ahead than the current request — this repo
  has consistently been built incrementally, one requested feature at a time,
  not against a long upfront roadmap.
- **Trivial fix** (styling, copy, a small bug): just fix it, verify, commit.
- **Verify before declaring done.** `npm run build` + `npm run lint` clean is
  the floor. For backend or Salesforce changes, actually exercise the change
  — mock mode at minimum, live Salesforce for anything touching org schema,
  permissions, or field-level security. Reading the diff is not verification;
  this project has hit real bugs (order-status staleness, a permission-set
  gap that silently broke order cancellation) that only surfaced by running
  the code, not by reviewing it.
- Make small, reversible commits with conventional prefixes (`feat:`, `fix:`,
  `refactor:`, `docs:`, `test:`, `chore:`) — see `git log` for the pattern.
- Update the relevant doc **in the same piece of work**, not as a follow-up
  cleanup: if you change the API surface, update
  [`docs/DEVELOPER_GUIDE.md` §12](../DEVELOPER_GUIDE.md); if you add a
  Salesforce field, update [`docs/SALESFORCE_CONVENTIONS.md`](../SALESFORCE_CONVENTIONS.md)
  and [`docs/DEVELOPER_GUIDE.md` §10](../DEVELOPER_GUIDE.md); if you add a
  new file or subsystem, update [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md).
- When a decision is cheap to reverse, make a reasonable call and note it in
  one line. Stop and ask only when a choice is expensive to reverse (auth
  model, payment provider, hosting, a schema decision that's hard to migrate
  away from later).

## Full working conventions
See [`CLAUDE.md`](CLAUDE.md) in this folder — coding conventions, the
one-data-access-module rule, the Salesforce standard-fields rule, and the
definition of done.

---

## Original kickoff prompt (historical — the project this bootstrapped)

This is what was pasted into Claude Code to start the project from an empty
repo. Kept for the record; not something to re-run.

> You are building **Meridian**, a production-ready e-commerce web app: a
> React storefront backed by Salesforce.
>
> Build it autonomously, phase by phase, with minimal wasted work:
> - **Phase 1** — React storefront (Vite), modern distinctive design. Browse →
>   product detail → cart → checkout → confirmation, on mock data behind a
>   single data-layer module so the backend can be swapped in later.
> - **Phase 2** — Node backend-for-frontend (Express + jsforce) holding all
>   secrets, exposing clean `/api` endpoints. Starts against mock data too.
> - **Phase 3** — Connect a Salesforce **sandbox**: data model, Connected App,
>   OAuth, wiring the BFF to real Salesforce records for products and orders.
> - **Phase 4** — Make it market-ready: shopper auth, payments, tests, CI/CD,
>   security hardening, performance/SEO, and deployment.
>
> Finish and verify one phase before starting the next; commit with a clear
> message; summarize in 5 lines or fewer.

What actually shipped in each phase — including everything that grew beyond
this original scope — is recorded in `docs/meridian-plan/docs/PHASE_1_REACT.md`
through `PHASE_4_PRODUCTION.md`.
