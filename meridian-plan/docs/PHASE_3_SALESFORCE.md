# PHASE_3_SALESFORCE.md — connect Salesforce (sandbox)

Goal: replace the BFF's mock data with real Salesforce records. Products come
from Salesforce; checkout creates real Order records.

## Human-owner steps (Claude Code: instruct the owner, then verify)
These require Salesforce UI access — Claude Code should produce a clear
checklist and wait for the owner to complete them, then continue.
1. Create a **Developer sandbox** (Setup → Sandboxes). Note it logs in via
   `https://test.salesforce.com`.
2. Decide the data model:
   - Products: standard `Product2` + `Pricebook2`/`PricebookEntry`, OR a simple
     custom `Coffee__c` object. Recommend `Product2` for realism.
   - Orders: standard `Order` + `OrderItem`, OR custom. Recommend standard.
3. Add fields to match PROJECT_SPEC (origin, roast, tastingNotes, image, stock).
4. Create sample product records.
5. Create a **Connected App** (Setup → App Manager → New Connected App):
   enable OAuth, set scopes (`api`, `refresh_token`), enable the chosen
   server-to-server flow (Client Credentials or JWT). Copy Consumer Key/Secret.
6. Give Claude Code the sandbox instance URL and (safely) the credentials to put
   in `/server/.env`.

## Claude Code build steps
- Implement Salesforce auth in the BFF with `jsforce` using the chosen flow
  (prefer Client Credentials; fall back to JWT with a cert). Cache the access
  token and refresh on expiry.
- Map Salesforce records → the app's product/order shape in the BFF (do the
  field mapping server-side so the UI shape never changes).
- `GET /api/products` → SOQL query of active products.
- `POST /api/orders` → create Order + OrderItems in Salesforce; return the id.
- Respect API limits: keep the product cache, batch where possible, use the
  Composite API if creating an order needs multiple writes.
- Add integration tests that hit the sandbox behind a feature flag/env guard.

## Acceptance criteria
- [ ] Catalog and detail pages render live Salesforce products.
- [ ] Checkout creates an Order (+ items) visible in Salesforce.
- [ ] Salesforce credentials exist only in `/server/.env`.
- [ ] Token refresh works; app survives an expired access token.
- [ ] UI code is unchanged from Phase 2 (only the BFF/data layer changed).

## Out of scope here
Shopper login, payments, deployment (Phase 4).
