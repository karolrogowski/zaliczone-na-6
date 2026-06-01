import { test, expect } from '@playwright/test'
import {
  STUDENT_EMAIL,
  TUTOR1_EMAIL,
  TUTOR2_EMAIL,
  adminClient,
} from './global-setup'
import { loginAs, getTestUserIds, student3DRating } from './helpers'
import { mockRoomUrl, mockHostUrl } from './video-fixtures'

async function getUserIds() {
  const { byEmail } = await getTestUserIds()
  return {
    studentId: byEmail(STUDENT_EMAIL)!,
    tutor1Id: byEmail(TUTOR1_EMAIL)!,
    tutor2Id: byEmail(TUTOR2_EMAIL)!,
  }
}

async function createCompletedSession(
  ids: { studentId: string; tutor1Id: string },
  notes?: string
) {
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
      daily_room_name: 'test-room-history',
      daily_room_url: mockRoomUrl('test-room-history'),
      host_room_url: mockHostUrl('test-room-history'),
      status: 'completed',
      started_at: new Date(Date.now() - 5 * 60 * 60 * 1000 - 30 * 60 * 1000).toISOString(),
      ended_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // >4h temu → poza oknem blokady /rate
      duration_minutes: 30,
      ...(notes ? { notes } : {}),
    })
    .select()
    .single()

  return { request, session }
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
})

// ─── Historia ucznia ──────────────────────────────────────────────────────────

test('uczeń widzi listę zakończonych sesji w historii', async ({ page }) => {
  const ids = await getUserIds()
  await createCompletedSession(ids)

  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/history')
  await page.waitForURL('/history')

  await expect(page.getByRole('heading', { name: 'Historia sesji' })).toBeVisible()
  await expect(page.getByText('Matematyka')).toBeVisible()
})

test('uczeń z pustą historią widzi odpowiedni komunikat', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/history')
  await page.waitForURL('/history')

  await expect(page.getByText('Nie masz jeszcze żadnych zakończonych sesji.')).toBeVisible()
})

test('uczeń widzi szczegóły sesji z nazwą korepetytora', async ({ page }) => {
  const ids = await getUserIds()
  const { request } = await createCompletedSession(ids)

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/history/${request.id}`)

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Matematyka')
  await expect(page.getByText('Testowy Korepetytor 1')).toBeVisible()
})

test('historia sesji z notatkami: notatki są widoczne w szczegółach', async ({ page }) => {
  const ids = await getUserIds()
  const testNotes = 'Przerobiliśmy całkowanie przez podstawienie.'
  const { request } = await createCompletedSession(ids, testNotes)

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/history/${request.id}`)

  await expect(page.getByRole('heading', { name: 'Notatki z sesji' })).toBeVisible()
  await expect(page.getByText(testNotes)).toBeVisible()
})

test('historia sesji bez notatek: widoczny komunikat zastępczy', async ({ page }) => {
  const ids = await getUserIds()
  const { request } = await createCompletedSession(ids)

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/history/${request.id}`)

  await expect(page.getByText('Brak notatek z sesji.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Notatki z sesji' })).not.toBeVisible()
})

test('dashboard ucznia zawiera link do historii po pierwszej zakończonej sesji', async ({ page }) => {
  const ids = await getUserIds()
  await createCompletedSession(ids)

  await loginAs(page, STUDENT_EMAIL)

  await expect(page.getByRole('link', { name: /Cała historia/ })).toBeVisible()
})

// ─── Historia korepetytora ────────────────────────────────────────────────────

test('korepetytor widzi historię sesji z nazwą ucznia', async ({ page }) => {
  const ids = await getUserIds()
  await createCompletedSession(ids)

  await loginAs(page, TUTOR1_EMAIL)
  await page.goto('/history')
  await page.waitForURL('/history')

  await expect(page.getByRole('heading', { name: 'Historia sesji' })).toBeVisible()
  await expect(page.getByText('Matematyka')).toBeVisible()
})

test('korepetytor widzi szczegóły sesji z nazwą ucznia', async ({ page }) => {
  const ids = await getUserIds()
  const { request } = await createCompletedSession(ids)

  await loginAs(page, TUTOR1_EMAIL)
  await page.goto(`/history/${request.id}`)

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Matematyka')
  await expect(page.getByText('Testowy Uczeń')).toBeVisible()
})

// ─── Kontrola dostępu ─────────────────────────────────────────────────────────

test('niezalogowany użytkownik nie może wejść na historię', async ({ page }) => {
  await page.goto('/history')
  await page.waitForURL('/login')
  await expect(page.locator('input[name="email"]')).toBeVisible()
})

test('uczeń nie może zobaczyć szczegółów cudzej sesji (tutor2)', async ({ page }) => {
  // Tworzymy sesję dla tutor2 — uczeń testowy nie jest jej uczestnikiem
  const { byEmail } = await getTestUserIds()
  const tutor2Id = byEmail(TUTOR2_EMAIL)!

  // Wstawiamy sesję dla INNEGO ucznia (używamy tutor2Id jako "inny uczeń" — uprość test)
  // Zalogowany student (STUDENT_EMAIL) nie jest uczestnikiem tej sesji
  const db = adminClient()
  const { data: request } = await db
    .from('matching_requests')
    .insert({
      student_id: tutor2Id,   // tutor2 jako "inny student" (ma profil 'tutor', nie 'student', ale FK działa)
      tutor_id: tutor2Id,
      subject_id: 'matematyka',
      status: 'completed',
    })
    .select()
    .single()

  // Posprzątaj po teście
  test.info().annotations.push({ type: 'cleanup-request-id', description: request.id })

  await db.from('sessions').insert({
    matching_request_id: request.id,
    student_id: tutor2Id,
    tutor_id: tutor2Id,
    daily_room_name: 'foreign-room',
    daily_room_url: mockRoomUrl('foreign-room'),
    host_room_url: mockHostUrl('foreign-room'),
    status: 'completed',
    started_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    ended_at: new Date().toISOString(),
    duration_minutes: 30,
  })

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/history/${request.id}`)

  // Brak uprawnień → przekierowanie do /history
  await page.waitForURL('/history')

  // Posprzątaj
  await db.from('sessions').delete().eq('student_id', tutor2Id)
  await db.from('matching_requests').delete().eq('id', request.id)
})

