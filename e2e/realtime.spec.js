import { test, expect } from '@playwright/test'

// The order page subscribes to a live Server-Sent Events stream; a server-side
// status change (here via the mock dev-trigger, which stands in for a
// merchant's Salesforce change → Change Data Capture) must update the page with
// no reload or click. page.request shares the browser's session cookie.
test('order status updates live via the SSE stream (no reload)', async ({ page }) => {
  const email = `e2e-live-${Date.now()}@example.com`

  await page.goto('/signup')
  await page.getByLabel('First name').fill('Live')
  await page.getByLabel('Last name').fill('Tester')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('testpass123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/account/)

  // Place an order via the API (fast path; shares the logged-in cookie).
  const products = await (await page.request.get('/api/products')).json()
  const placed = await page.request.post('/api/orders', {
    data: {
      items: [{ id: products[0].id, qty: 1 }],
      shipping: {
        name: 'Live Tester', email, street: '1 Live St', city: 'Austin',
        stateCode: 'TX', postalCode: '78701', countryCode: 'US',
      },
      payment: { card: { number: '4242424242424242', exp: '12/30', cvc: '123', name: 'Live' } },
    },
  })
  const { orderId } = await placed.json()

  await page.goto(`/account/orders/${orderId}`)
  await expect(page.locator('.order-card__status')).toHaveText(/paid/i)
  // The glowing status tag confirms the SSE stream connected (replaces the old
  // Refresh button + "Live" chip — the tag itself pulses while live).
  await expect(page.locator('.order-card__status')).toHaveClass(/order-card__status--live/)
  // The manual Refresh button is gone — updates arrive on their own.
  await expect(page.locator('.order-card__refresh')).toHaveCount(0)

  // Merchant advances the order server-side — no interaction with the page.
  await page.request.post(`/api/dev/orders/${orderId}/advance`)

  // The status flips to "shipped" purely from the pushed event.
  await expect(page.locator('.order-card__status')).toHaveText(/shipped/i)

  // The order-history LIST updates live too: advance again and assert the row's
  // status flips with no reload.
  await page.goto('/account/orders')
  await expect(page.locator('.order-row .order-card__status')).toHaveText(/shipped/i)
  await page.request.post(`/api/dev/orders/${orderId}/advance`)
  await expect(page.locator('.order-row .order-card__status')).toHaveText(/delivered/i)
})
