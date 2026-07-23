# PROJECT_SPEC.md — Meridian (current)

> Rewritten to describe the **product as it exists today**. The original
> version of this file scoped Phases 1–3 only (browse/cart/checkout on a
> single-shopper model, no theming, no B2B, no discovery). Everything below
> reflects what's actually built and live.

## What it is
A production storefront for a single-origin coffee roaster, selling both to
individual shoppers (B2C) and to companies buying as a team (B2B), with
Salesforce as the system of record for the catalog, orders, and accounts.

## Users

- **Individual shopper** — browses and buys, guest checkout allowed, optional
  account for order history and reordering.
- **Business shopper** — same storefront, but opts in to "buying for a
  company" at signup. Teammates (matched by work email domain) share one
  company's order history and can view — but not cancel — each other's
  orders. No admin setup or invite flow needed; see "B2B: company accounts"
  below.
- **Store operator / merchant** — manages the catalog and runs order
  fulfillment **directly in Salesforce** (no custom admin UI exists or is
  planned). Advancing an order's standard `Status` field in Salesforce is
  what the shopper-facing order timeline reads.

## Core features (as shipped)

### Catalog & discovery
- Product grid with roast level, origin, tasting notes, process, altitude,
  and coordinates.
- **Search, filter, and sort** on the Shop page — free-text search with a
  typeahead suggestion dropdown, roast/origin-country/price-bucket filters,
  and sort (featured / price / name). All filter state lives in the URL, so
  any filtered view is a shareable link and survives a refresh.
- Product detail page with related-products suggestions.
- Server-enforced inventory: a line exceeding stock is rejected at checkout;
  stock decrements on order and restores on cancellation.

### Cart & checkout
- Cart persisted in `localStorage`, always re-joined against live product
  data (so price/stock is never stale).
- Shipping form with dependent state/country dropdowns (only valid ISO codes
  are ever sent to Salesforce).
- **Promo codes** — a small table of percent/fixed/free-shipping codes,
  validated both client-side (for UX) and server-side at order creation (so a
  forged discount can never change what's charged).
- **Payments** via a provider seam: `mock` (fully offline, a specific test
  card number triggers a decline path) or `stripe` (real test-mode
  PaymentIntents) — switchable by one env var, no code change.
- Order totals/prices are **always recomputed server-side** from Salesforce
  pricebook data; the client-supplied price is never trusted.

### Order confirmation & history
- Confirmation page re-fetches the order by id (never trusts client state),
  so a refresh always shows current data.
- Logged-in shoppers get an order history page; each order detail page shows
  a Paid → Shipped → Delivered (or Cancelled) timeline driven by Salesforce's
  standard `Order.Status`.
- Order status **live-refreshes** — a merchant changing `Status` in
  Salesforce shows up on the shopper's account page on tab focus, or via a
  manual Refresh button, without a hard reload.
- Shoppers can cancel their own order while it's still cancellable; stock is
  restored.

### Shopper accounts
- Email/password signup and login. Shoppers are Salesforce `Contact`
  records; sessions are signed JWTs in an httpOnly cookie (never
  `localStorage`); passwords are bcrypt-hashed and never leave the server.
- Guest checkout remains fully supported — no account required to buy.

### B2B: company accounts (team buying)
- At signup, a shopper can check "I'm buying for a company" and provide a
  company name. Teammates are matched automatically by **work email domain**
  — no invite links, no email-sending infrastructure needed. Free email
  providers (gmail.com, yahoo.com, etc.) are rejected for company signup.
- The first person from a domain creates the company (a real Salesforce
  `Account`); later signups from the same domain join it and share its order
  history.
- A company-linked shopper's checkout attaches the order to their company's
  `Account` instead of the shared default. A dedicated Company tab shows
  every teammate's order, each labeled "Placed by ___".
- Viewing a teammate's order is allowed (shared visibility, read-only);
  cancelling stays restricted to whoever placed it — deliberately, so this
  doesn't need an approval workflow.
- **Explicitly out of scope for this phase:** wholesale/tiered pricing,
  quotes, buy-on-invoice + PO + approval, an account switcher (multi-company
  membership), retrofitting an existing individual account onto a company
  after the fact, and any team-management UI (invite/remove members).

### Design & theming
- Full **dark/light theme** support, switchable at any time, no flash of the
  wrong theme on load (set before first paint), persisted per-shopper.
  Every component styles from CSS custom-property tokens — no
  per-component theme logic.
- Cartographic/editorial visual identity — each coffee's origin coordinates
  as a recurring design element.
- Mobile-responsive, visible keyboard focus, `prefers-reduced-motion`
  respected, semantic HTML throughout.

### SEO
- Client-rendered per-route `<title>`/meta description/Open Graph tags,
  JSON-LD structured data (Product, Organization, BreadcrumbList), a
  catalog-driven `/sitemap.xml`, and `robots.txt`. No SSR/prerendering —
  noted as a possible future addition, not a current gap being tracked.

### Support
- A contact form creates a Salesforce `Case` — no custom setup required
  beyond the standard object.

## Non-functional requirements (met)
- **Security:** every price/total/discount recomputed server-side; httpOnly
  signed session cookies; bcrypt password hashing; `helmet` + locked-down
  CORS + strict input validation (`zod`); production refuses to start with an
  unset/default session secret.
- **Testing:** Playwright E2E suite covering checkout and account flows, run
  in hermetic mock mode (no live Salesforce/Stripe needed) — and in CI on
  every push/PR.
- **Deployment:** one Node process serves both the built SPA and the API,
  same-origin (no CORS complexity for cookies); Docker + a Render blueprint
  that deploys immediately in mock mode with zero secrets required to see it
  running.
- **Offline-first development:** the entire app — catalog, checkout,
  payments, accounts, B2B — runs with `DATA_SOURCE=mock` and
  `PAYMENT_PROVIDER=mock`, no external accounts needed to develop or test.

## Explicitly out of scope (current)
- Transactional email (order receipts are in-browser only; no email sends).
- Rate limiting.
- SSR/prerendering (SEO is client-rendered, sitemap-backed instead).
- A custom merchant/admin UI — fulfillment is run directly in Salesforce.
- Everything listed as out of scope for B2B above (wholesale pricing,
  quotes, invoicing, account switcher, team management).

## Where the detail lives
This file is the product-level summary. For the implementation:
- [`docs/ARCHITECTURE.md`](../../ARCHITECTURE.md) — file-by-file map of
  every frontend/backend file and how the systems above are wired together.
- [`docs/DEVELOPER_GUIDE.md`](../../DEVELOPER_GUIDE.md) — Salesforce data
  flows, the full org inventory, and the API reference.
- [`docs/SALESFORCE_CONVENTIONS.md`](../../SALESFORCE_CONVENTIONS.md) — the
  standard-vs-custom Salesforce field rule.
