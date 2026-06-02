import { test, expect } from '@playwright/test'
import {
  STUDENT_EMAIL,
  TUTOR1_EMAIL,
  adminClient,
} from './global-setup'
import { loginAs, getTestUserIds } from './helpers'

async function getUserIds() {
  const { byEmail } = await getTestUserIds()
  return {
    studentId: byEmail(STUDENT_EMAIL)!,
    tutor1Id: byEmail(TUTOR1_EMAIL)!,
  }
}

const ORIGINAL_TUTOR_NAME = 'Testowy Korepetytor 1'

test.beforeEach(async () => {
  const db = adminClient()
  const ids = await getUserIds()

  // Resetuj profil korepetytora do stanu wyjściowego z global-setup
  await db
    .from('tutor_profiles')
    .update({ hourly_rate_grosz: 10000, is_available: false, levels: ['liceum_1', 'liceum_2', 'matura'], bio: null })
    .eq('id', ids.tutor1Id)

  await db.from('tutor_subjects').delete().eq('tutor_id', ids.tutor1Id)
  await db.from('tutor_subjects').insert({ tutor_id: ids.tutor1Id, subject_id: 'matematyka' })

  // Przywróć oryginalne imię na wypadek gdyby poprzedni test je zmienił
  await db.from('profiles').update({ full_name: ORIGINAL_TUTOR_NAME }).eq('id', ids.tutor1Id)

  // Wyczyść zlecenia i sesje ucznia (na wypadek testów z dostępnością)
  const { data: sessions } = await db.from('sessions').select('id').eq('student_id', ids.studentId)
  if (sessions?.length) {
    const sessionIds = sessions.map((s: { id: string }) => s.id)
    await db.from('ratings').delete().in('session_id', sessionIds)
    await db.from('session_financials').delete().in('session_id', sessionIds)
  }
  await db.from('sessions').delete().eq('student_id', ids.studentId)
  await db.from('matching_requests').delete().eq('student_id', ids.studentId)
})

// ════════════════════════════════════════════════════════════════════════════
// Test 1 — Formularz profilu korepetytora zapisuje dane do DB
// ════════════════════════════════════════════════════════════════════════════

test('korepetytor zapisuje profil — stawka i dane trafiają do DB poprawnie', async ({ page }) => {
  const ids = await getUserIds()

  await loginAs(page, TUTOR1_EMAIL)
  await page.goto('/profile')
  await page.waitForURL('/profile')

  // Odznacz bieżące poziomy (chipy), zaznacz nowy
  await page.getByRole('button', { name: 'I klasa liceum / technikum', exact: true }).click()
  await page.getByRole('button', { name: 'II klasa liceum / technikum', exact: true }).click()
  await page.getByRole('button', { name: 'Matura', exact: true }).click()
  await page.getByRole('button', { name: 'Szkoła podstawowa (kl. 7–8)', exact: true }).click()

  // Ustaw nową stawkę (150 PLN = 15000 groszy) i bio
  await page.fill('input[name="hourly_rate_pln"]', '150')
  await page.fill('textarea[name="bio"]', 'Specjalista od algebry')

  await page.getByRole('button', { name: 'Zapisz' }).click()
  await page.waitForURL('/dashboard', { timeout: 10_000 })

  // Weryfikacja w DB
  const { data: profile } = await adminClient()
    .from('tutor_profiles')
    .select('hourly_rate_grosz, bio, levels')
    .eq('id', ids.tutor1Id)
    .single()

  expect(profile?.hourly_rate_grosz).toBe(15000)
  expect(profile?.bio).toBe('Specjalista od algebry')
  expect(profile?.levels).toContain('sp_7_8')
  expect(profile?.levels).not.toContain('liceum_1')

  // Weryfikacja przedmiotu (matematyka powinna zostać)
  const { data: subjects } = await adminClient()
    .from('tutor_subjects')
    .select('subject_id')
    .eq('tutor_id', ids.tutor1Id)

  expect(subjects?.map((s: { subject_id: string }) => s.subject_id)).toContain('matematyka')
})

// ════════════════════════════════════════════════════════════════════════════
// Test 2 — Formularz /profile jest wstępnie wypełniony zapisanymi danymi
// ════════════════════════════════════════════════════════════════════════════

test('formularz profilu korepetytora jest wstępnie wypełniony danymi z DB', async ({ page }) => {
  const ids = await getUserIds()

  // Ustaw konkretne wartości w DB
  await adminClient()
    .from('tutor_profiles')
    .update({ hourly_rate_grosz: 12000, bio: 'Bio testowe', levels: ['matura'] })
    .eq('id', ids.tutor1Id)

  await loginAs(page, TUTOR1_EMAIL)
  await page.goto('/profile')
  await page.waitForURL('/profile')

  // Stawka powinna być wyświetlona w PLN (120,00 lub 120.00 zależnie od locale)
  const rateValue = await page.inputValue('input[name="hourly_rate_pln"]')
  expect(rateValue).toMatch(/120/)

  // Bio pre-filled
  const bioValue = await page.inputValue('textarea[name="bio"]')
  expect(bioValue).toBe('Bio testowe')

  // Chip poziomu 'matura' aktywny (hidden input istnieje), 'liceum_1' nieaktywny (brak hidden input)
  await expect(page.locator('input[name="levels"][value="matura"]')).toHaveCount(1)
  await expect(page.locator('input[name="levels"][value="liceum_1"]')).toHaveCount(0)

  // Przedmiot matematyka aktywny
  await expect(page.locator('input[name="subject_ids"][value="matematyka"]')).toHaveCount(1)
})

// ════════════════════════════════════════════════════════════════════════════
// Test 3 — Uczeń na /profile jest przekierowany do dashboardu
// ════════════════════════════════════════════════════════════════════════════

