import { test, expect } from '@playwright/test'

// Krytyczny flow #3: sesja wideo
// Implementacja po zbudowaniu domeny sessions + integracji Daily.co

test.skip('sesja wideo startuje po akceptacji zlecenia', async ({ page }) => {
  await page.goto('/')
  // TODO: po implementacji sessions
})
