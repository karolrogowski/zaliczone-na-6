import { test, expect } from '@playwright/test'
import {
  STUDENT_EMAIL,
  TUTOR1_EMAIL,
  TUTOR2_EMAIL,
  INCOMPLETE_TUTOR_EMAIL,
  adminClient,
} from './global-setup'
import { loginAs, getTestUserIds } from './helpers'

async function getUserIds() {
  const { byEmail } = await getTestUserIds()
  return {
    studentId: byEmail(STUDENT_EMAIL)!,
    tutor1Id: byEmail(TUTOR1_EMAIL)!,
    tutor2Id: byEmail(TUTOR2_EMAIL)!,
    incompleteTutorId: byEmail(INCOMPLETE_TUTOR_EMAIL)!,
  }
}

test.beforeEach(async () => {
  const db = adminClient()
  const ids = await getUserIds()

  // Pobierz session IDs żeby usunąć rekordy z FK (ratings, session_financials)
  // zanim usuniemy sessions. Bez tego DELETE na sessions może się nie udać z powodu FK.
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
  await db
    .from('tutor_profiles')
    .update({ is_available: false })
    .in('id', [ids.tutor1Id, ids.tutor2Id])
})

// ════════════════════════════════════════════════════════════════════════════
// Scenariusze 1–5
// ════════════════════════════════════════════════════════════════════════════

test('uczeń widzi ekran oczekiwania i odliczanie gdy brak korepetytora', async ({ page }) => {
  const { studentId } = await getUserIds()
  await adminClient().from('matching_requests').insert({
    student_id: studentId,
    subject_id: 'matematyka',
    status: 'pending',
  })

  await loginAs(page, STUDENT_EMAIL)
  await expect(page.getByText('Szukamy korepetytora...')).toBeVisible()
  await expect(page.getByText('Anuluj zlecenie')).toBeVisible()
  await expect(page.getByTestId('countdown')).toBeVisible()
})

test('uczeń widzi komunikat o wygaśnięciu gdy czas minął', async ({ page }) => {
  const { studentId } = await getUserIds()
  await adminClient().from('matching_requests').insert({
    student_id: studentId,
    subject_id: 'matematyka',
    status: 'pending',
    expires_at: new Date(Date.now() - 60_000).toISOString(),
  })

  await loginAs(page, STUDENT_EMAIL)
  await expect(page.getByText('Zlecenie wygasło')).toBeVisible()
})

test('korepetytor widzi pustą listę po włączeniu dostępności gdy brak zleceń', async ({ page }) => {
  await loginAs(page, TUTOR1_EMAIL)

  const toggle = page.getByTestId('availability-toggle')
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.click()

  await expect(page.getByText('Brak zleceń w Twoich przedmiotach')).toBeVisible()
})

test('korepetytor widzi zlecenie ucznia w czasie rzeczywistym', async ({ browser }) => {
  const { studentId, tutor1Id } = await getUserIds()
  await adminClient().from('tutor_profiles').update({ is_available: true }).eq('id', tutor1Id)

  const tutorCtx = await browser.newContext()
  const tutorPage = await tutorCtx.newPage()

  await loginAs(tutorPage, TUTOR1_EMAIL)
  await expect(tutorPage.getByText('Brak zleceń w Twoich przedmiotach')).toBeVisible({ timeout: 10_000 })

  // Student składa zlecenie przez DB — unikamy auth issue z form submission
  await adminClient().from('matching_requests').insert({
    student_id: studentId,
    subject_id: 'matematyka',
    status: 'pending',
  })

  await expect(tutorPage.getByText('Akceptuj zlecenie')).toBeVisible({ timeout: 10_000 })

  await tutorCtx.close()
})

