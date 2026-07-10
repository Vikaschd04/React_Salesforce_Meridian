# CLAUDE.md — Meridian project memory

Claude Code loads this file automatically. It is the source of truth for how to
work in this repo. Keep it short; link out to `docs/` for detail.

## Project
Meridian — a single-origin coffee storefront. React SPA front end, Node BFF,
Salesforce backend. Goal: a real, deployable, market-ready store. Full product
spec in `docs/PROJECT_SPEC.md`; architecture in `docs/ARCHITECTURE.md`.

## Tech stack (do not swap without asking)
- Front end: React 18 + Vite, React Router, plain CSS (or CSS modules). JS, not TS,
  to keep the owner's learning curve gentle — unless later phases say otherwise.
- BFF: Node + Express + `jsforce`.
- Backend: Salesforce (sandbox first).
- Tests: Vitest (unit) + Playwright (e2e) in Phase 4.

## Repo layout
```
/                 web app (Vite root)
/server           Node BFF (added in Phase 2)
/docs             specs + phase plans (read these, don't duplicate them)
CLAUDE.md         this file
```

## Working rules
- Work in the phases in `docs/`. One phase at a time; verify, commit, summarize.
- Read the relevant `docs/PHASE_N_*.md` when you enter a phase. Follow its
  acceptance criteria literally.
- Make small, reversible commits. Conventional commit messages
  (`feat:`, `fix:`, `chore:`, `docs:`).
- After changes, run the build (and tests once they exist) before declaring done.

## Skills policy
- Before hand-writing anything a **Skill** covers, check available skills and
  read that SKILL.md first. Use skills for: distinctive UI/design decisions,
  and any document generation (PDF/DOCX/XLSX/PPTX) if the store ever needs it.
- Prefer official scaffolds (`npm create vite`) and well-known libraries over
  writing boilerplate by hand.

## Token-efficiency rules (important)
- Do NOT paste large file contents back into the chat. Edit files in place and
  report only what changed, in a few lines.
- Read a file once per session; rely on memory instead of re-reading. Never
  re-read `docs/` you've already loaded this session.
- Reference requirements by pointing to the doc ("per PHASE_1 §Design") instead
  of restating them.
- Keep explanations terse. No long recaps, no restating the plan you just ran.
- Batch related edits into one pass rather than many tiny round-trips.
- Use plan mode to think, then execute; don't narrate every step.
- When searching the codebase, target specific files/paths rather than broad
  scans.

## Coding conventions
- All data access goes through ONE module (`src/api/store.js`). UI never calls
  a backend directly. Swapping mock → BFF → Salesforce must touch only that file
  (and the server), never the pages.
- Store money as integer cents. Format only at display time.
- Handle loading and error states on every data-fetching screen.
- Meet a quality floor: responsive to mobile, visible keyboard focus, respect
  `prefers-reduced-motion`, semantic HTML.
- No secrets in front-end code, ever. Secrets live only in `/server/.env`
  (git-ignored).

## Definition of done (every phase)
Build passes → acceptance criteria in the phase doc are met → committed →
5-line summary of what changed and what's next.
