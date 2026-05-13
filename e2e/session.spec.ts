import { test, expect } from '@playwright/test'
import {
  STUDENT_EMAIL,
  TUTOR1_EMAIL,
  adminClient,
} from './global-setup'
import { loginAs, getTestUserIds } from './helpers'
import { mockRoomUrl, mockHostUrl, videoIframeSelector } from './video-fixtures'

async function getUserIds() {
  const { byEmail } = await getTestUserIds()
  return {
    studentId: byEmail(STUDENT_EMAIL)!,
    tutor1Id: byEmail(TUTOR1_EMAIL)!,
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
  const startedAt = new Date(Date.now() - (60 * 60 - 4) * 1000).toISOString()

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
  await page.fill('textarea', 'Test zakończenia sesji')
  await page.getByRole('button', { name: 'Zakończ sesję' }).click()

  await page.waitForURL(/\/rate\//, { timeout: 15_000 })
  expect(page.url()).toContain('/rate/')
})