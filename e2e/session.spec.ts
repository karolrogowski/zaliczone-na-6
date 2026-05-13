import { test, expect } from '@playwright/test'
import {
  STUDENT_EMAIL,
  TUTOR1_EMAIL,
  TEST_PASSWORD,
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

test.beforeEach(async () => {
  const db = adminClient()
  const ids = await getUserIds()
  await db.from('sessions').delete().eq('student_id', ids.studentId)
  await db.from('matching_requests').delete().eq('student_id', ids.studentId)
  await db.from('tutor_profiles').update({ is_available: false }).eq('id', ids.tutor1Id)
})

// ─── Test 1 ──────────────────────────────────────────────────────────────────
// Uczeń widzi przycisk "Dołącz do sesji" po akceptacji przez korepetytora

test('uczeń widzi przycisk "Dołącz do sesji" po akceptacji zlecenia', async ({ browser }) => {
  const ids = await getUserIds()
  await adminClient().from('tutor_profiles').update({ is_available: true }).eq('id', ids.tutor1Id)

  const studentCtx = await browser.newContext()
  const tutorCtx = await browser.newContext()
  const studentPage = await studentCtx.newPage()
  const tutorPage = await tutorCtx.newPage()

  // Uczeń składa zlecenie
  await loginAs(studentPage, STUDENT_EMAIL)
  await studentPage.selectOption('select[name="subject_id"]', 'matematyka')
  await studentPage.click('button[type="submit"]')
  await expect(studentPage.getByText('Szukamy korepetytora')).toBeVisible()

  // Korepetytor akceptuje
  await loginAs(tutorPage, TUTOR1_EMAIL)
  await expect(tutorPage.getByText('Akceptuj zlecenie')).toBeVisible({ timeout: 10_000 })
  await tutorPage.getByText('Akceptuj zlecenie').click()
  await expect(tutorPage.getByText('Zaakceptowałeś zlecenie')).toBeVisible({ timeout: 10_000 })

  // Uczeń powinien zobaczyć przycisk dołączenia do sesji
  await expect(studentPage.getByText('Znaleziono korepetytora')).toBeVisible({ timeout: 10_000 })
  await expect(studentPage.getByTestId('join-session-link')).toBeVisible({ timeout: 10_000 })

  await studentCtx.close()
  await tutorCtx.close()
})

// ─── Test 2 ──────────────────────────────────────────────────────────────────
// Strona sesji ładuje się z iframe Daily.co

test('strona sesji ładuje się z iframe Daily.co', async ({ page }) => {
  const ids = await getUserIds()
  const db = adminClient()

  // Wstaw zlecenie i sesję bezpośrednio do bazy
  const { data: request } = await db
    .from('matching_requests')
    .insert({
      student_id: ids.studentId,
      subject_id: 'matematyka',
      status: 'accepted',
      tutor_id: ids.tutor1Id,
    })
    .select()
    .single()

  const { data: session } = await db
    .from('sessions')
    .insert({
      matching_request_id: request.id,
      student_id: ids.studentId,
      tutor_id: ids.tutor1Id,
      daily_room_name: 'test-room-abc',
      daily_room_url: 'https://test.daily.co/test-room-abc',
      status: 'in_progress',
      started_at: new Date().toISOString(),
      duration_minutes: 60,
    })
    .select()
    .single()

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/session/${session.id}`)

  await expect(page.locator('iframe[src*="daily.co"]')).toBeVisible({ timeout: 10_000 })
})

// ─── Test 3 ──────────────────────────────────────────────────────────────────
// Timer jest widoczny na stronie sesji

test('timer jest widoczny na stronie sesji', async ({ page }) => {
  const ids = await getUserIds()
  const db = adminClient()

  const { data: request } = await db
    .from('matching_requests')
    .insert({
      student_id: ids.studentId,
      subject_id: 'matematyka',
      status: 'accepted',
      tutor_id: ids.tutor1Id,
    })
    .select()
    .single()

  const { data: session } = await db
    .from('sessions')
    .insert({
      matching_request_id: request.id,
      student_id: ids.studentId,
      tutor_id: ids.tutor1Id,
      daily_room_name: 'test-room-timer',
      daily_room_url: 'https://test.daily.co/test-room-timer',
      status: 'in_progress',
      started_at: new Date().toISOString(),
      duration_minutes: 60,
    })
    .select()
    .single()

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/session/${session.id}`)

  await expect(page.getByTestId('timer')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('timer')).toContainText('Pozostało:')
})

// ─── Test 4 ──────────────────────────────────────────────────────────────────
// Korepetytor kończy sesję i zostaje przekierowany na stronę ratingu

test('korepetytor kończy sesję i jest przekierowany na ocenę', async ({ page }) => {
  const ids = await getUserIds()
  const db = adminClient()

  const { data: request } = await db
    .from('matching_requests')
    .insert({
      student_id: ids.studentId,
      subject_id: 'matematyka',
      status: 'accepted',
      tutor_id: ids.tutor1Id,
    })
    .select()
    .single()

  // Sesja z duration_minutes=60 i started_at=teraz — timer daleko od 0
  const { data: session } = await db
    .from('sessions')
    .insert({
      matching_request_id: request.id,
      student_id: ids.studentId,
      tutor_id: ids.tutor1Id,
      daily_room_name: 'test-room-end',
      daily_room_url: 'https://test.daily.co/test-room-end',
      status: 'in_progress',
      started_at: new Date().toISOString(),
      duration_minutes: 60,
    })
    .select()
    .single()

  // Zaloguj jako korepetytor
  await loginAs(page, TUTOR1_EMAIL)
  await page.goto(`/session/${session.id}`)

  await expect(page.getByText('Zakończ sesję')).toBeVisible({ timeout: 10_000 })

  // Korepetytor musi podać powód gdy kończy przed czasem
  await page.fill('textarea', 'Test zakończenia sesji')
  await page.getByText('Zakończ sesję').click()

  // Oczekuj przekierowania na /rate/
  await page.waitForURL(/\/rate\//, { timeout: 15_000 })
  expect(page.url()).toContain('/rate/')
})