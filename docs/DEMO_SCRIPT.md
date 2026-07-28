# Meridian — Demo Deck Script

A presenter's companion to **`Meridian-Overview.pptx`**. Use it to narrate the
deck and run the live demo. Every slide already has the same talk-track in its
**speaker notes** (open PowerPoint/Keynote in *Presenter View* to see them);
this file adds the full **live-demo walkthrough** and **Q&A prep**.

- **Audience:** stakeholders + delivery team (mixed technical / non-technical).
- **Total time:** ~15 min deck + ~10 min live demo + Q&A.
- **One-line thesis:** *"Salesforce stays the brain; we put a fast, modern,
  on-brand storefront in front of it — and built the whole thing with Claude."*
- **The moment to land:** on the live demo, change an order's status in
  Salesforce and let the room watch the storefront update **by itself**.

---

## Part 1 — The deck (talk track)

### Slide 1 · Cover  *(~30s)*
"This is **Meridian** — a working storefront we built on top of Salesforce,
using Claude. Watch the *pattern*, not the coffee: Salesforce is the system of
record, the storefront is a modern web app, and a thin middleware connects them
securely. Everything here was built and verified against a **real** Salesforce
org."

### Slide 2 · Agenda  *(~20s)*
"Fifteen minutes of context — the idea, the architecture, the Salesforce model,
security, and the flows — then a live demo where you'll see an order move
through Salesforce in real time. Please hold questions for the demo, or jump in
if something's unclear."

### Slide 3 · The idea  *(~1.5 min)*
"People assume 'commerce on Salesforce' means Commerce Cloud. This shows you can
start **without** it. Three ideas: (1) Salesforce is the single source of truth —
products, orders, customers, cases are all standard objects; (2) the frontend can
be any modern stack — ours is React; (3) a small, secure middleware brokers the
two. Meridian, a single-origin coffee store, is just our reference build to make
it concrete."

### Slide 4 · Architecture  *(~2 min)*
"Three tiers, left to right. **Browser** — the UI; it never talks to Salesforce
directly, every call goes through one data module. **Middleware** — the only
piece that holds the Salesforce credentials; it validates input and computes
money server-side, so the client is never trusted with prices. **Salesforce** —
reached through a Connected App using OAuth *Client Credentials*, a
server-to-server login. The key line: the exact same code runs fully **offline**
in mock mode, so we build and demo without an org, then flip one switch to go
live."

### Slide 5 · The Salesforce side  *(~1.5 min)*
"This isn't a bolt-on schema, and the standard-first story keeps getting stronger.
Almost everything maps to **standard** Salesforce — Product2 and Pricebook, Order
and OrderItem, and now a standard **OrderSummary** per order (Salesforce **Order
Management**) that rolls up shipping and **sales tax**; **Person Accounts** for B2C
customers; Case and CaseComment for support. Even the things we *used* to keep
custom are standard now — **Wishlist/WishlistItem** for saved products,
**ContactPointAddress** for saved addresses, and **Coupon/Promotion** for promo
codes. So admins, reports and flows keep working. The **one** custom object left is
Product Reviews (no standard fit), plus a few justified Order fields — all created
by **one command** with a single permission set. The rule: standard-first, custom
only when justified — and documented."

### Slide 6 · Security & governance  *(~1.5 min)*
"Stakeholders always ask about security, so here it is up front. Secrets live
only in the middleware — never in the browser. Login is an httpOnly cookie, so
there are no tokens page scripts can leak. Anything involving money or stock is
decided server-side against Salesforce. Access is one reviewable permission set.
And two customer-facing guards: guest order-tracking needs the order number
**and** the matching email (no guessing), and customers only ever see **public**
case replies — internal notes never leak."

### Slide 7 · Core flow  *(~1.5 min)*
"When a shopper pays, totals — including **sales tax** — are computed server-side,
we take payment, then a **real Order** is created in Salesforce (Draft, then
immediately Activated, meaning paid) **alongside a standard OrderSummary** that
rolls up the product, shipping and tax amounts. From there the **merchant** drives
it inside Salesforce: Shipped, then Completed. The storefront simply reads Status
back, so the business runs fulfilment in the tool they already use. The trust
points: totals and stock are server-side, and we take payment *before* we write the
order."

### Slide 8 · Real-time & identity  *(~1.5 min)*
"Two highlights you'll see live. **Person Accounts** — registering creates a
native Salesforce B2C customer record (Account + Contact in one), and every
order rolls up to it, so you see a real customer, not an anonymous row. **Live
tracking** — we enabled Change Data Capture on Order; when a merchant changes the
status in Salesforce, that event streams to the browser and the page updates
instantly, no refresh. Guests get the same live tracking by order number + email."