// ─── Oceny w historii ─────────────────────────────────────────────────────────

test('uczeń widzi własną ocenę korepetytora w szczegółach sesji', async ({ page }) => {
  const ids = await getUserIds()
  const { request, session } = await createCompletedSession(ids)

  // Wstaw ocenę ucznia (3 wymiary)
  await adminClient().from('ratings').insert({
    session_id: session.id,
    student_id: ids.studentId,
    tutor_id: ids.tutor1Id,
    ...student3DRating(4),
  })

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/history/${request.id}`)

  await expect(page.getByText('Oceny')).toBeVisible()
  await expect(page.getByText(/Twoja ocena korepetytora/)).toBeVisible()
  // Średnia 3×4 = 4.0, wyświetlana jako ⌀ 4.0/5
  await expect(page.getByText('⌀ 4.0/5')).toBeVisible()
})

test('uczeń nie widzi oceny wystawionej mu przez korepetytora (RLS)', async ({ page }) => {
  const ids = await getUserIds()
  const { request, session } = await createCompletedSession(ids)

  await adminClient().from('ratings').insert([
    {
      session_id: session.id,
      student_id: ids.studentId,
      tutor_id: ids.tutor1Id,
      ...student3DRating(4),
    },
    {
      session_id: session.id,
      student_id: ids.studentId,
      tutor_id: ids.tutor1Id,
      rated_by: 'tutor',
      tutor_preference: 'flag',
    },
  ])

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/history/${request.id}`)

  // Uczeń widzi swoją ocenę korepetytora
  await expect(page.getByText(/Twoja ocena korepetytora/)).toBeVisible()
  // Uczeń NIE widzi sekcji oceny wystawionej mu przez korepetytora
  await expect(page.getByText(/Twoja ocena ucznia/)).not.toBeVisible()
})

test('korepetytor widzi obie oceny w historii sesji', async ({ page }) => {
  const ids = await getUserIds()
  const { request, session } = await createCompletedSession(ids)

  // Uczeń ocenił na 5★, korepetytor oznaczył ucznia jako problematycznego
  await adminClient().from('ratings').insert([
    {
      session_id: session.id,
      student_id: ids.studentId,
      tutor_id: ids.tutor1Id,
      ...student3DRating(5),
    },
    {
      session_id: session.id,
      student_id: ids.studentId,
      tutor_id: ids.tutor1Id,
      rated_by: 'tutor',
      tutor_preference: 'flag',
    },
  ])

  // Sesja jest stara (>4h) → korepetytor nie jest blokowany przez /rate
  await loginAs(page, TUTOR1_EMAIL)
  await page.goto(`/history/${request.id}`)

  await expect(page.getByText('Oceny')).toBeVisible()
  // Ocena ucznia o korepetytorze (śr. 5×3/3 = 5.0)
  await expect(page.getByText(/Ocena wystawiona przez ucznia/)).toBeVisible()
  await expect(page.getByText('⌀ 5.0/5')).toBeVisible()
  // Własna ocena korepetytora o uczniu — bez gwiazdek, z flagą
  await expect(page.getByText(/Twoja ocena ucznia/)).toBeVisible()
  await expect(page.getByText(/Uczeń oznaczony jako problematyczny/)).toBeVisible()
})

test('sesja bez ocen pokazuje komunikat "Brak ocen dla tej sesji."', async ({ page }) => {
  const ids = await getUserIds()
  const { request } = await createCompletedSession(ids)

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/history/${request.id}`)

  await expect(page.getByText('Brak ocen dla tej sesji.')).toBeVisible()
})