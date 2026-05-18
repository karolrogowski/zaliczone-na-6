import { test, expect, type Page } from '@playwright/test'
import { STUDENT_EMAIL, adminClient } from './global-setup'
import { getTestUserIds } from './helpers'

const NEW_STUDENT_EMAIL = 'reg-new-student@test.zaliczone.local'
const NEW_TUTOR_EMAIL = 'reg-new-tutor@test.zaliczone.local'
const STRONG_PASSWORD = 'Rejestracja1!'

async function deleteIfExists(email: string) {
  const { byEmail } = await getTestUserIds()
  const id = byEmail(email)
  if (id) await adminClient().auth.admin.deleteUser(id)
}

test.beforeAll(async () => {
  // Usuń resztki po poprzednich uruchomieniach, żeby rejestracja mogła się udać
  await deleteIfExists(NEW_STUDENT_EMAIL)
  await deleteIfExists(NEW_TUTOR_EMAIL)
})

test.afterAll(async () => {
  await deleteIfExists(NEW_STUDENT_EMAIL)
  await deleteIfExists(NEW_TUTOR_EMAIL)
})

async function fillRegisterForm(
  page: Page,
  email: string,
  role: 'student' | 'tutor',
  options: { password?: string; fullName?: string } = {}
) {
  await page.goto('/register')
  await page.fill('input[name="full_name"]', options.fullName ?? 'Jan Testowy')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', options.password ?? STRONG_PASSWORD)
  await page.locator(`input[name="role"][value="${role}"]`).check()
}

// ════════════════════════════════════════════════════════════════════════════
// Test 1 — Rejestracja jako uczeń → /check-email
// ════════════════════════════════════════════════════════════════════════════

test('rejestracja jako uczeń przekierowuje na stronę potwierdzenia emaila', async ({ page }) => {
  await fillRegisterForm(page, NEW_STUDENT_EMAIL, 'student')
  await page.getByRole('button', { name: 'Zarejestruj się' }).click()

  await page.waitForURL('/check-email', { timeout: 10_000 })
  await expect(page.getByRole('heading', { name: 'Sprawdź skrzynkę mailową' })).toBeVisible()
  await expect(page.getByText('Wysłaliśmy link potwierdzający')).toBeVisible()
})

// ════════════════════════════════════════════════════════════════════════════
// Test 2 — Rejestracja jako korepetytor → /check-email
// ════════════════════════════════════════════════════════════════════════════

test('rejestracja jako korepetytor przekierowuje na stronę potwierdzenia emaila', async ({ page }) => {
  await fillRegisterForm(page, NEW_TUTOR_EMAIL, 'tutor')
  await page.getByRole('button', { name: 'Zarejestruj się' }).click()

  await page.waitForURL('/check-email', { timeout: 10_000 })
  await expect(page.getByRole('heading', { name: 'Sprawdź skrzynkę mailową' })).toBeVisible()
})

// ════════════════════════════════════════════════════════════════════════════
// Test 3 — Rejestracja z istniejącym emailem → komunikat błędu
// ════════════════════════════════════════════════════════════════════════════

test('rejestracja z istniejącym emailem wyświetla komunikat błędu w formularzu', async ({ page }) => {
  // STUDENT_EMAIL już istnieje w bazie (tworzony przez global-setup)
  await fillRegisterForm(page, STUDENT_EMAIL, 'student')
  await page.getByRole('button', { name: 'Zarejestruj się' }).click()

  await expect(page.getByText('Konto z tym adresem email już istnieje')).toBeVisible({ timeout: 10_000 })
  // Użytkownik pozostaje na /register — nie doszło do redirect
  expect(page.url()).toContain('/register')
})

// ════════════════════════════════════════════════════════════════════════════
// Test 4 — Rejestracja ze zbyt krótkim hasłem → walidacja
// ════════════════════════════════════════════════════════════════════════════

test('rejestracja ze zbyt krótkim hasłem wyświetla błąd walidacji', async ({ page }) => {
  await fillRegisterForm(page, 'walidacja@test.zaliczone.local', 'student', { password: 'abc123' })
  await page.getByRole('button', { name: 'Zarejestruj się' }).click()

  await expect(page.getByText('Hasło musi mieć co najmniej 8 znaków')).toBeVisible({ timeout: 10_000 })
  expect(page.url()).toContain('/register')
})