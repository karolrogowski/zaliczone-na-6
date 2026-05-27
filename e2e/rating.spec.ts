import { test, expect } from '@playwright/test'
import {
  STUDENT_EMAIL,
  TUTOR1_EMAIL,
  adminClient,
} from './global-setup'
import { loginAs, getTestUserIds } from './helpers'
import { mockRoomUrl, mockHostUrl } from './video-fixtures'

async function getUserIds() {
  const { byEmail } = await getTestUserIds()
  return {
    studentId: byEmail(STUDENT_EMAIL)!,
    tutor1Id: byEmail(TUTOR1_EMAIL)!,
  }
}

async function createCompletedSession(ids: { studentId: string; tutor1Id: string }) {
  const db = adminClient()

  const { data: request } = await db
    .from('matching_requests')
    .insert({
      student_id: ids.studentId,
      tutor_id: ids.tutor1Id,
      subject_id: 'matematyka',
      status: 'completed',
    })
    .select()
    .single()

  const { data: session } = await db
    .from('sessions')
    .insert({
      matching_request_id: request.id,
      student_id: ids.studentId,
      tutor_id: ids.tutor1Id,
      daily_room_name: 'test-room-rating',
      daily_room_url: mockRoomUrl('test-room-rating'),
      host_room_url: mockHostUrl('test-room-rating'),
      status: 'completed',
      started_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      ended_at: new Date().toISOString(),
      duration_minutes: 30,
    })
    .select()
    .single()

  return { request, session }
}

async function cleanupRatingTests() {
  const db = adminClient()
  const ids = await getUserIds()
  await db.from('ratings').delete().eq('tutor_id', ids.tutor1Id)
  await db.from('sessions').delete().eq('student_id', ids.studentId)
  await db.from('matching_requests').delete().eq('student_id', ids.studentId)
  // Zresetuj dostępność korepetytora (może być zmieniona przez test filtra avoid)
  await db.from('tutor_profiles').update({ is_available: false }).eq('id', ids.tutor1Id)
}

test.beforeEach(cleanupRatingTests)
test.afterAll(cleanupRatingTests)

// ─── Test 1 ──────────────────────────────────────────────────────────────────

test('uczeń widzi formularz oceny po zakończonej sesji', async ({ page }) => {
  const ids = await getUserIds()
  const { request } = await createCompletedSession(ids)

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/rate/${request.id}`)

  await expect(page.getByText(/Oceń korepetytora/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Wyślij ocenę' })).toBeVisible()
  await expect(page.locator('input[name="score"]')).toHaveCount(5)
})

// ─── Test 2 ──────────────────────────────────────────────────────────────────

test('uczeń może wystawić ocenę i wraca do dashboardu', async ({ page }) => {
  const ids = await getUserIds()
  const { request, session } = await createCompletedSession(ids)

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/rate/${request.id}`)

  await page.locator('input[name="score"][value="5"]').evaluate(el => (el as HTMLInputElement).click())
  await expect(page.getByRole('button', { name: 'Wyślij ocenę' })).toBeEnabled({ timeout: 3_000 })
  await page.fill('textarea[name="comment"]', 'Świetna sesja, wszystko jasno wytłumaczone.')
  await page.getByRole('button', { name: 'Wyślij ocenę' }).click()

  await page.waitForURL(/ocena=zapisana/, { timeout: 10_000 })
  const { data: rating } = await adminClient()
    .from('ratings')
    .select('id, score, comment, rated_by')
    .eq('session_id', session.id)
    .eq('rated_by', 'student')
    .maybeSingle()

  expect(rating).not.toBeNull()
  expect(rating?.score).toBe(5)
  expect(rating?.rated_by).toBe('student')
})

// ─── Test 3 ──────────────────────────────────────────────────────────────────

