import { test, expect } from '@playwright/test'

// A guest (no login) places an order, then tracks it on the public /track page
// with the order number + email. A wrong email reveals nothing.
test('guest tracks an order by number + email', async ({ page }) => {
  const email = `e2e-track-${Date.now()}@example.com`

  // Place a guest order via the API (no session).
  const products = await (await page.request.get('/api/products')).json()
  const inStock = products.find((p) => p.stock > 0)
  const placed = await page.request.post('/api/orders', {
    data: {
      items: [{ id: inStock.id, qty: 1 }],
      shipping: {
        name: 'Guest Tracker', email, street: '1 Track St', city: 'Austin',
        stateCode: 'TX', postalCode: '78701', countryCode: 'US',
      },
      payment: { card: { number: '4242424242424242', exp: '12/30', cvc: '123', name: 'Guest' } },
    },
  })
  const { orderId } = await placed.json()

  await page.goto('/track')

  // Wrong email → friendly error, no order shown.
  await page.getByLabel('Order number').fill(orderId)
  await page.getByLabel('Email').fill('wrong@example.com')
  await page.getByRole('button', { name: /track order/i }).click()
  await expect(page.locator('.auth-form__error')).toBeVisible()
  await expect(page.locator('.track-result')).toHaveCount(0)

  // Correct email → the order status/timeline renders.
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: /track order/i }).click()
  await expect(page.locator('.track-result .order-card__id')).toHaveText(orderId)
  await expect(page.locator('.track-result .order-card__status')).toHaveText(/paid/i)
})