### Slide 9 · Functionality  *(~1 min)*
"Sixteen features, each built standard-first and each with automated tests." Scan
a few — "discovery and search, cart and checkout **with sales tax**, promo codes
(standard **Coupon/Promotion**), reviews, wishlist (standard **Wishlist**), saved
addresses (standard **ContactPointAddress**), order history with a standard
**OrderSummary** per order, live order tracking, support tickets, guest tracking,
theming, SEO, accessibility, and an end-to-end test suite in CI."

### Slide 10 · How it was built  *(~1.5 min)*
"'AI-built' with guardrails a senior engineer would recognise. Each feature is
**planned and approved** before code. Everything is **verified against a real
org** — live round-trips and headless-browser screenshots, not
mocked-and-hoped. Nothing is committed unless tests, lint and build pass. The
result is speed **with** an audit trail: plans, tests, docs, and one clean commit
per feature."

### Slide 11 · Why it matters  *(~1 min)*
"The value isn't a coffee site — it's a **repeatable pattern** for putting a great
experience in front of Salesforce: a storefront, a self-service portal, partner
ordering, an internal catalog — B2C or B2B — without committing to Commerce Cloud
on day one. And AI makes delivering it dramatically faster."

### Slide 12 · Live demo & next  *(~20s, then switch to the app)*
"Let me show you." → switch to the running site and follow Part 2.

---

## Part 2 — Live demo walkthrough

**Before you start (have these ready):**
- The storefront open in one window/tab; a Salesforce org tab in another.
- Logged **out** to begin (so you can show signup + guest paths).
- Ideally two monitors, or be ready to alt-tab between storefront and Salesforce.

> Tip: keep the Salesforce tab on an Order list view so the status change in
> step 6 is one click away.

**1. Storefront overview (30s)**
Land on the home page → **Shop**. "This is the customer experience — fast,
responsive, on-brand." Type in search / apply a roast filter. "Filters live in
the URL, so a view is shareable and survives a refresh."

**2. Product → social proof (30s)**
Open a coffee. Point out tasting notes, **reviews & ratings**, and the **heart**
to add to a **wishlist**. "Reviews are a custom object; the **wishlist is the
standard Salesforce `Wishlist` object** — one of several things we moved from
custom to standard."

**3. Cart → checkout (1 min)**
Add to cart → **Checkout**. Apply promo code **`WELCOME10`** to show the discount
(promo codes are standard **Coupon/Promotion** records in Salesforce). Point out the
**Subtotal → Discount → Shipping → Tax → Total** breakdown — "**sales tax** and the
grand total are computed server-side." Fill shipping (note the country → **state
dropdown**, e.g. India), pay with the test card **`4242 4242 4242 4242`**. "Totals
are recomputed server-side and stock is checked against Salesforce — the browser is
never trusted with price."

**4. Confirmation (15s)**
Show the confirmation + order number. "That just created a **real Order** in
Salesforce."

**5. Prove it in Salesforce (45s)**
Switch to Salesforce → open that Order. Show **Status = Activated**, the line
items, and the **Account** it's linked to. If you registered (vs. guest), show
it's a **Person Account** for that shopper. Then open the matching **OrderSummary**
(Salesforce Order Management) — point out the **TotalProductAmount /
TotalDeliveryAmount / TotalTaxAmount / GrandTotalAmount** rollups and the
**OrderItemSummary** lines, each carrying its own tax. "Every order also produces a
standard OrderSummary — this *supplements* the Order; the lifecycle still rides
`Order.Status`."

**6. ⭐ The real-time moment (1 min)**
Put the storefront's **order page** on screen (Account → Order history → open the
order). In Salesforce, change the Order **Status → Shipped** and save. Switch
back **without refreshing** — the timeline advances and the status tag updates on
its own. "No refresh, no polling — that's Change Data Capture streaming to the
browser." (Optional: set it to **Completed** and watch it land as Delivered.)

**7. Support ticket round-trip (1 min)**
Storefront → **Contact** → submit a message. Show it appears under **Account →
Support** with status *New*. In Salesforce, open the **Case**, add a **public**
comment and set a status, save. Back in the storefront, refresh the ticket — the
reply and new status show. "And internal notes stay internal — customers only see
public replies."

**8. Guest order tracking (45s)**
Log out. Go to **Track your order**, enter the order number + the email used at
checkout. Show the read-only status/timeline. Enter a wrong email → generic
"not found." "Guests can track without an account, but only with the matching
email — no order-number guessing."

**9. Close (15s)**
"Everything you saw — the storefront, the middleware, and the Salesforce setup —
was built feature-by-feature with Claude, verified against this live org." → back
to slide 12 for next steps.

---

## Part 3 — Q&A prep

- **"Do we need Commerce Cloud?"** No — this runs on standard Salesforce objects
  and a Connected App. Commerce Cloud is an option later, not a prerequisite.
- **"Is it secure?"** Credentials live only in the middleware; the browser holds
  no secrets; money/stock are server-side; access is one permission set; guest
  tracking is email-verified. (Slide 6.)
- **"Why Person Accounts?"** They're Salesforce's native B2C model — one record
  that is both Account and Contact — so each shopper is a real customer with
  their orders attached. Requires Person Accounts enabled (it is here).
