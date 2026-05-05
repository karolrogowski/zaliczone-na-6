import { test, expect } from '@playwright/test'

// Krytyczny flow #1: rejestracja i logowanie
// Implementacja po zbudowaniu domeny auth

test.skip('student rejestruje się i loguje', async ({ page }) => {
  await page.goto('/')
  // TODO: po implementacji auth
})

test.skip('korepetytor rejestruje się z rolą tutor', async ({ page }) => {
  await page.goto('/')
  // TODO: po implementacji auth
})
