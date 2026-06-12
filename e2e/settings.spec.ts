import { test, expect } from '@playwright/test'
import {
  STUDENT_EMAIL,
  TUTOR1_EMAIL,
  adminClient,
} from './global-setup'
import { loginAs, getTestUserIds, student3DRating } from './helpers'
import { mockRoomUrl, mockHostUrl } from './video-fixtures'

async function getUserIds() {
  const { byEmail } = await getTestUserIds()
  return {
    studentId: byEmail(STUDENT_EMAIL)!,
    tutor1Id: byEmail(TUTOR1_EMAIL)!,
  }
}

/**
 * Tworzy starą sesję (>4h) i wstawia oceny — obie strony poza oknem blokady /rate.
 * Opcjonalnie ustawia preferencję ucznia (np. 'avoid').
 */
async function createOldSessionWithRatings(
  ids: { studentId: string; tutor1Id: string },
  opts?: { studentPreference?: 'avoid' | 'want_again' }
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
      daily_room_name: 'test-room-settings',
      daily_room_url: mockRoomUrl('test-room-settings'),
      host_room_url: mockHostUrl('test-room-settings'),
      status: 'completed',
      started_at: new Date(Date.now() - 5 * 60 * 60 * 1000 - 30 * 60 * 1000).toISOString(),
      ended_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      duration_minutes: 30,
    })
    .select()
    .single()

  // Ocena ucznia (3 wymiary)
  await db.from('ratings').insert({
    session_id: session.id,
    student_id: ids.studentId,
    tutor_id: ids.tutor1Id,
    ...student3DRating(4, opts?.studentPreference ? { preference: opts.studentPreference } : {}),
  })

  // Ocena korepetytora — żeby nie był blokowany przez 4h okno (score = null)
  await db.from('ratings').insert({
    session_id: session.id,
    student_id: ids.studentId,
    tutor_id: ids.tutor1Id,
    rated_by: 'tutor',
  })

  return { request, session }
}

async function cleanupSettingsTests() {
  const db = adminClient()
  const ids = await getUserIds()

  const { data: sessions } = await db
    .from('sessions')
    .select('id')
    .eq('student_id', ids.studentId)

  if (sessions?.length) {
    const sessionIds = sessions.map((s: { id: string }) => s.id)
    await db.from('ratings').delete().in('session_id', sessionIds)
  }

  await db.from('sessions').delete().eq('student_id', ids.studentId)
  await db.from('matching_requests').delete().eq('student_id', ids.studentId)

  // Zresetuj dostępność korepetytora
  await db.from('tutor_profiles').update({ is_available: false }).eq('id', ids.tutor1Id)
}

test.beforeEach(cleanupSettingsTests)
test.afterAll(cleanupSettingsTests)

// ─── Widoczność sekcji ────────────────────────────────────────────────────────

test('uczeń widzi sekcję "Ulubieni korepetytorzy" w ustawieniach', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/settings')

  await expect(page.getByRole('heading', { name: 'Ulubieni korepetytorzy' })).toBeVisible()
  await expect(
    page.getByText('Ulubieni korepetytorzy są powiadamiani o Twoich zleceniach jako pierwsi.')
  ).toBeVisible()
})

test('sekcja ulubionych pokazuje komunikat gdy lista jest pusta', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/settings')

  await expect(page.getByText('Nie masz jeszcze żadnych ulubionych korepetytorów.')).toBeVisible()
})

test('korepetytor nie widzi sekcji "Ulubieni korepetytorzy"', async ({ page }) => {
  await loginAs(page, TUTOR1_EMAIL)
  await page.goto('/settings')

  await expect(page.getByRole('heading', { name: 'Ulubieni korepetytorzy' })).not.toBeVisible()
})

test('uczeń widzi sekcję "Zablokowani korepetytorzy" w ustawieniach', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/settings')

  await expect(page.getByRole('heading', { name: 'Zablokowani korepetytorzy' })).toBeVisible()
  await expect(
    page.getByText('Korepetytorzy na tej liście nie widzą Twoich zleceń.')
  ).toBeVisible()
})

test('sekcja zablokowanych pokazuje komunikat gdy lista jest pusta', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/settings')

  await expect(page.getByText('Nie masz żadnych zablokowanych korepetytorów.')).toBeVisible()
})

test('korepetytor nie widzi sekcji "Zablokowani korepetytorzy"', async ({ page }) => {
  await loginAs(page, TUTOR1_EMAIL)
  await page.goto('/settings')

  await expect(page.getByRole('heading', { name: 'Zablokowani korepetytorzy' })).not.toBeVisible()
})

// ─── Zarządzanie listą ────────────────────────────────────────────────────────

test('korepetytor oznaczony jako "avoid" pojawia się na liście zablokowanych', async ({ page }) => {
  const ids = await getUserIds()
  await createOldSessionWithRatings(ids, { studentPreference: 'avoid' })

  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/settings')

  // Testowy Korepetytor 1 powinien być widoczny na liście
  await expect(page.getByText('Testowy Korepetytor 1')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Usuń blokadę' })).toBeVisible()
})

test('"Usuń blokadę" usuwa korepetytora z listy zablokowanych', async ({ page }) => {
  const ids = await getUserIds()
  await createOldSessionWithRatings(ids, { studentPreference: 'avoid' })

  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/settings')

  // Korepetytor widoczny na liście
  await expect(page.getByText('Testowy Korepetytor 1')).toBeVisible()

  // Klikamy "Usuń blokadę"
  await page.getByRole('button', { name: 'Usuń blokadę' }).click()

  // Po odświeżeniu korepetytor znika z listy
  await expect(page.getByText('Testowy Korepetytor 1')).not.toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('Nie masz żadnych zablokowanych korepetytorów.')).toBeVisible({ timeout: 5_000 })
})

