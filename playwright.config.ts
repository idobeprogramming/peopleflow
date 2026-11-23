import { defineConfig, devices } from '@playwright/test'

// E2E runs against the in-memory API so it needs no database. A local Chrome can be used with PW_CHROME_PATH.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'fr-CA',
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROME_PATH ? { executablePath: process.env.PW_CHROME_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', DEMO_ACCOUNT: 'true' },
  },
})
