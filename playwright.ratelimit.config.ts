import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

config({ path: '.env.local' })

export default defineConfig({
  testMatch: ['**/e2e/rate-limit.spec.ts'],
  retries: 0,
  workers: 1,
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  projects: [
    {
      name: 'rate-limits',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Brak webServer — testy wywołują Supabase API bezpośrednio, nie używają przeglądarki
})