test('uczeń nie może ocenić tej samej sesji dwa razy', async ({ page }) => {
  const ids = await getUserIds()
  const { request, session } = await createCompletedSession(ids)

  // Wstaw ocenę ucznia bezpośrednio w DB
  await adminClient().from('ratings').insert({
    session_id: session.id,
    student_id: ids.studentId,
    tutor_id: ids.tutor1Id,
    score: 4,
    rated_by: 'student',
  })

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/rate/${request.id}`)

  // Już oceniona przez ucznia → redirect do /dashboard
  await expect(page).toHaveURL('/dashboard')
})

// ─── Test 4 ──────────────────────────────────────────────────────────────────

test('korepetytor widzi formularz oceny ucznia po zakończonej sesji', async ({ page }) => {
  const ids = await getUserIds()
  const { request } = await createCompletedSession(ids)

  await loginAs(page, TUTOR1_EMAIL)
  await page.goto(`/rate/${request.id}`)

  // Korepetytor powinien widzieć swój formularz
  await expect(page.getByText(/Oceń ucznia/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Wyślij ocenę' })).toBeVisible()
  await expect(page.locator('input[name="score"]')).toHaveCount(5)
  // Korepetytor nie widzi checkboxów preferencji
  await expect(page.getByText('Preferencje')).not.toBeVisible()
})

// ─── Test 5 ──────────────────────────────────────────────────────────────────

test('korepetytor może wystawić ocenę uczniowi', async ({ page }) => {
  const ids = await getUserIds()
  const { request, session } = await createCompletedSession(ids)

  await loginAs(page, TUTOR1_EMAIL)
  await page.goto(`/rate/${request.id}`)

  await page.locator('input[name="score"][value="4"]').evaluate(el => (el as HTMLInputElement).click())
  await expect(page.getByRole('button', { name: 'Wyślij ocenę' })).toBeEnabled({ timeout: 3_000 })
  await page.getByRole('button', { name: 'Wyślij ocenę' }).click()

  await page.waitForURL(/ocena=zapisana/, { timeout: 10_000 })
  const { data: rating } = await adminClient()
    .from('ratings')
    .select('id, score, rated_by')
    .eq('session_id', session.id)
    .eq('rated_by', 'tutor')
    .maybeSingle()

  expect(rating).not.toBeNull()
  expect(rating?.score).toBe(4)
  expect(rating?.rated_by).toBe('tutor')
})

// ─── Test 6 ──────────────────────────────────────────────────────────────────

test('strona oceny z niezakończoną sesją przekierowuje do dashboardu', async ({ page }) => {
  const ids = await getUserIds()
  const db = adminClient()

  const { data: request } = await db
    .from('matching_requests')
    .insert({
      student_id: ids.studentId,
      tutor_id: ids.tutor1Id,
      subject_id: 'matematyka',
      status: 'accepted',
    })
    .select()
    .single()

  await db.from('sessions').insert({
    matching_request_id: request.id,
    student_id: ids.studentId,
    tutor_id: ids.tutor1Id,
    daily_room_url: mockRoomUrl('test-pending'),
    host_room_url: mockHostUrl('test-pending'),
    daily_room_name: 'test-pending',
    status: 'in_progress',
    started_at: new Date().toISOString(),
    duration_minutes: 60,
  })

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/rate/${request.id}`)

  await expect(page).toHaveURL('/dashboard')
})

// ─── Test 7 ──────────────────────────────────────────────────────────────────

test('formularz nie ma przycisku "Pomiń" (ADR-006 §1)', async ({ page }) => {
  const ids = await getUserIds()
  const { request } = await createCompletedSession(ids)

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/rate/${request.id}`)

  // ADR-006: ocena obowiązkowa — brak przycisku Pomiń
  await expect(page.getByRole('link', { name: 'Pomiń' })).not.toBeVisible()
  await expect(page.getByRole('button', { name: /pomiń/i })).not.toBeVisible()
})

// ─── Test 8 ──────────────────────────────────────────────────────────────────

test('przycisk "Wyślij ocenę" jest wyłączony bez gwiazdki i aktywuje się po jej wyborze', async ({ page }) => {
  const ids = await getUserIds()
  const { request } = await createCompletedSession(ids)

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/rate/${request.id}`)

  const submitBtn = page.getByRole('button', { name: 'Wyślij ocenę' })

  // Bez wyboru gwiazdki przycisk powinien być wyłączony (disabled={selected === 0})
  await expect(submitBtn).toBeDisabled()

  // Po kliknięciu gwiazdki 4 przycisk aktywuje się (score >= 3 → komentarz opcjonalny)
  await page.locator('input[name="score"][value="4"]').evaluate(el => (el as HTMLInputElement).click())
  await expect(submitBtn).toBeEnabled({ timeout: 3_000 })

  // Etykieta opisująca ocenę 4 powinna być widoczna
  await expect(page.getByText('Dobrze')).toBeVisible()
})

