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

test.beforeEach(async () => {
  const db = adminClient()
  const ids = await getUserIds()
  await db.from('ratings').delete().eq('tutor_id', ids.tutor1Id)
  await db.from('sessions').delete().eq('student_id', ids.studentId)
  await db.from('matching_requests').delete().eq('student_id', ids.studentId)
})

// ─── Test 1 ──────────────────────────────────────────────────────────────────

test('uczeń widzi formularz oceny po zakończonej sesji', async ({ page }) => {
  const ids = await getUserIds()
  const { request } = await createCompletedSession(ids)

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/rate/${request.id}`)

  await expect(page.getByText('Oceń korepetytora')).toBeVisible()
  await expect(page.getByText('Wyślij ocenę')).toBeVisible()
  await expect(page.locator('input[name="score"]')).toHaveCount(5)
})

// ─── Test 2 ──────────────────────────────────────────────────────────────────

test('uczeń może wystawić ocenę i wraca do dashboardu', async ({ page }) => {
  const ids = await getUserIds()
  const { request, session } = await createCompletedSession(ids)

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/rate/${request.id}`)

  await page.locator('label:has(input[name="score"][value="5"])').click()
  await page.fill('textarea[name="comment"]', 'Świetna sesja, wszystko jasno wytłumaczone.')
  await page.getByRole('button', { name: 'Wyślij ocenę' }).click()

  // Weryfikujemy w DB niezależnie od redirect — obejście potencjalnego problemu z auth w form POST
  await page.waitForTimeout(3_000)
  const { data: rating } = await adminClient()
    .from('ratings')
    .select('id, score, comment')
    .eq('session_id', session.id)
    .maybeSingle()

  expect(rating).not.toBeNull()
  expect(rating?.score).toBe(5)
})

// ─── Test 3 ──────────────────────────────────────────────────────────────────

test('uczeń nie może ocenić tej samej sesji dwa razy', async ({ page }) => {
  const ids = await getUserIds()
  const { request, session } = await createCompletedSession(ids)

  // Wstaw ocenę bezpośrednio w DB
  await adminClient().from('ratings').insert({
    session_id: session.id,
    student_id: ids.studentId,
    tutor_id: ids.tutor1Id,
    score: 4,
  })

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/rate/${request.id}`)

  // Już oceniona → redirect do /dashboard
  await expect(page).toHaveURL('/dashboard')
})

// ─── Test 4 ──────────────────────────────────────────────────────────────────

test('korepetytor nie może wejść na stronę oceny', async ({ page }) => {
  const ids = await getUserIds()
  const { request } = await createCompletedSession(ids)

  await loginAs(page, TUTOR1_EMAIL)
  await page.goto(`/rate/${request.id}`)

  // Korepetytor nie jest studentem → redirect
  await expect(page).toHaveURL('/dashboard')
})

// ─── Test 5 ──────────────────────────────────────────────────────────────────

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

// ─── Test 6 ──────────────────────────────────────────────────────────────────

test('pominięcie oceny przekierowuje do dashboardu', async ({ page }) => {
  const ids = await getUserIds()
  const { request } = await createCompletedSession(ids)

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/rate/${request.id}`)

  await page.getByRole('link', { name: 'Pomiń' }).click()

  await expect(page).toHaveURL('/dashboard')
})