test('uczeń wchodzący na /profile jest przekierowany do dashboardu', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/profile')
  await expect(page).toHaveURL('/dashboard')
})

// ════════════════════════════════════════════════════════════════════════════
// Test 4 — Toggle dostępności (OFF→ON) zapisuje się do DB
// ════════════════════════════════════════════════════════════════════════════

test('włączenie dostępności korepetytora zapisuje is_available=true w DB', async ({ page }) => {
  const ids = await getUserIds()

  // Stan wyjściowy: is_available=false (ustawiony w beforeEach)
  await loginAs(page, TUTOR1_EMAIL)

  const toggle = page.getByTestId('availability-toggle')
  await expect(toggle).toHaveAttribute('aria-checked', 'false')

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true', { timeout: 5_000 })

  // Poczekaj aż server action dobiegnie końca
  await page.waitForTimeout(2_000)

  const { data } = await adminClient()
    .from('tutor_profiles')
    .select('is_available')
    .eq('id', ids.tutor1Id)
    .single()

  expect(data?.is_available).toBe(true)
})

// ════════════════════════════════════════════════════════════════════════════
// Test 5 — Toggle dostępności (ON→OFF) zapisuje się do DB
// ════════════════════════════════════════════════════════════════════════════

test('wyłączenie dostępności korepetytora zapisuje is_available=false w DB', async ({ page }) => {
  const ids = await getUserIds()

  // Ustaw is_available=true przed testem
  await adminClient()
    .from('tutor_profiles')
    .update({ is_available: true })
    .eq('id', ids.tutor1Id)

  await loginAs(page, TUTOR1_EMAIL)

  const toggle = page.getByTestId('availability-toggle')
  await expect(toggle).toHaveAttribute('aria-checked', 'true', { timeout: 5_000 })

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false', { timeout: 5_000 })

  await page.waitForTimeout(2_000)

  const { data } = await adminClient()
    .from('tutor_profiles')
    .select('is_available')
    .eq('id', ids.tutor1Id)
    .single()

  expect(data?.is_available).toBe(false)
})

// ════════════════════════════════════════════════════════════════════════════
// Test 6 — Publiczny profil korepetytora widoczny dla ucznia
// ════════════════════════════════════════════════════════════════════════════

test('uczeń widzi publiczny profil korepetytora z imieniem i stawką', async ({ page }) => {
  const ids = await getUserIds()

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/tutor/${ids.tutor1Id}`)

  await expect(page.getByRole('heading', { name: ORIGINAL_TUTOR_NAME })).toBeVisible({ timeout: 10_000 })
  // Stawka 100 PLN (10000 groszy z beforeEach)
  await expect(page.getByText('100 PLN/h')).toBeVisible()
})

// ════════════════════════════════════════════════════════════════════════════
// Test 7 — Nieistniejące ID tutora → redirect do /dashboard
// ════════════════════════════════════════════════════════════════════════════

test('wejście na /tutor z nieistniejącym ID przekierowuje do dashboardu', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/tutor/00000000-0000-0000-0000-000000000000')
  await expect(page).toHaveURL('/dashboard')
})

// ════════════════════════════════════════════════════════════════════════════
// Test 8 — Zmiana imienia w ustawieniach → komunikat sukcesu + aktualizacja DB
// ════════════════════════════════════════════════════════════════════════════

test('zmiana imienia w ustawieniach wyświetla potwierdzenie i aktualizuje DB', async ({ page }) => {
  const ids = await getUserIds()
  const newName = 'Zmieniona Nazwa Testowa'

  await loginAs(page, TUTOR1_EMAIL)
  await page.goto('/settings')
  await page.waitForURL('/settings')

  // Sekcja "Dane osobowe" — pole full_name, przycisk "Zapisz"
  await page.fill('input[name="full_name"]', newName)
  // Formularz "Dane osobowe" — identyfikujemy po polu full_name żeby nie pomylić z formularzem wylogowania w layoucie
  await page.locator('form:has(input[name="full_name"])').getByRole('button', { name: 'Zapisz' }).click()

  await expect(page.getByText('Dane zostały zaktualizowane.')).toBeVisible({ timeout: 10_000 })

  // Weryfikacja w DB
  const { data: profile } = await adminClient()
    .from('profiles')
    .select('full_name')
    .eq('id', ids.tutor1Id)
    .single()

  expect(profile?.full_name).toBe(newName)

  // Przywróć oryginalne imię — inne testy sprawdzają "Testowy Korepetytor 1"
  await adminClient().from('profiles').update({ full_name: ORIGINAL_TUTOR_NAME }).eq('id', ids.tutor1Id)
})

// ════════════════════════════════════════════════════════════════════════════
// Test 9 — Korepetytor nie widzi przycisku "Anuluj zlecenie" w liście zleceń
// ════════════════════════════════════════════════════════════════════════════

test('korepetytor widzi przycisk "Akceptuj zlecenie" ale nie "Anuluj zlecenie" dla zleceń uczniów', async ({ page }) => {
  const ids = await getUserIds()

  // Utwórz zlecenie ucznia i ustaw tutora jako dostępnego
  await adminClient().from('matching_requests').insert({
    student_id: ids.studentId,
    subject_id: 'matematyka',
    status: 'pending',
  })
  await adminClient()
    .from('tutor_profiles')
    .update({ is_available: true })
    .eq('id', ids.tutor1Id)

  await loginAs(page, TUTOR1_EMAIL)

  await expect(page.getByRole('button', { name: 'Akceptuj zlecenie' })).toBeVisible({ timeout: 10_000 })
  // Korepetytor nigdy nie powinien widzieć przycisku anulowania cudzych zleceń
  await expect(page.getByRole('button', { name: 'Anuluj zlecenie' })).not.toBeVisible()
})