// ─── Test 9 ──────────────────────────────────────────────────────────────────

test('przy ocenie 1–2 gwiazdki komentarz jest wymagany (min. 50 znaków)', async ({ page }) => {
  const ids = await getUserIds()
  const { request } = await createCompletedSession(ids)

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/rate/${request.id}`)

  const submitBtn = page.getByRole('button', { name: 'Wyślij ocenę' })

  // Wybór 1 gwiazdki — przycisk zablokowany, bo komentarz pusty
  await page.locator('input[name="score"][value="1"]').evaluate(el => (el as HTMLInputElement).click())
  await expect(submitBtn).toBeDisabled({ timeout: 3_000 })

  // Krótki komentarz (< 50 znaków) — wciąż zablokowany
  await page.fill('textarea[name="comment"]', 'Za krótki')
  await expect(submitBtn).toBeDisabled()

  // Komentarz >= 50 znaków — przycisk aktywuje się
  await page.fill('textarea[name="comment"]', 'Korepetytor nie był przygotowany i nie odpowiedział na żadne moje pytanie.')
  await expect(submitBtn).toBeEnabled({ timeout: 3_000 })
})

// ─── Test 10 ──────────────────────────────────────────────────────────────────

test('uczeń widzi przyciski preferencji, korepetytor ich nie widzi', async ({ page }) => {
  const ids = await getUserIds()
  const { request } = await createCompletedSession(ids)

  // Sprawdzamy widok ucznia
  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/rate/${request.id}`)
  await expect(page.getByText('Preferencje')).toBeVisible()
  await expect(page.getByRole('button', { name: /Chcę uczyć się z tym korepetytorem/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Nie polecaj mi tego korepetytora/ })).toBeVisible()

  // Wyloguj studenta — student ma pending rating, więc bez wyczyszczenia cookies
  // middleware przekierowuje z /login → /rate i loginAs nigdy nie widzi formularza.
  await page.context().clearCookies()

  // Czyścimy ocenę ucznia i sprawdzamy widok korepetytora
  await adminClient().from('ratings').delete().eq('tutor_id', ids.tutor1Id)

  await loginAs(page, TUTOR1_EMAIL)
  await page.goto(`/rate/${request.id}`)
  await expect(page.getByText('Preferencje')).not.toBeVisible()
})

// ─── Test 11 ──────────────────────────────────────────────────────────────────

