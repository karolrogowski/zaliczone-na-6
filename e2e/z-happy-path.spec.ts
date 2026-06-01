/**
 * Pełny przepływ end-to-end: złożenie zlecenia → akceptacja → sesja wideo → zakończenie → ocena.
 *
 * To najważniejszy test regresji — weryfikuje że wszystkie warstwy aplikacji
 * działają razem. Uruchamiaj po każdej większej zmianie.
 */
import { test, expect } from '@playwright/test'
import {
  STUDENT_EMAIL,
  TUTOR1_EMAIL,
  adminClient,
} from './global-setup'
import { loginAs, getTestUserIds, selectAllStars } from './helpers'
import { mockRoomUrl, mockHostUrl } from './video-fixtures'

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
  await db.from('ratings').delete().eq('tutor_id', ids.tutor1Id)
  await db.from('sessions').delete().eq('student_id', ids.studentId)
  await db.from('matching_requests').delete().eq('student_id', ids.studentId)
  await db.from('tutor_profiles').update({ is_available: false }).eq('id', ids.tutor1Id)
})

test('pełny przepływ: oczekiwanie → akceptacja → sesja → zakończenie → ocena', async ({ browser }) => {
  test.setTimeout(120_000)
  const ids = await getUserIds()
  const db = adminClient()

  // ── Etap 1: Uczeń czeka, korepetytor jest dostępny ────────────────────────
  await db.from('tutor_profiles').update({ is_available: true }).eq('id', ids.tutor1Id)
  await db.from('matching_requests').insert({
    student_id: ids.studentId,
    subject_id: 'matematyka',
    status: 'pending',
  })

  const studentCtx = await browser.newContext()
  const tutorCtx = await browser.newContext()
  const studentPage = await studentCtx.newPage()
  const tutorPage = await tutorCtx.newPage()

  await loginAs(studentPage, STUDENT_EMAIL)
  await expect(studentPage.getByText('Szukamy korepetytora...')).toBeVisible()
  await expect(studentPage.getByTestId('countdown')).toBeVisible()

  // ── Etap 2: Korepetytor akceptuje ─────────────────────────────────────────
  await loginAs(tutorPage, TUTOR1_EMAIL)
  await expect(tutorPage.getByText('Akceptuj zlecenie')).toBeVisible({ timeout: 10_000 })
  await tutorPage.getByText('Akceptuj zlecenie').click()
  await expect(tutorPage.getByText('Zaakceptowałeś zlecenie')).toBeVisible({ timeout: 10_000 })

  // ── Etap 3: Uczeń widzi link do sesji ─────────────────────────────────────
  await expect(studentPage.getByText('Znaleziono korepetytora')).toBeVisible({ timeout: 15_000 })
  await expect(studentPage.getByTestId('join-session-link')).toBeVisible()

  // Pobierz sesję z DB żeby mieć jej ID
  const { data: sessions } = await db
    .from('sessions')
    .select('id, matching_request_id')
    .eq('student_id', ids.studentId)
    .limit(1)
  const session = sessions?.[0]
  expect(session).not.toBeNull()

  // ── Etap 4: Obie strony wchodzą na stronę sesji ───────────────────────────
  await studentPage.goto(`/session/${session!.id}`)
  await expect(studentPage.getByTestId('timer')).toBeVisible({ timeout: 10_000 })
  await expect(studentPage.locator('iframe')).toBeVisible({ timeout: 10_000 })

  await tutorPage.goto(`/session/${session!.id}`)
  await expect(tutorPage.getByRole('button', { name: 'Zakończ sesję' })).toBeVisible({ timeout: 10_000 })

  // ── Etap 5: Korepetytor kończy sesję ──────────────────────────────────────
  await tutorPage.fill('#session-notes', 'Materiał omówiony, wszystko jasne.')
  await tutorPage.getByRole('button', { name: 'Zakończ sesję' }).click()
  await tutorPage.getByRole('button', { name: 'Tak, zakończ' }).click()

  // Korepetytor → /rate/ (ale nie jest studentem, więc zostanie przekierowany)
  await tutorPage.waitForURL(/\/rate\/|\/dashboard/, { timeout: 15_000 })

  // ── Etap 6: Uczeń wykrywa zakończenie i trafia na ocenę ───────────────────
  await studentPage.waitForURL(/\/rate\//, { timeout: 20_000 })
  await expect(studentPage.getByText('Oceń korepetytora')).toBeVisible()
  await expect(studentPage.locator('input[name="score_knowledge"]')).toHaveCount(5)

  // ── Etap 7: Uczeń wystawia ocenę (3 wymiary) ──────────────────────────────
  await selectAllStars(studentPage, 5)
  await studentPage.fill('textarea[name="comment"]', 'Doskonała sesja!')
  await studentPage.getByRole('button', { name: 'Wyślij ocenę' }).click()

  // Poczekaj na zapis przez polling DB
  let rating = null
  for (let i = 0; i < 10; i++) {
    const { data } = await db
      .from('ratings')
      .select('id, score_knowledge, score_organization, score_communication')
      .eq('session_id', session!.id)
      .eq('rated_by', 'student')
      .maybeSingle()
    if (data) { rating = data; break }
    await new Promise(r => setTimeout(r, 500))
  }

  expect(rating).not.toBeNull()
  expect(rating?.score_knowledge).toBe(5)
  expect(rating?.score_organization).toBe(5)
  expect(rating?.score_communication).toBe(5)

  // ── Etap 8: Sesja jest oznaczona jako zakończona w DB ─────────────────────
  const { data: completedSession } = await db
    .from('sessions')
    .select('status, ended_at')
    .eq('id', session!.id)
    .single()

  expect(completedSession?.status).toBe('completed')
  expect(completedSession?.ended_at).not.toBeNull()

  await studentCtx.close()
  await tutorCtx.close()
})