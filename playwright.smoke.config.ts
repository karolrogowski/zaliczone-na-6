import { defineConfig, devices } from '@playwright/test'

// Konfiguracja dla smoke testów post-deploy i preview.
// Nie uruchamia lokalnego serwera ani globalSetup — testuje już wdrożoną aplikację.
// Wymagane env: PLAYWRIGHT_BASE_URL, VERCEL_BYPASS_SECRET, SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.smoke.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL!,
    extraHTTPHeaders: process.env.VERCEL_BYPASS_SECRET
      ? { 'x-vercel-protection-bypass': process.env.VERCEL_BYPASS_SECRET }
      : {},
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--use-fake-ui-for-media-stream', '--use-fake-video-for-capture'],
        },
      },
    },
  ],
})