test('przyciski preferencji ucznia działają jak toggle: wzajemnie wykluczające się, ponowne kliknięcie odznacza', async ({ page }) => {
  const ids = await getUserIds()
  const { request } = await createCompletedSession(ids)

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/rate/${request.id}`)

  const wantAgainBtn = page.getByRole('button', { name: /Chcę uczyć się z tym korepetytorem/ })
  const avoidBtn     = page.getByRole('button', { name: /Nie polecaj mi tego korepetytora/ })

  // Domyślnie żaden przycisk nie jest wciśnięty
  await expect(wantAgainBtn).toHaveAttribute('aria-pressed', 'false')
  await expect(avoidBtn).toHaveAttribute('aria-pressed', 'false')

  // Kliknięcie "Chcę uczyć się z tym korepetytorem" — aktywuje
  await wantAgainBtn.click()
  await expect(wantAgainBtn).toHaveAttribute('aria-pressed', 'true')
  await expect(avoidBtn).toHaveAttribute('aria-pressed', 'false')

  // Kliknięcie "Nie polecaj mi tego korepetytora" — przełącza na avoid
  await avoidBtn.click()
  await expect(avoidBtn).toHaveAttribute('aria-pressed', 'true')
  await expect(wantAgainBtn).toHaveAttribute('aria-pressed', 'false')

  // Ponowne kliknięcie aktywnego przycisku — odznacza (brak preferencji)
  await avoidBtn.click()
  await expect(avoidBtn).toHaveAttribute('aria-pressed', 'false')
  await expect(wantAgainBtn).toHaveAttribute('aria-pressed', 'false')
})

// ─── Test 12 ──────────────────────────────────────────────────────────────────

test('preferencja "avoid" zapisuje się w bazie po wysłaniu oceny', async ({ page }) => {
  const ids = await getUserIds()
  const { request, session } = await createCompletedSession(ids)

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/rate/${request.id}`)

  await page.locator('input[name="score"][value="4"]').evaluate(el => (el as HTMLInputElement).click())
  await expect(page.getByRole('button', { name: 'Wyślij ocenę' })).toBeEnabled({ timeout: 3_000 })
  await page.getByRole('button', { name: /Nie polecaj mi tego korepetytora/ }).click()
  await page.getByRole('button', { name: 'Wyślij ocenę' }).click()

  await page.waitForURL(/ocena=zapisana/, { timeout: 10_000 })

  const { data: rating } = await adminClient()
    .from('ratings')
    .select('preference')
    .eq('session_id', session.id)
    .eq('rated_by', 'student')
    .maybeSingle()

  expect(rating?.preference).toBe('avoid')
})

// ─── Test 13 ──────────────────────────────────────────────────────────────────

test('preferencja "want_again" zapisuje się w bazie po wysłaniu oceny', async ({ page }) => {
  const ids = await getUserIds()
  const { request, session } = await createCompletedSession(ids)

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/rate/${request.id}`)

  await page.locator('input[name="score"][value="5"]').evaluate(el => (el as HTMLInputElement).click())
  await expect(page.getByRole('button', { name: 'Wyślij ocenę' })).toBeEnabled({ timeout: 3_000 })
  await page.getByRole('button', { name: /Chcę uczyć się z tym korepetytorem/ }).click()
  await page.getByRole('button', { name: 'Wyślij ocenę' }).click()

  await page.waitForURL(/ocena=zapisana/, { timeout: 10_000 })

  const { data: rating } = await adminClient()
    .from('ratings')
    .select('preference')
    .eq('session_id', session.id)
    .eq('rated_by', 'student')
    .maybeSingle()

  expect(rating?.preference).toBe('want_again')
})

// ─── Test 14 ──────────────────────────────────────────────────────────────────

test('korepetytor może oznaczyć ucznia flagą (tutor_preference = "flag")', async ({ page }) => {
  const ids = await getUserIds()
  const { request, session } = await createCompletedSession(ids)

  await loginAs(page, TUTOR1_EMAIL)
  await page.goto(`/rate/${request.id}`)

  await page.locator('input[name="score"][value="4"]').evaluate(el => (el as HTMLInputElement).click())
  await expect(page.getByRole('button', { name: 'Wyślij ocenę' })).toBeEnabled({ timeout: 3_000 })
  // Checkbox "Oznacz tego ucznia jako problematycznego"
  await page.getByRole('checkbox').click()
  await page.getByRole('button', { name: 'Wyślij ocenę' }).click()

  await page.waitForURL(/ocena=zapisana/, { timeout: 10_000 })

  const { data: rating } = await adminClient()
    .from('ratings')
    .select('tutor_preference')
    .eq('session_id', session.id)
    .eq('rated_by', 'tutor')
    .maybeSingle()

  expect(rating?.tutor_preference).toBe('flag')
})

// ─── Test 15 ──────────────────────────────────────────────────────────────────

test('po wystawieniu oceny pojawia się baner sukcesu na dashboardzie', async ({ page }) => {
  const ids = await getUserIds()
  const { request } = await createCompletedSession(ids)

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/rate/${request.id}`)

  await page.locator('input[name="score"][value="5"]').evaluate(el => (el as HTMLInputElement).click())
  await expect(page.getByRole('button', { name: 'Wyślij ocenę' })).toBeEnabled({ timeout: 3_000 })
  await page.getByRole('button', { name: 'Wyślij ocenę' }).click()

  // Czekamy na redirect do /dashboard?ocena=zapisana
  await page.waitForURL(/ocena=zapisana/, { timeout: 10_000 })
  await expect(page.getByText(/Ocena została zapisana/)).toBeVisible()
})

