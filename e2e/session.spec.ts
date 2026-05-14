import { test, expect } from '@playwright/test'
import {
  STUDENT_EMAIL,
  TUTOR1_EMAIL,
  TUTOR2_EMAIL,
  adminClient,
} from './global-setup'
import { loginAs, getTestUserIds } from './helpers'
import { mockRoomUrl, mockHostUrl, videoIframeSelector } from './video-fixtures'

async function getUserIds() {
  const { byEmail } = await getTestUserIds()
  return {
    studentId: byEmail(STUDENT_EMAIL)!,
    tutor1Id: byEmail(TUTOR1_EMAIL)!,
    tutor2Id: byEmail(TUTOR2_EMAIL)!,
  }
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    daily_room_name: 'test-room',
    daily_room_url: mockRoomUrl('test-room'),
    host_room_url: mockHostUrl('test-room'),
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

// ─── Test 1 ──────────────────────────────────────────────────────────────────

test('uczeń widzi przycisk "Dołącz do sesji" gdy sesja jest gotowa', async ({ page }) => {
  const ids = await getUserIds()
  const db = adminClient()

  const { data: request } = await db
    .from('matching_requests')
    .insert({ student_id: ids.studentId, subject_id: 'matematyka', status: 'accepted', tutor_id: ids.tutor1Id })
    .select().single()

  await db.from('sessions').insert(
    makeSession({ matching_request_id: request.id, student_id: ids.studentId, tutor_id: ids.tutor1Id })
  )

  await loginAs(page, STUDENT_EMAIL)
  await expect(page.getByText('Znaleziono korepetytora')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('join-session-link')).toBeVisible({ timeout: 10_000 })
})

// ─── Test 2 ──────────────────────────────────────────────────────────────────

test('strona sesji ładuje się z iframe wideo', async ({ page }) => {
  const ids = await getUserIds()
  const db = adminClient()

  const { data: request } = await db
    .from('matching_requests')
    .insert({ student_id: ids.studentId, subject_id: 'matematyka', status: 'accepted', tutor_id: ids.tutor1Id })
    .select().single()

  const { data: session } = await db
    .from('sessions')
    .insert(makeSession({ matching_request_id: request.id, student_id: ids.studentId, tutor_id: ids.tutor1Id }))
    .select().single()

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/session/${session.id}`)

  await expect(page.locator(videoIframeSelector)).toBeVisible({ timeout: 10_000 })
})

// ─── Test 3 ──────────────────────────────────────────────────────────────────

test('timer jest widoczny na stronie sesji', async ({ page }) => {
  const ids = await getUserIds()
  const db = adminClient()

  const { data: request } = await db
    .from('matching_requests')
    .insert({ student_id: ids.studentId, subject_id: 'matematyka', status: 'accepted', tutor_id: ids.tutor1Id })
    .select().single()

  const { data: session } = await db
    .from('sessions')
    .insert(makeSession({ matching_request_id: request.id, student_id: ids.studentId, tutor_id: ids.tutor1Id }))
    .select().single()

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/session/${session.id}`)

  await expect(page.getByTestId('timer')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('timer')).toContainText('Pozostało:')
})

// ─── Test 4 ──────────────────────────────────────────────────────────────────

test('sesja kończy się automatycznie po upływie czasu', async ({ page }) => {
  const ids = await getUserIds()
  const db = adminClient()

  const { data: request } = await db
    .from('matching_requests')
    .insert({ student_id: ids.studentId, subject_id: 'matematyka', status: 'accepted', tutor_id: ids.tutor1Id })
    .select().single()

  // Sesja z 4 sekundami do końca — timer naturalnie doliczy do 0
  const startedAt = new Date(Date.now() - (60 * 60 - 10) * 1000).toISOString()

  const { data: session } = await db
    .from('sessions')
    .insert(makeSession({
      matching_request_id: request.id,
      student_id: ids.studentId,
      tutor_id: ids.tutor1Id,
      started_at: startedAt,
    }))
    .select().single()

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/session/${session.id}`)

  await expect(page.getByTestId('timer-banner-critical')).toBeVisible({ timeout: 5_000 })
  await page.waitForURL(/\/rate\//, { timeout: 15_000 })
  expect(page.url()).toContain('/rate/')
})

test('korepetytor kończy sesję i jest przekierowany na ocenę', async ({ page }) => {
  const ids = await getUserIds()
  const db = adminClient()

  const { data: request } = await db
    .from('matching_requests')
    .insert({ student_id: ids.studentId, subject_id: 'matematyka', status: 'accepted', tutor_id: ids.tutor1Id })
    .select().single()

  const { data: session } = await db
    .from('sessions')
    .insert(makeSession({ matching_request_id: request.id, student_id: ids.studentId, tutor_id: ids.tutor1Id }))
    .select().single()

  await loginAs(page, TUTOR1_EMAIL)
  await page.goto(`/session/${session.id}`)

  await expect(page.getByRole('button', { name: 'Zakończ sesję' })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Zakończ sesję' }).click()
  await page.getByRole('button', { name: 'Tak, zakończ' }).click()

  await page.waitForURL(/\/rate\//, { timeout: 15_000 })
  expect(page.url()).toContain('/rate/')
})

// ─── Test 6 ──────────────────────────────────────────────────────────────────

test('obcy użytkownik nie może wejść do cudzej sesji', async ({ page }) => {
  const ids = await getUserIds()
  const db = adminClient()

  const { data: request } = await db
    .from('matching_requests')
    .insert({ student_id: ids.studentId, subject_id: 'matematyka', status: 'accepted', tutor_id: ids.tutor1Id })
    .select().single()

  const { data: session } = await db
    .from('sessions')
    .insert(makeSession({ matching_request_id: request.id, student_id: ids.studentId, tutor_id: ids.tutor1Id }))
    .select().single()

  // tutor2 nie jest uczestnikiem tej sesji
  await loginAs(page, TUTOR2_EMAIL)
  await page.goto(`/session/${session.id}`)

  await expect(page).toHaveURL('/dashboard')
})

// ─── Test 7 ──────────────────────────────────────────────────────────────────

test('wejście na stronę zakończonej sesji przekierowuje do oceny', async ({ page }) => {
  const ids = await getUserIds()
  const db = adminClient()

  const { data: request } = await db
    .from('matching_requests')
    .insert({ student_id: ids.studentId, subject_id: 'matematyka', status: 'completed', tutor_id: ids.tutor1Id })
    .select().single()

  const { data: session } = await db
    .from('sessions')
    .insert({
      ...makeSession({ matching_request_id: request.id, student_id: ids.studentId, tutor_id: ids.tutor1Id }),
      status: 'completed',
      ended_at: new Date().toISOString(),
    })
    .select().single()

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/session/${session.id}`)

  await expect(page).toHaveURL(`/rate/${request.id}`)
})

// ─── Test 8 ──────────────────────────────────────────────────────────────────

test('wejście na sesję bez pokoju wideo przekierowuje do dashboardu', async ({ page }) => {
  const ids = await getUserIds()
  const db = adminClient()

  const { data: request } = await db
    .from('matching_requests')
    .insert({ student_id: ids.studentId, subject_id: 'matematyka', status: 'accepted', tutor_id: ids.tutor1Id })
    .select().single()

  const { data: session } = await db
    .from('sessions')
    .insert({
      matching_request_id: request.id,
      student_id: ids.studentId,
      tutor_id: ids.tutor1Id,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      duration_minutes: 60,
    })
    .select().single()

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/session/${session.id}`)

  await expect(page).toHaveURL('/dashboard')
})