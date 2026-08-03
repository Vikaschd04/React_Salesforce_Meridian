import { test, expect } from '@playwright/test'

// Guided selling ("Find your coffee"): answer the four questions (each option
// auto-advances) and get scored recommendations. Runs in mock mode; the same
// code path scores live Salesforce Product2 attributes in salesforce mode.
test('the quiz returns scored coffee matches', async ({ page }) => {
  await page.goto('/find-your-coffee')

  // Q1 roast → Q2 flavour → Q3 body → Q4 brew (each click advances a step).
  await page.getByRole('button', { name: 'Dark & bold' }).click()
  await page.getByRole('button', { name: 'Chocolate & nutty' }).click()
  await page.getByRole('button', { name: 'Full & heavy' }).click()
  await page.getByRole('button', { name: 'Espresso', exact: true }).click()

  // Results: at least one match card with a % badge, and the picks are echoed.
  await expect(page.getByRole('heading', { name: /brewed to your taste/i })).toBeVisible()
  await expect(page.locator('.match-card')).not.toHaveCount(0)
  await expect(page.locator('.match-card__pct').first()).toContainText('% match')
  await expect(page.getByText('Dark & bold')).toBeVisible() // preference chip echoed

  // The matches are real, add-to-cart-able products.
  await expect(page.locator('.match-card .card__link').first()).toHaveAttribute('href', /\/product\//)
})
