# KICKOFF PROMPT — paste this into Claude Code

You are building **Meridian**, a production-ready e-commerce web app: a React
storefront backed by Salesforce. This repo contains a full spec. Your job is to
build it autonomously, phase by phase, with minimal wasted work.

## Before writing any code
1. Read `CLAUDE.md` (project memory — coding rules, token budget, skills policy).
2. Read `docs/PROJECT_SPEC.md` and `docs/ARCHITECTURE.md`.
3. Check available **Agent Skills** and read the SKILL.md of any that apply
   (frontend design, doc generation, etc.) BEFORE hand-writing equivalent work.
   Prefer skills and standard scaffolds over reinventing boilerplate.
4. Enter **plan mode**, produce a short plan for Phase 1 only, and confirm it
   with me. Do not plan all four phases up front — plan each phase as you reach it.

## How to work
- Build in the four phases defined under `docs/`. Finish and verify one phase
  before starting the next. After each phase: run the build/tests, then commit
  with a clear message, then summarize in 5 lines or fewer.
- Read the matching `docs/PHASE_N_*.md` at the START of each phase and follow its
  acceptance criteria. Don't re-read docs you've already loaded this session.
- Follow every rule in `CLAUDE.md`, especially the **token-efficiency** and
  **skills** sections.
- When a phase doc leaves a design or library choice open, make a reasonable
  decision, note it in one line, and keep moving. Only stop to ask me when a
  choice is expensive to reverse (auth model, payment provider, hosting).

## What we are building (high level)
- **Phase 1** — React storefront (Vite) with a modern, distinctive design.
  Browse → product detail → cart → checkout → confirmation. Runs on mock data
  behind a single data-layer module so the backend can be swapped in later.
- **Phase 2** — Node "backend-for-frontend" (Express + jsforce) that will hold
  all secrets and expose clean `/api` endpoints. Start it against mock data too.
- **Phase 3** — Connect to a Salesforce **sandbox**: data model, Connected App,
  OAuth, and wiring the BFF to real Salesforce records for products and orders.
- **Phase 4** — Make it market-ready: shopper auth, payments, tests, CI/CD,
  security hardening, performance/SEO, and deployment.

## Start now
Confirm you've read `CLAUDE.md` and the two docs, then give me the Phase 1 plan.