// ─── Integracja: usunięcie blokady przywraca widoczność zleceń ───────────────

test('po usunięciu blokady korepetytor widzi zlecenia ucznia w swoim feedzie', async ({ page }) => {
  const ids = await getUserIds()
  const db = adminClient()

  // 1. Stara sesja z preferencją "avoid" i oceną korepetytora (obie strony poza oknem blokady)
  await createOldSessionWithRatings(ids, { studentPreference: 'avoid' })

  // 2. Nowe oczekujące zlecenie od ucznia
  await db.from('matching_requests').insert({
    student_id: ids.studentId,
    subject_id: 'matematyka',
    status: 'pending',
    stripe_status: 'authorized',
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  })

  // 3. Korepetytor musi być dostępny (RLS wymaga is_available=true dla pending requests)
  await db.from('tutor_profiles').update({ is_available: true }).eq('id', ids.tutor1Id)

  // 4. Zaloguj jako uczeń i usuń blokadę w ustawieniach
  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/settings')
  await expect(page.getByText('Testowy Korepetytor 1')).toBeVisible()
  await page.getByRole('button', { name: 'Usuń blokadę' }).click()
  await expect(page.getByText('Nie masz żadnych zablokowanych korepetytorów.')).toBeVisible({ timeout: 5_000 })

  // 5. Zaloguj jako korepetytor i sprawdź, że zlecenie ucznia jest teraz widoczne
  await page.context().clearCookies()
  await loginAs(page, TUTOR1_EMAIL)

  // Sekcja oczekujących zleceń widoczna (is_available=true)
  await expect(page.getByText('Oczekujące zlecenia')).toBeVisible({ timeout: 5_000 })
  // Zlecenie ucznia jest widoczne — pojawia się przycisk akceptacji
  await expect(page.getByRole('button', { name: 'Akceptuj zlecenie' })).toBeVisible({ timeout: 5_000 })
})

// ─── Ulubieni korepetytorzy ───────────────────────────────────────────────────

test('korepetytor oznaczony jako ulubiony pojawia się na liście ulubionych', async ({ page }) => {
  const ids = await getUserIds()
  await createOldSessionWithRatings(ids, { studentPreference: 'want_again' })

  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/settings')

  await expect(page.getByRole('heading', { name: 'Ulubieni korepetytorzy' })).toBeVisible()
  await expect(page.getByText('Testowy Korepetytor 1')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Usuń z ulubionych' })).toBeVisible()
})

test('"Usuń z ulubionych" usuwa korepetytora z listy', async ({ page }) => {
  const ids = await getUserIds()
  await createOldSessionWithRatings(ids, { studentPreference: 'want_again' })

  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/settings')

  await expect(page.getByText('Testowy Korepetytor 1')).toBeVisible()

  await page.getByRole('button', { name: 'Usuń z ulubionych' }).click()

  await expect(page.getByText('Testowy Korepetytor 1')).not.toBeVisible({ timeout: 5_000 })
  await expect(
    page.getByText('Nie masz jeszcze żadnych ulubionych korepetytorów.')
  ).toBeVisible({ timeout: 5_000 })
})

test('zmiana preferencji z ulubionego na avoid przenosi korepetytora z ulubionych do zablokowanych', async ({ page }) => {
  const ids = await getUserIds()
  const db = adminClient()

  // Sesja 1 — uczeń dodaje korepetytora do ulubionych
  await createOldSessionWithRatings(ids, { studentPreference: 'want_again' })

  // Sesja 2 (starsza o 1h) — uczeń oznacza go jako avoid
  const { data: request2 } = await db
    .from('matching_requests')
    .insert({
      student_id: ids.studentId,
      tutor_id: ids.tutor1Id,
      subject_id: 'fizyka',
      status: 'completed',
    })
    .select()
    .single()

  const { data: session2 } = await db
    .from('sessions')
    .insert({
      matching_request_id: request2.id,
      student_id: ids.studentId,
      tutor_id: ids.tutor1Id,
      daily_room_name: 'test-room-pref2',
      daily_room_url: `https://test.daily.co/test-room-pref2`,
      host_room_url: `https://test.daily.co/test-room-pref2?host=1`,
      status: 'completed',
      started_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      ended_at: new Date(Date.now() - 5 * 60 * 60 * 1000 - 30 * 60 * 1000).toISOString(),
      duration_minutes: 30,
    })
    .select()
    .single()

  await db.from('ratings').insert({
    session_id: session2.id,
    student_id: ids.studentId,
    tutor_id: ids.tutor1Id,
    ...student3DRating(2, { preference: 'avoid' }),
  })

  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/settings')

  // Najnowsza preferencja to avoid — korepetytor powinien być NA liście zablokowanych
  await expect(page.getByRole('button', { name: 'Usuń blokadę' })).toBeVisible()
  // i NIE na liście ulubionych
  await expect(page.getByRole('button', { name: 'Usuń z ulubionych' })).not.toBeVisible()
})
