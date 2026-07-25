import { test, expect } from '@playwright/test'

// A logged-in shopper raises a ticket, sees it under Support, and — after the
// merchant replies (mock dev-trigger stands in for a Salesforce Case update) —
// sees the reply + new status in the ticket's thread, with no reload beyond
// navigating to the ticket.
test('raise a support ticket → see the merchant reply + status update', async ({ page }) => {
  const email = `e2e-support-${Date.now()}@example.com`

  await page.goto('/signup')
  await page.getByLabel('First name').fill('Sup')
  await page.getByLabel('Last name').fill('Port')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('testpass123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/account/)

  // Raise a ticket via the API (shares the session cookie).
  const created = await page.request.post('/api/support', {
    data: { name: 'Sup Port', email, subject: 'Grinder question', message: 'Which grind for a moka pot?' },
  })
  const { caseNumber } = await created.json()

  // It shows under Support with status New.
  await page.goto('/account/tickets')
  await expect(page.locator('.ticket-row__subject')).toHaveText('Grinder question')
  await expect(page.locator('.ticket-status')).toHaveText(/new/i)

  // Merchant replies + moves it On Hold (stands in for a Salesforce Case update).
  await page.request.post(`/api/dev/cases/${caseNumber}/reply`, {
    data: { body: 'A medium-fine grind works great for a moka pot.', status: 'On Hold' },
  })

  // The customer sees the reply + the new status on the ticket detail.
  await page.goto(`/account/tickets/${caseNumber}`)
  await expect(page.locator('.ticket-status')).toHaveText(/on hold/i)
  await expect(page.locator('.ticket-reply__body')).toHaveText(/medium-fine grind/i)
})
