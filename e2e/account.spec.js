import { test, expect } from '@playwright/test'

test('signup → place an order → it appears in order history', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`

  await page.goto('/signup')
  await page.getByLabel('First name').fill('E2E')
  await page.getByLabel('Last name').fill('Tester')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('testpass123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/account/)

  // Add a product and check out as the logged-in shopper.
  await page.goto('/shop')
  await page.locator('.card__link').first().click()
  await page.getByRole('button', { name: /add to cart/i }).click()
  await page.goto('/checkout')
  await page.getByLabel('Full name').fill('E2E Tester')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Street address').fill('1 Test St')
  await page.getByLabel('City').fill('Austin')
  await page.getByLabel('Postal code').fill('78701')
  await page.getByLabel('Card number').fill('4242 4242 4242 4242')
  await page.getByLabel('Expiry').fill('12/29')
  await page.getByLabel('CVC').fill('123')
  await page.getByRole('button', { name: /^Pay / }).click()
  await expect(page).toHaveURL(/\/confirmation\//)

  // The order shows up in history, with a paid status.
  await page.goto('/account/orders')
  const row = page.locator('.order-row').first()
  await expect(row).toBeVisible()
  await expect(row.locator('.order-card__status')).toHaveText(/paid/i)
})
