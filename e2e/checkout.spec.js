import { test, expect } from '@playwright/test'

/** Add the first shop product to the cart. */
async function addFirstProduct(page) {
  await page.goto('/shop')
  await page.locator('.card__link').first().click()
  await expect(page).toHaveURL(/\/product\//)
  const add = page.getByRole('button', { name: /add to cart/i })
  await expect(add).toBeEnabled()
  await add.click()
}

async function fillCheckout(page, email = 'ada@example.com') {
  await page.getByLabel('Full name').fill('Ada Lovelace')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Street address').fill('5 Analytical Way')
  await page.getByLabel('City').fill('Richmond')
  await page.getByLabel('Postal code').fill('23220')
  await page.getByLabel('Card number').fill('4242 4242 4242 4242')
  await page.getByLabel('Expiry').fill('12/29')
  await page.getByLabel('CVC').fill('123')
  await page.getByLabel('Name on card').fill('Ada Lovelace')
}

test('home loads with the right title', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Meridian/)
  await expect(page.getByRole('link', { name: 'Shop', exact: true })).toBeVisible()
})

test('browse → add to cart → pay → confirmation', async ({ page }) => {
  await addFirstProduct(page)
  await expect(page.locator('.nav__cart .nav__badge')).toHaveText('1')

  await page.goto('/cart')
  await page.getByRole('link', { name: /continue to checkout/i }).click()
  await expect(page).toHaveURL(/\/checkout/)

  await fillCheckout(page)
  await page.getByRole('button', { name: /^Pay / }).click()

  await expect(page).toHaveURL(/\/confirmation\//)
  await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible()
  await expect(page.getByText(/total paid/i)).toBeVisible()
})

test('a declined card keeps the shopper on checkout with an error', async ({ page }) => {
  await addFirstProduct(page)
  await page.goto('/checkout')
  await fillCheckout(page)
  await page.getByLabel('Card number').fill('4000 0000 0000 0002') // decline
  await page.getByRole('button', { name: /^Pay / }).click()

  await expect(page).toHaveURL(/\/checkout/)
  await expect(page.getByText(/declined/i)).toBeVisible()
})

test('promo code WELCOME10 applies a discount', async ({ page }) => {
  await addFirstProduct(page)
  await page.goto('/checkout')
  await page.getByLabel('Promo code').fill('WELCOME10')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.locator('.promo__badge')).toHaveText('WELCOME10')
  await expect(page.getByText(/^Discount/)).toBeVisible()
})
