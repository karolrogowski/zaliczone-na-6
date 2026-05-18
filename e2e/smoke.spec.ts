import { test, expect } from '@playwright/test'

// Smoke testy uruchamiane przeciwko wdrożonej aplikacji (preview lub produkcja).
// Weryfikują najwcześniej możliwe, że deployment jest sprawny zanim trafi na produkcję.
// Wymagają: SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD — użytkownik istniejący w chmurowym Supabase.

// ─── Środowisko ───────────────────────────────────────────────────────────────

test('health check: zmienne środowiskowe Supabase skonfigurowane i osiągalne', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.status(), 'Supabase nieosiągalny lub brakuje env vars — sprawdź konfigurację w Vercel').toBe(200)
  const body = await res.json()
  expect(body.ok, body.error).toBe(true)
})

// ─── Autentykacja ─────────────────────────────────────────────────────────────

test('logowanie użytkownika testowego działa na wdrożonym środowisku', async ({ page }) => {
  const email = process.env.SMOKE_TEST_EMAIL
  const password = process.env.SMOKE_TEST_PASSWORD

  if (!email || !password) {
    test.skip(true, 'Brak SMOKE_TEST_EMAIL / SMOKE_TEST_PASSWORD — pomiń test logowania')
    return
  }

  await page.goto('/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')

  await expect(page, 'Logowanie nie powiodło się — weryfikuj klucze Supabase w Vercel').toHaveURL(
    /\/dashboard/,
    { timeout: 15_000 }
  )
})

test('wylogowanie i próba wejścia na /dashboard przekierowuje na /login', async ({ page }) => {
  const email = process.env.SMOKE_TEST_EMAIL
  const password = process.env.SMOKE_TEST_PASSWORD

  if (!email || !password) {
    test.skip(true, 'Brak SMOKE_TEST_EMAIL / SMOKE_TEST_PASSWORD')
    return
  }

  await page.goto('/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 })

  await page.getByRole('button', { name: 'Wyloguj' }).click()
  await page.waitForURL('/login')

  await page.goto('/dashboard')
  await expect(page).toHaveURL('/login')
})
