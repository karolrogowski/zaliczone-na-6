import { test, expect } from '@playwright/test'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { adminClient, TEST_PASSWORD, STUDENT_EMAIL, TUTOR1_EMAIL } from './global-setup'
import { loginAs, getTestUserIds } from './helpers'

const ADMIN_NO_MFA_EMAIL = 'sec-admin-nomfa@test.zaliczone.local'
const ATTACKER_EMAIL = 'sec-attacker-admin@test.zaliczone.local'
const SEC_TUTOR_EMAIL = 'sec-rls-tutor@test.zaliczone.local'
const SEC_STUDENT_EMAIL = 'sec-rls-student@test.zaliczone.local'

async function deleteIfExists(email: string) {
  const { byEmail } = await getTestUserIds()
  const id = byEmail(email)
  if (id) await adminClient().auth.admin.deleteUser(id)
}

test.beforeAll(async () => {
  const supabase = adminClient()

  for (const email of [ADMIN_NO_MFA_EMAIL, ATTACKER_EMAIL, SEC_TUTOR_EMAIL, SEC_STUDENT_EMAIL]) {
    await deleteIfExists(email)
  }

  // Admin bez MFA: user_metadata.role='admin' potrzebne do przejścia sprawdzenia w middleware
  const { data: adminData } = await supabase.auth.admin.createUser({
    email: ADMIN_NO_MFA_EMAIL,
    password: TEST_PASSWORD,
    user_metadata: { role: 'admin', full_name: 'Admin Bez MFA' },
    email_confirm: true,
  })
  // Trigger handle_new_user ustawia role='student' z whitelisty — ręcznie promujemy na admina
  if (adminData?.user) {
    await supabase.from('profiles').update({ role: 'admin' }).eq('id', adminData.user.id)
  }

  // Atakujący próbujący zarejestrować się jako admin przez metadane
  await supabase.auth.admin.createUser({
    email: ATTACKER_EMAIL,
    password: TEST_PASSWORD,
    user_metadata: { role: 'admin', full_name: 'Atakujący Admin' },
    email_confirm: true,
  })

  // Użytkownicy do testu RLS — celowo bez wspólnych zleceń
  await supabase.auth.admin.createUser({
    email: SEC_TUTOR_EMAIL,
    password: TEST_PASSWORD,
    user_metadata: { role: 'tutor', full_name: 'Korepetytor RLS' },
    email_confirm: true,
  })
  await supabase.auth.admin.createUser({
    email: SEC_STUDENT_EMAIL,
    password: TEST_PASSWORD,
    user_metadata: { role: 'student', full_name: 'Uczeń RLS' },
    email_confirm: true,
  })
})

test.afterAll(async () => {
  for (const email of [ADMIN_NO_MFA_EMAIL, ATTACKER_EMAIL, SEC_TUTOR_EMAIL, SEC_STUDENT_EMAIL]) {
    await deleteIfExists(email)
  }
})

// ─── Test 1: Eskalacja uprawnień przez rejestrację ────────────────────────────

test('rejestracja z role=admin w metadanych tworzy profil o roli student', async () => {
  const { byEmail } = await getTestUserIds()
  const userId = byEmail(ATTACKER_EMAIL)
  expect(userId).toBeDefined()

  const { data: profile } = await adminClient()
    .from('profiles')
    .select('role')
    .eq('id', userId!)
    .single()

  expect(profile?.role).toBe('student')
})

// ─── Test 2: Panel admina — niezalogowany użytkownik ─────────────────────────

test('niezalogowany dostęp do /admin/dashboard przekierowuje na /admin/login', async ({ page }) => {
  await page.goto('/admin/dashboard')
  await expect(page).toHaveURL('/admin/login')
})

// ─── Test 3: Panel admina — zalogowany uczeń ──────────────────────────────────

test('uczeń próbujący wejść na /admin/dashboard zostaje przekierowany na /dashboard', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/admin/dashboard')
  await expect(page).toHaveURL('/dashboard')
})

// ─── Test 4: Panel admina — zalogowany korepetytor ───────────────────────────

test('korepetytor próbujący wejść na /admin/dashboard zostaje przekierowany na /dashboard', async ({ page }) => {
  await loginAs(page, TUTOR1_EMAIL)
  await page.goto('/admin/dashboard')
  await expect(page).toHaveURL('/dashboard')
})

// ─── Test 5: Panel admina — admin bez skonfigurowanego MFA ───────────────────

test('admin bez skonfigurowanego MFA zostaje przekierowany na stronę konfiguracji TOTP', async ({ page }) => {
  await loginAs(page, ADMIN_NO_MFA_EMAIL)
  await page.goto('/admin/dashboard')
  // Brak TOTP → /admin/mfa/enroll; TOTP bez aal2 → /admin/mfa/verify
  await expect(page).toHaveURL(/\/admin\/mfa\/(enroll|verify)/)
})

// ─── Test 6: OTP type injection ───────────────────────────────────────────────

test('nieprawidłowy typ OTP w /auth/confirm przekierowuje na stronę błędu', async ({ page }) => {
  await page.goto('/auth/confirm?token_hash=fakehash&type=evil_payload')
  await expect(page).toHaveURL('/login?error=invalid_link')
})

test('/auth/confirm bez token_hash przekierowuje na stronę błędu', async ({ page }) => {
  await page.goto('/auth/confirm?type=signup')
  await expect(page).toHaveURL('/login?error=invalid_link')
})

// ─── Test 7: RLS — widoczność profilu ucznia ──────────────────────────────────

test('korepetytor bez wspólnej sesji nie widzi profilu ucznia', async () => {
  const { byEmail } = await getTestUserIds()
  const studentId = byEmail(SEC_STUDENT_EMAIL)
  expect(studentId).toBeDefined()

  const userClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  await userClient.auth.signInWithPassword({ email: SEC_TUTOR_EMAIL, password: TEST_PASSWORD })

  const { data } = await userClient
    .from('profiles')
    .select('id')
    .eq('id', studentId!)
    .maybeSingle()

  expect(data).toBeNull()

  await userClient.auth.signOut()
})
