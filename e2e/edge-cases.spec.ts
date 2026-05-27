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

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    daily_room_name: 'edge-room',
    daily_room_url: mockRoomUrl('edge-room'),
    host_room_url: mockHostUrl('edge-room'),
    status: 'in_progress',
    started_at: new Date().toISOString(),
    duration_minutes: 60,
    ...overrides,
  }
}

test.beforeEach(async () => {
  const db = adminClient()
  const ids = await getUserIds()

  const { data: sessions } = await db
    .from('sessions')
    .select('id')
    .eq('student_id', ids.studentId)

  if (sessions?.length) {
    const sessionIds = sessions.map((s: { id: string }) => s.id)
    await db.from('ratings').delete().in('session_id', sessionIds)
    await db.from('session_financials').delete().in('session_id', sessionIds)
  }

  await db.from('sessions').delete().eq('student_id', ids.studentId)
  await db.from('matching_requests').delete().eq('student_id', ids.studentId)
  await db.from('tutor_profiles').update({ is_available: false }).eq('id', ids.tutor1Id)
})

// ════════════════════════════════════════════════════════════════════════════
// Test 1 — Race condition: concurrent session completion
// ════════════════════════════════════════════════════════════════════════════

test('korepetytor kończy sesję zanim timer ucznia dobiegnie 0 — oboje trafiają na /rate', async ({ browser }) => {
  test.setTimeout(60_000)

  const ids = await getUserIds()
  const db = adminClient()

  const { data: request } = await db
    .from('matching_requests')
    .insert({ student_id: ids.studentId, subject_id: 'matematyka', status: 'accepted', tutor_id: ids.tutor1Id })
    .select()
    .single()

  // 30 sekund marginesu: dwa logowania (~6s) + otwieranie stron (~2s) + interakcja tutora (~5s)
  // Student nie zdąży dojść do timera 0 — zostanie przekierowany przez realtime/polling
  const startedAt = new Date(Date.now() - (60 * 60 - 30) * 1000).toISOString()

  const { data: session } = await db
    .from('sessions')
    .insert(makeSession({
      matching_request_id: request.id,
      student_id: ids.studentId,
      tutor_id: ids.tutor1Id,
      started_at: startedAt,
    }))
    .select()
    .single()

  const studentCtx = await browser.newContext()
  const tutorCtx = await browser.newContext()
  const studentPage = await studentCtx.newPage()
  const tutorPage = await tutorCtx.newPage()

  await loginAs(studentPage, STUDENT_EMAIL)
  await loginAs(tutorPage, TUTOR1_EMAIL)

  // Oboje otwierają stronę sesji równocześnie
  await Promise.all([
    studentPage.goto(`/session/${session.id}`),
    tutorPage.goto(`/session/${session.id}`),
  ])

  // Korepetytor kończy ręcznie przed upływem timera ucznia
  await expect(tutorPage.getByRole('button', { name: 'Zakończ sesję' })).toBeVisible({ timeout: 5_000 })
  await tutorPage.getByRole('button', { name: 'Zakończ sesję' }).click()
  await tutorPage.getByRole('button', { name: 'Tak, zakończ' }).click()
  await tutorPage.waitForURL(/\/rate\//, { timeout: 10_000 })

  // Uczeń: realtime listener lub własny timer przekierowuje na /rate
  await studentPage.waitForURL(/\/rate\//, { timeout: 15_000 })

  // Sesja w bazie powinna być zakończona dokładnie raz
  const { data: finalSession } = await db
    .from('sessions')
    .select('status, ended_at')
    .eq('id', session.id)
    .single()

  expect(finalSession.status).toBe('completed')
  expect(finalSession.ended_at).not.toBeNull()

  await studentCtx.close()
  await tutorCtx.close()

  // Cleanup: przesuń sesję poza okno 4h blokady /rate, żeby nie blokować kolejnych testów
  await db.from('sessions')
    .update({ ended_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() })
    .eq('id', session.id)
})

// ════════════════════════════════════════════════════════════════════════════
// Test 2 — Orphaned accepted request (no session row yet)
// ════════════════════════════════════════════════════════════════════════════

test('uczeń z zaakceptowanym zleceniem bez sesji widzi komunikat o oczekiwaniu na pokój', async ({ page }) => {
  const ids = await getUserIds()

  // Zaakceptowane zlecenie — korepetytor przypisany, ale sesja jeszcze nie istnieje w DB
  await adminClient()
    .from('matching_requests')
    .insert({
      student_id: ids.studentId,
      subject_id: 'matematyka',
      status: 'accepted',
      tutor_id: ids.tutor1Id,
    })

  await loginAs(page, STUDENT_EMAIL)

  await expect(page.getByText('Znaleziono korepetytora!')).toBeVisible({ timeout: 10_000 })
  // Przycisk "Dołącz do sesji" nie powinien być widoczny — brak pokoju wideo
  await expect(page.getByTestId('join-session-link')).not.toBeVisible()
  await expect(page.getByText('Sesja wkrótce się rozpocznie...')).toBeVisible()
})

// ════════════════════════════════════════════════════════════════════════════
// Test 3 — Rate page with non-existent request ID
// ════════════════════════════════════════════════════════════════════════════

test('wejście na /rate z nieistniejącym requestId przekierowuje do dashboardu', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/rate/00000000-0000-0000-0000-000000000000')
  await expect(page).toHaveURL('/dashboard')
})

// ════════════════════════════════════════════════════════════════════════════
// Test 4 — XSS in session notes
// ════════════════════════════════════════════════════════════════════════════

test('notatki z sesji zawierające kod HTML są wyświetlane jako tekst i nie są wykonywane', async ({ page }) => {
  const ids = await getUserIds()
  const db = adminClient()

  const xssPayload = '<script>window.__xss_executed = true</script><b>bold</b>'

  const { data: request } = await db
    .from('matching_requests')
    .insert({ student_id: ids.studentId, tutor_id: ids.tutor1Id, subject_id: 'matematyka', status: 'completed' })
    .select()
    .single()

  await db.from('sessions').insert({
    matching_request_id: request.id,
    student_id: ids.studentId,
    tutor_id: ids.tutor1Id,
    daily_room_name: 'xss-room',
    daily_room_url: mockRoomUrl('xss-room'),
    host_room_url: mockHostUrl('xss-room'),
    status: 'completed',
    started_at: new Date(Date.now() - 5 * 60 * 60 * 1000 - 30 * 60 * 1000).toISOString(),
    ended_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // >4h temu → poza oknem blokady /rate
    duration_minutes: 30,
    notes: xssPayload,
  })

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/history/${request.id}`)

  // Skrypt nie powinien się wykonać — React escape'uje HTML domyślnie
  const xssExecuted = await page.evaluate(
    () => (window as unknown as Record<string, unknown>)['__xss_executed']
  )
  expect(xssExecuted).toBeFalsy()

  // Literalny string "<b>bold</b>" powinien być widoczny jako tekst, nie jako element HTML
  await expect(page.getByText('<b>bold</b>', { exact: false })).toBeVisible()
})

// ════════════════════════════════════════════════════════════════════════════
// Test 5 — Real-time expiry: request expires while student watches
// ════════════════════════════════════════════════════════════════════════════

test('zlecenie wygasające w czasie rzeczywistym zmienia UI na "Zlecenie wygasło"', async ({ page }) => {
  const ids = await getUserIds()

  // Zlecenie wygasające za 8 sekund — daje czas na zalogowanie i zobaczenie odliczania
  await adminClient()
    .from('matching_requests')
    .insert({
      student_id: ids.studentId,
      subject_id: 'matematyka',
      status: 'pending',
      expires_at: new Date(Date.now() + 8_000).toISOString(),
    })

  await loginAs(page, STUDENT_EMAIL)

  // Odliczanie jest widoczne przed wygaśnięciem
  await expect(page.getByTestId('countdown')).toBeVisible({ timeout: 5_000 })

  // Po wygaśnięciu UI przełącza się na komunikat — klient wykrywa to lokalnie
  await expect(page.getByText('Zlecenie wygasło')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Złóż nowe zlecenie' })).toBeVisible()
})

// ════════════════════════════════════════════════════════════════════════════
// Test 6 — Invalid/expired password reset token
// ════════════════════════════════════════════════════════════════════════════

test('kliknięcie nieważnego linku resetu hasła przekierowuje na /login', async ({ page }) => {
  // Supabase verifyOtp zwróci błąd dla fikcyjnego tokenu
  // → route /auth/confirm przekierowuje na /login?error=invalid_link
  await page.goto('/auth/confirm?token_hash=invalid-token-xyz-000&type=recovery')
  await page.waitForURL(/\/login/, { timeout: 10_000 })
  expect(page.url()).toContain('/login')
})

// ════════════════════════════════════════════════════════════════════════════
// Test 7 — Tutor visits student-only /request page
// ════════════════════════════════════════════════════════════════════════════

test('korepetytor wchodzący na /request jest przekierowany do dashboardu', async ({ page }) => {
  await loginAs(page, TUTOR1_EMAIL)
  await page.goto('/request')
  await expect(page).toHaveURL('/dashboard')
})