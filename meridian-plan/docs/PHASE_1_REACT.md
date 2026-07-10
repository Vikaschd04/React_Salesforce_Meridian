# PHASE_1_REACT.md — React storefront (mock data)

Goal: a polished, responsive React storefront that runs with zero backend.

## Scope
- Scaffold with `npm create vite` (React, JS).
- Routes: `/` (catalog), `/product/:id` (detail), `/cart` (cart + checkout),
  plus a confirmation state after checkout.
- Cart state shared via React Context.
- ALL data via `src/api/store.js` returning mock data from `src/data/products.js`
  behind a small fake delay. Functions: `getProducts`, `getProduct(id)`,
  `placeOrder(items)`.
- Prices stored as integer cents; formatted via a helper.
- Loading + error states on every fetch.

## Design (make it modern and distinctive — use the design skill)
- Read the frontend-design skill first and commit to a small token system:
  4–6 named hex colors, a display + body typeface pairing, a layout concept,
  and ONE signature element. Avoid the generic "cream + serif + terracotta"
  AI-default look unless justified.
- Ground it in the subject (specialty coffee). Real copy, not lorem ipsum.
- Quality floor: mobile-responsive, visible `:focus-visible`, honors
  `prefers-reduced-motion`, semantic HTML, good color contrast.

## Deliverables
- Running app (`npm run dev`) and passing `npm run build`.
- `README.md` with run instructions and a note on the data-layer swap point.
- Clean component structure: `components/`, `pages/`, `context/`, `api/`, `data/`.

## Acceptance criteria
- [ ] Catalog lists all products; clicking one opens its detail page.
- [ ] Add to cart updates a live count in the navbar.
- [ ] Cart shows line items, quantities, total; items can be removed.
- [ ] Checkout clears the cart and shows a confirmation with an order id.
- [ ] No page imports mock data directly — only `src/api/store.js` does.
- [ ] `npm run build` succeeds with no errors.
- [ ] Looks intentional on both mobile and desktop.

## Out of scope here
Real backend, auth, payments (later phases). Keep `placeOrder` a mock.
