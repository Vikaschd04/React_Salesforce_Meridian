import { test, expect } from '@playwright/test'

// The shop PLP is server-paged: the BFF filters/sorts across the WHOLE catalog
// and returns 10 products per page. These run in mock mode (16 products → 2
// pages). The expected counts are read from the paged API so the assertions
// hold regardless of the exact mock catalog.

test('shop paginates 10 per page and navigates between pages', async ({ page }) => {
  const p1 = await (await page.request.get('/api/catalog?page=1&pageSize=10')).json()
  const p2 = await (await page.request.get('/api/catalog?page=2&pageSize=10')).json()
  expect(p1.pageSize).toBe(10)
  expect(p1.items.length).toBe(10)
  expect(p1.total).toBeGreaterThan(10) // catalog spans more than one page
  expect(p1.totalPages).toBe(2)
  expect(p2.items.length).toBe(p1.total - 10) // remainder lands on page 2

  await page.goto('/shop')

  // Page 1: exactly 10 cards, pager present, page 1 current, Prev disabled.
  await expect(page.locator('.grid .card')).toHaveCount(10)
  await expect(page.locator('.shop__count')).toHaveText(
    new RegExp(`Showing 1.10 of ${p1.total} coffees`),
  )
  await expect(page.locator('.pagination__page.is-current')).toHaveText('1')
  await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled()

  // Next → the URL, card count, current-page marker, and Next state all update.
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page).toHaveURL(/[?&]page=2/)
  await expect(page.locator('.grid .card')).toHaveCount(p2.items.length)
  await expect(page.locator('.pagination__page.is-current')).toHaveText('2')
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled()
})

test('filtering applies across the whole catalog and resets to page 1', async ({ page }) => {
  // Ground truth: a roast filter applied over the entire catalog.
  const filtered = await (
    await page.request.get('/api/catalog?page=1&pageSize=10&roast=Light')
  ).json()
  expect(filtered.total).toBeGreaterThan(0)

  await page.goto('/shop?page=2')
  await expect(page.locator('.pagination__page.is-current')).toHaveText('2')

  // Apply the Light-roast facet — the total reflects ALL matching products
  // (not just what was on the current page), and the view resets to page 1.
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await expect(page).not.toHaveURL(/[?&]page=2/)
  await expect(page.locator('.shop__count')).toContainText(`of ${filtered.total} coffees`)
  await expect(page.locator('.grid .card')).toHaveCount(Math.min(10, filtered.total))
})