test('tylko jeden korepetytor wygrywa wyścig o zlecenie', async ({ browser }) => {
  const { studentId, tutor1Id, tutor2Id } = await getUserIds()
  await adminClient()
    .from('tutor_profiles')
    .update({ is_available: true })
    .in('id', [tutor1Id, tutor2Id])

  const tutor1Ctx = await browser.newContext()
  const tutor2Ctx = await browser.newContext()
  const tutor1Page = await tutor1Ctx.newPage()
  const tutor2Page = await tutor2Ctx.newPage()

  await loginAs(tutor1Page, TUTOR1_EMAIL)
  await loginAs(tutor2Page, TUTOR2_EMAIL)

  await adminClient().from('matching_requests').insert({
    student_id: studentId,
    subject_id: 'matematyka',
    status: 'pending',
  })

  await expect(tutor1Page.getByText('Akceptuj zlecenie')).toBeVisible({ timeout: 10_000 })
  await expect(tutor2Page.getByText('Akceptuj zlecenie')).toBeVisible({ timeout: 10_000 })

  await Promise.all([
    tutor1Page.getByText('Akceptuj zlecenie').click(),
    tutor2Page.getByText('Akceptuj zlecenie').click(),
  ])

  await Promise.all([tutor1Page.waitForTimeout(3_000), tutor2Page.waitForTimeout(3_000)])

  const tutor1Won = await tutor1Page.getByText('Zaakceptowałeś zlecenie').isVisible()
  const tutor2Won = await tutor2Page.getByText('Zaakceptowałeś zlecenie').isVisible()
  const tutor1Lost = await tutor1Page.getByText('Inny korepetytor był szybszy').isVisible()
  const tutor2Lost = await tutor2Page.getByText('Inny korepetytor był szybszy').isVisible()

  expect(tutor1Won || tutor2Won).toBe(true)
  expect(tutor1Won && tutor2Won).toBe(false)
  expect(tutor1Lost || tutor2Lost).toBe(true)

  await tutor1Ctx.close()
  await tutor2Ctx.close()
})

// ════════════════════════════════════════════════════════════════════════════
// Scenariusze 6–12
// ════════════════════════════════════════════════════════════════════════════

test('uczeń anuluje zlecenie i wraca do dashboardu bez aktywnego zlecenia', async ({ page }) => {
  const { studentId } = await getUserIds()
  await adminClient().from('matching_requests').insert({
    student_id: studentId,
    subject_id: 'matematyka',
    status: 'pending',
  })

  await loginAs(page, STUDENT_EMAIL)
  await expect(page.getByText('Szukamy korepetytora...')).toBeVisible()

  await page.getByText('Anuluj zlecenie').click()

  await expect(page.getByText('Szukamy korepetytora...')).not.toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('link', { name: 'Nowe zlecenie' }).first()).toBeVisible({ timeout: 10_000 })
})

test('uczeń widzi w czasie rzeczywistym że korepetytor zaakceptował', async ({ browser }) => {
  const { studentId, tutor1Id } = await getUserIds()
  await adminClient().from('tutor_profiles').update({ is_available: true }).eq('id', tutor1Id)

  const studentCtx = await browser.newContext()
  const tutorCtx = await browser.newContext()
  const studentPage = await studentCtx.newPage()
  const tutorPage = await tutorCtx.newPage()

  await adminClient().from('matching_requests').insert({
    student_id: studentId,
    subject_id: 'matematyka',
    status: 'pending',
  })

  await loginAs(studentPage, STUDENT_EMAIL)
  await expect(studentPage.getByText('Szukamy korepetytora...')).toBeVisible()

  await loginAs(tutorPage, TUTOR1_EMAIL)
  await expect(tutorPage.getByText('Akceptuj zlecenie')).toBeVisible({ timeout: 10_000 })
  await tutorPage.getByText('Akceptuj zlecenie').click()

  await expect(studentPage.getByText('Znaleziono korepetytora')).toBeVisible({ timeout: 10_000 })

  await studentCtx.close()
  await tutorCtx.close()
})

test('zalogowany korepetytor nie widzi formularza zlecenia ucznia', async ({ page }) => {
  await loginAs(page, TUTOR1_EMAIL)

  await expect(page.locator('select[name="subject_id"]')).not.toBeVisible()
  await expect(page.getByText('Zamów korepetytora')).not.toBeVisible()
})

