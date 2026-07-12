import { defineConfig, devices } from '@playwright/test'

// E2E runs against the real production artifact (BFF serving the built SPA) in
// fully mock mode — no Salesforce, no Stripe — so the suite is hermetic.
const PORT = process.env.E2E_PORT || 8799
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && NODE_ENV=production DATA_SOURCE=mock PAYMENT_PROVIDER=mock SESSION_SECRET=e2e-only-secret-not-for-prod PORT=${PORT} node server/src/index.js`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: false,
  },
})
