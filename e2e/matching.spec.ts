import { test, expect } from '@playwright/test'

// Krytyczny flow #2: kojarzenie ucznia z korepetytorem
// Implementacja po zbudowaniu domeny matching

test.skip('uczeń składa zlecenie, korepetytor akceptuje', async ({ page }) => {
  await page.goto('/')
  // TODO: po implementacji matching
})

test.skip('korepetytor odrzuca zlecenie, trafia do kolejnego', async ({ page }) => {
  await page.goto('/')
  // TODO: po implementacji matching
})