test('zalogowany uczeń nie widzi przełącznika dostępności korepetytora', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)

  await expect(page.getByTestId('availability-toggle')).not.toBeVisible()
  await expect(page.getByText('Dostępność')).not.toBeVisible()
})

test('formularz zlecenia wymaga wybrania przedmiotu', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/request')
  await page.waitForURL('/request')

  // HTML5 validation blokuje wysłanie bez wybranego przedmiotu
  await page.click('button[type="submit"]')
  // Strona nie opuściła /request — walidacja przeglądarki zadziałała
  await expect(page.locator('select[name="subject_id"]')).toBeVisible()
  expect(page.url()).toContain('/request')
})

test('korepetytor bez uzupełnionego profilu widzi prompt z prośbą o uzupełnienie', async ({
  page,
}) => {
  await loginAs(page, INCOMPLETE_TUTOR_EMAIL)

  await expect(page.getByRole('heading', { name: 'Uzupełnij profil' })).toBeVisible()
  await expect(page.getByTestId('availability-toggle')).not.toBeVisible()
})

test('zaakceptowane zlecenie nie jest widoczne dla drugiego korepetytora', async ({ browser }) => {
  const { studentId, tutor1Id, tutor2Id } = await getUserIds()

  await adminClient()
    .from('tutor_profiles')
    .update({ is_available: true })
    .in('id', [tutor1Id, tutor2Id])

  const { data: request } = await adminClient()
    .from('matching_requests')
    .insert({ student_id: studentId, subject_id: 'matematyka' })
    .select()
    .single()

  await adminClient()
    .from('matching_requests')
    .update({ status: 'accepted', tutor_id: tutor1Id })
    .eq('id', request.id)

  const tutor2Ctx = await browser.newContext()
  const tutor2Page = await tutor2Ctx.newPage()
  await loginAs(tutor2Page, TUTOR2_EMAIL)

  await expect(tutor2Page.getByText('Brak zleceń w Twoich przedmiotach')).toBeVisible({ timeout: 10_000 })
  await expect(tutor2Page.getByText('Akceptuj zlecenie')).not.toBeVisible()

  await tutor2Ctx.close()
})
// ─── Scenariusz 13 ───────────────────────────────────────────────────────────

test('uczeń z aktywnym zleceniem widzi jego status zamiast przycisku nowego zlecenia', async ({ page }) => {
  const { studentId } = await getUserIds()
  await adminClient().from('matching_requests').insert({
    student_id: studentId,
    subject_id: 'matematyka',
    status: 'pending',
  })

  await loginAs(page, STUDENT_EMAIL)

  await expect(page.getByText('Szukamy korepetytora...')).toBeVisible()
  // Przycisk "Złóż pierwsze zlecenie" nie powinien być widoczny gdy zlecenie aktywne
  await expect(page.getByRole('link', { name: /Złóż pierwsze zlecenie/ })).not.toBeVisible()
})

// ─── Scenariusz 14 ───────────────────────────────────────────────────────────

test('po wygaśnięciu zlecenia uczeń może złożyć nowe', async ({ page }) => {
  const { studentId } = await getUserIds()
  // Status 'expired' wprost — getStudentActiveRequest filtruje 'expired',
  // więc /request page nie zrobi redirect i formularz będzie dostępny
  await adminClient().from('matching_requests').insert({
    student_id: studentId,
    subject_id: 'matematyka',
    status: 'expired',
    expires_at: new Date(Date.now() - 60_000).toISOString(),
  })

  await loginAs(page, STUDENT_EMAIL)

  // Formularz nowego zlecenia jest dostępny — brak aktywnego zlecenia
  await page.goto('/request')
  await page.waitForURL('/request')
  await expect(page.locator('select[name="subject_id"]')).toBeVisible({ timeout: 5_000 })
})
