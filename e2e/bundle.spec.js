import { test, expect } from '@playwright/test'

// Browse bundles → open one → add to cart → checkout → pay → confirmation.
// Runs in mock mode; in salesforce mode the bundle is a Product2 and flows
// through the identical order pipeline.
test('buy a bundle end-to-end', async ({ page }) => {
  await page.goto('/bundles')
  await expect(page.locator('.bundle-card')).not.toHaveCount(0)

  await page.locator('.bundle-card__link').first().click()
  await expect(page).toHaveURL(/\/bundles\//)
  // The detail lists the component coffees and shows a saving.
  await expect(page.locator('.bundle-content')).not.toHaveCount(0)
  await expect(page.locator('.bundle-detail__save')).toBeVisible()

  await page.getByRole('button', { name: /add bundle to cart/i }).click()
  await expect(page.locator('.nav__cart .nav__badge')).toHaveText('1')

  await page.goto('/cart')
  await page.getByRole('link', { name: /continue to checkout/i }).click()
  await expect(page).toHaveURL(/\/checkout/)

  await page.getByLabel('Full name').fill('Ada Lovelace')
  await page.getByLabel('Email').fill(`ada-bundle-${Date.now()}@example.com`)
  await page.getByLabel('Street address').fill('5 Analytical Way')
  await page.getByLabel('City').fill('Richmond')
  await page.getByLabel('Postal code').fill('23220')
  await page.getByLabel('Card number').fill('4242 4242 4242 4242')
  await page.getByLabel('Expiry').fill('12/29')
  await page.getByLabel('CVC').fill('123')
  await page.getByLabel('Name on card').fill('Ada Lovelace')
  await page.getByRole('button', { name: /^Pay / }).click()

  await expect(page).toHaveURL(/\/confirmation\//)
  await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible()
})