- **"What's the OrderSummary / do you use Order Management?"** Yes — every order
  also creates a standard **OrderSummary** (with OrderItemSummary +
  OrderDeliveryGroupSummary) via the standard `createOrderSummary` action, so the
  app showcases the standard OMS stack. It **supplements** the Order — the
  lifecycle still rides `Order.Status` (we deliberately didn't migrate status/
  cancel onto OMS). Created `UNMANAGED` (no fulfilment engine); the app owns the
  lifecycle.
- **"How is sales tax handled?"** A configurable flat rate (`SF_TAX_RATE`, default
  8%) on the post-discount subtotal, computed server-side, included in the charge,
  and stored as standard `OrderItemTaxLineItem` records (one per product line) that
  roll up to `OrderSummary.TotalTaxAmount`. Swappable for a real tax engine later.
- **"What's standard vs custom now?"** Standard-first got stronger: Product2/
  Pricebook, Order/OrderItem/OrderSummary, Person Accounts, Case/CaseComment,
  **Wishlist**, **ContactPointAddress**, and **Coupon/Promotion** are all standard.
  The only custom **object** is Product Reviews; plus a few justified Order fields
  (guest email, discount, promo code, shipping amount, payment ref, tracking).
- **"How does the real-time update work?"** Change Data Capture on Order →
  the middleware subscribes → pushes to the browser over Server-Sent Events.
  Falls back to a manual/refresh path if the stream drops.
- **"B2B too?"** Yes — the pattern supports B2B (accounts, contacts, negotiated
  pricing/approvals) as a follow-on; we kept this build B2C for the demo.
- **"How do we trust AI-built code?"** Plans are approved up front; every feature
  is verified against a real org; tests, lint and build gate each commit; docs
  are kept in sync. Speed with an audit trail. (Slide 10.)
- **"Payments?"** Stripe-ready; the demo uses a mock provider so there are no real
  charges. Going live is a configuration + hardening step.
- **"Does the data stay in Salesforce?"** Yes — Salesforce is the system of
  record. The middleware is stateless brokering; it doesn't own the data.
- **"Can we deploy the whole package (frontend + BFF) *in* Salesforce?"** The
  frontend can; the BFF as-is can't run *inside* an org — Salesforce's only native
  server runtime is **Apex**, not Node. Three paths: **(A, recommended)** rehost on
  the Salesforce family — BFF on **Heroku** (a Salesforce company, runs Node
  unchanged, with first-party org integration), frontend as a static/Experience
  Cloud site; keeps all the code. **(B)** Frontend on an Experience Cloud (LWR)
  site, BFF on Heroku — some adaptation (CSP / size limits). **(C)** Fully native:
  rebuild the UI as **LWC** and the BFF logic in **Apex** + Named Credentials — a
  big rewrite that inherits governor limits and re-couples you to Salesforce (the
  very lock-in the decoupled pattern avoids). Note **Salesforce Functions** (the old
  serverless middle path) was **retired**. Framing: keeping frontend + BFF outside
  the org is the point; if "all Salesforce infra" is required, **Heroku** is the
  natural home with near-zero change.
- **"Could we build this on SAP Hybris (SAP Commerce Cloud)?"** Yes — the pattern is
  backend-agnostic, and SAP is an even more natural fit: SAP Commerce exposes **OCC
  REST APIs** and ships a reference headless storefront (**Spartacus / Composable
  Storefront**), so it endorses this exact architecture. You'd swap only our thin
  Salesforce adapter (`server/src/sf/*.js`) for an OCC client; the React frontend,
  BFF structure, security model and AI build workflow all carry over. Differences:
  SAP Commerce *is* a full commerce engine, so cart/pricing/promotions/**tax**/
  inventory are first-class there (less BFF math); no direct CDC→SSE (use SAP
  events/webhooks or polling); the "commerce without Commerce Cloud" narrative
  doesn't apply since SAP Commerce is the dedicated platform.
- **"What's next?"** Subscriptions (Contracts), generative AI when the org is
  entitled (Einstein / Agentforce / Data Cloud), more locales/channels, and
  production payments.

---

## Reference — test data for the demo
- **Promo code:** `WELCOME10` (a standard `Coupon`/`Promotion`; `npm run sf:setup`
  seeds the demo codes).
- **Test card:** `4242 4242 4242 4242`, any future expiry, any CVC.
- **Order lifecycle (set in Salesforce):** Draft → Activated (paid) → Shipped →
  Completed; or Cancelled — this rides `Order.Status`.
- **Per order, also created:** a standard **OrderSummary** (+ OrderItemSummary /
  OrderDeliveryGroupSummary) with product, shipping and **tax** rollups.
- **Sales tax:** flat `SF_TAX_RATE` (default 8%) on the post-discount subtotal.
- **Deck file:** `docs/Meridian-Overview.pptx` (12 slides, speaker notes on each).
