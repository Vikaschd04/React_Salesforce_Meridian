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
"This isn't a bolt-on schema. Almost everything maps to **standard** Salesforce —
Product2 and Pricebook, Order and OrderItem, **Person Accounts** for B2C
customers, Case and CaseComment for support. So admins, reports and flows keep
working. We added only a handful of custom fields/objects where nothing standard
fit, and it's all created by **one command** with a single permission set. The
governing rule: standard-first, custom only when justified — and documented."

### Slide 6 · Security & governance  *(~1.5 min)*
"Stakeholders always ask about security, so here it is up front. Secrets live
only in the middleware — never in the browser. Login is an httpOnly cookie, so
there are no tokens page scripts can leak. Anything involving money or stock is
decided server-side against Salesforce. Access is one reviewable permission set.
And two customer-facing guards: guest order-tracking needs the order number
**and** the matching email (no guessing), and customers only ever see **public**
case replies — internal notes never leak."

### Slide 7 · Core flow  *(~1.5 min)*
"When a shopper pays, a **real Order** is created in Salesforce — Draft, then
immediately Activated, meaning paid. From there the **merchant** drives it inside
Salesforce: Shipped, then Completed. The storefront simply reads Status back, so
the business runs fulfilment in the tool they already use. The trust points:
totals and stock are server-side, and we take payment *before* we write the
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
a few — "discovery and search, cart and checkout, promo codes, reviews, wishlist,
saved addresses, live order tracking, support tickets, guest tracking, theming,
SEO, accessibility, and an end-to-end test suite in CI."

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
to add to a **wishlist**. "Reviews and wishlist are custom Salesforce objects
behind the scenes."

**3. Cart → checkout (1 min)**
Add to cart → **Checkout**. Apply promo code **`WELCOME10`** to show the discount.
Fill shipping, pay with the test card **`4242 4242 4242 4242`**. "Totals are
recomputed server-side and stock is checked against Salesforce — the browser is
never trusted with price."

**4. Confirmation (15s)**
Show the confirmation + order number. "That just created a **real Order** in
Salesforce."

**5. Prove it in Salesforce (45s)**
Switch to Salesforce → open that Order. Show **Status = Activated**, the line
items, and the **Account** it's linked to. If you registered (vs. guest), show
it's a **Person Account** for that shopper.

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
- **"What's next?"** Subscriptions (Contracts), generative AI when the org is
  entitled (Einstein / Agentforce / Data Cloud), more locales/channels, and
  production payments.

---

## Reference — test data for the demo
- **Promo code:** `WELCOME10`
- **Test card:** `4242 4242 4242 4242`, any future expiry, any CVC.
- **Order lifecycle (set in Salesforce):** Draft → Activated (paid) → Shipped →
  Completed; or Cancelled.
- **Deck file:** `docs/Meridian-Overview.pptx` (12 slides, speaker notes on each).
  Interactive HTML version also available if you prefer presenting in a browser.
