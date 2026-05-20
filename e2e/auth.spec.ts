import { test, expect } from '@playwright/test'
import {
  STUDENT_EMAIL,
  RESET_USER_EMAIL,
  TEST_PASSWORD,
  adminClient,
} from './global-setup'
import { loginAs, getEmailLink, clearMailpit, getTestUserIds } from './helpers'

const UNCONFIRMED_EMAIL = 'unconfirmed@test.zaliczone.local'
const NEW_PASSWORD = 'NoweHaslo999!'

// ─── Przygotowanie efemerycznego konta bez potwierdzonego maila ──────────────

test.beforeAll(async () => {
  await adminClient().auth.admin.createUser({
    email: UNCONFIRMED_EMAIL,
    password: TEST_PASSWORD,
    user_metadata: { role: 'student', full_name: 'Tymczasowy Użytkownik' },
    email_confirm: false,
  })
})

test.afterAll(async () => {
  const { byEmail } = await getTestUserIds()
  const id = byEmail(UNCONFIRMED_EMAIL)
  if (id) await adminClient().auth.admin.deleteUser(id)

  // Przywróć oryginalne hasło użytkownika reset po ewentualnym teście
  const resetId = byEmail(RESET_USER_EMAIL)
  if (resetId) {
    await adminClient().auth.admin.updateUserById(resetId, { password: TEST_PASSWORD })
  }
})

// ─── Test 1 ──────────────────────────────────────────────────────────────────

test('logowanie złym hasłem pokazuje błąd', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="email"]', STUDENT_EMAIL)
  await page.fill('input[name="password"]', 'zlehaslo123')
  await page.click('button[type="submit"]')

  await expect(page.getByText('Nieprawidłowy email lub hasło')).toBeVisible()
  expect(page.url()).toContain('/login')
})

// ─── Test 2 ──────────────────────────────────────────────────────────────────

test('logowanie przed potwierdzeniem emaila zwraca generyczny komunikat (user enumeration defense)', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="email"]', UNCONFIRMED_EMAIL)
  await page.fill('input[name="password"]', TEST_PASSWORD)
  await page.click('button[type="submit"]')

  // Ujednolicony komunikat — nie ujawnia czy konto istnieje ani czy jest niezweryfikowane
  await expect(page.getByText('Nieprawidłowy email lub hasło lub konto niezweryfikowane')).toBeVisible()
  expect(page.url()).toContain('/login')
})

// ─── Test 3 ──────────────────────────────────────────────────────────────────

test('wejście na /dashboard bez logowania przekierowuje na /login', async ({ page }) => {
  await page.goto('/dashboard')
  await page.waitForURL('/login')
  expect(page.url()).toContain('/login')
})

// ─── Test 4 ──────────────────────────────────────────────────────────────────

test('wejście na /login będąc zalogowanym przekierowuje na /dashboard', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/login')
  await page.waitForURL('/dashboard')
  expect(page.url()).toContain('/dashboard')
})

// ─── Test 5 ──────────────────────────────────────────────────────────────────

test('pełny flow resetu hasła: formularz → email → nowe hasło → logowanie', async ({ page }) => {
  await clearMailpit()

  // Krok 1: Formularz resetu
  await page.goto('/forgot-password')
  await page.fill('input[name="email"]', RESET_USER_EMAIL)
  await page.click('button[type="submit"]')
  await expect(page.getByText('wysłaliśmy link')).toBeVisible()

  // Krok 2: Pobierz link z Mailpit
  const resetLink = await getEmailLink(RESET_USER_EMAIL, '/auth/confirm')

  // Krok 3: Kliknij link — trafiasz na stronę nowego hasła
  await page.goto(resetLink)
  await page.waitForURL('/reset-password')

  // Krok 4: Ustaw nowe hasło
  await page.fill('input[name="password"]', NEW_PASSWORD)
  await page.fill('input[name="confirmPassword"]', NEW_PASSWORD)
  await page.click('button[type="submit"]')

  // Krok 5: Po resecie → ekran logowania
  await page.waitForURL('/login')

  // Krok 6: Zaloguj się nowym hasłem
  await page.fill('input[name="email"]', RESET_USER_EMAIL)
  await page.fill('input[name="password"]', NEW_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
  expect(page.url()).toContain('/dashboard')
})

// ─── Test 6 ──────────────────────────────────────────────────────────────────

test('wylogowanie czyści sesję i blokuje dostęp do chronionych tras', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)
  await expect(page).toHaveURL('/dashboard')

  // Kliknij "Wyloguj" w formularzu w layoucie
  await page.getByRole('button', { name: 'Wyloguj' }).click()
  await page.waitForURL('/login')

  // Próba wejścia na chronioną trasę po wylogowaniu → redirect do /login
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/login')

  // Próba wejścia na stronę sesji po wylogowaniu → redirect do /login
  await page.goto('/session/some-fake-id')
  await expect(page).toHaveURL('/login')
})