// ─── Test 16 ──────────────────────────────────────────────────────────────────

test('na stronie /rate widoczny jest baner informacyjny o wymaganiu oceny', async ({ page }) => {
  const ids = await getUserIds()
  const { request } = await createCompletedSession(ids)

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/rate/${request.id}`)

  await expect(page.getByText(/Ocena jest wymagana przed przejściem dalej/)).toBeVisible()
})

// ─── Test 17 ──────────────────────────────────────────────────────────────────

test('korepetytor nie widzi zleceń od ucznia, który oznaczył go jako "avoid"', async ({ page }) => {
  const ids = await getUserIds()
  const db = adminClient()

  // 1. Stara sesja (>4h) — korepetytor poza oknem blokady /rate
  const { data: oldRequest } = await db
    .from('matching_requests')
    .insert({
      student_id: ids.studentId,
      tutor_id: ids.tutor1Id,
      subject_id: 'matematyka',
      status: 'completed',
    })
    .select()
    .single()

  const { data: oldSession } = await db
    .from('sessions')
    .insert({
      matching_request_id: oldRequest.id,
      student_id: ids.studentId,
      tutor_id: ids.tutor1Id,
      daily_room_name: 'test-room-avoid',
      daily_room_url: mockRoomUrl('test-room-avoid'),
      host_room_url: mockHostUrl('test-room-avoid'),
      status: 'completed',
      started_at: new Date(Date.now() - 5 * 60 * 60 * 1000 - 30 * 60 * 1000).toISOString(),
      ended_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      duration_minutes: 30,
    })
    .select()
    .single()

  // Ocena ucznia z preferencją "avoid"
  await db.from('ratings').insert({
    session_id: oldSession.id,
    student_id: ids.studentId,
    tutor_id: ids.tutor1Id,
    score: 3,
    rated_by: 'student',
    preference: 'avoid',
  })

  // Ocena korepetytora — żeby nie był blokowany przez 4h okno
  await db.from('ratings').insert({
    session_id: oldSession.id,
    student_id: ids.studentId,
    tutor_id: ids.tutor1Id,
    score: 4,
    rated_by: 'tutor',
  })

  // 2. Nowe oczekujące zlecenie od ucznia (wygaśnięcie za 1h)
  await db.from('matching_requests').insert({
    student_id: ids.studentId,
    subject_id: 'matematyka',
    status: 'pending',
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  })

  // 3. Korepetytor musi być dostępny, żeby RLS pokazało pending requests
  await db.from('tutor_profiles').update({ is_available: true }).eq('id', ids.tutor1Id)

  // 4. Logujemy jako korepetytor
  await loginAs(page, TUTOR1_EMAIL)

  // 5. Sekcja "Oczekujące zlecenia" powinna być widoczna (is_available=true)
  await expect(page.getByText('Oczekujące zlecenia')).toBeVisible({ timeout: 5_000 })

  // 6. Zlecenie od ucznia z "avoid" NIE powinno być widoczne
  //    Jedyne oczekujące zlecenie to od unikniętego ucznia → lista jest pusta
  await expect(
    page.getByText('Brak zleceń w Twoich przedmiotach. Czekamy na uczniów...')
  ).toBeVisible({ timeout: 5_000 })
})
