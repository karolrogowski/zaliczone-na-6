/**
 * Krok 7 planu płatności (docs/payment-implementation-plan.md): onboarding
 * korepetytora przez Stripe Connect Express.
 *
 * Wymaga włączonego Stripe Connect na platformowym koncie testowym
 * (jednorazowa aktywacja w dashboardzie Stripe). Jeśli Connect nie jest
 * aktywny, testy są pomijane z czytelnym komunikatem.
 *
 * Pełne przejście hostowanego formularza onboardingowego Stripe nie jest
 * automatyzowane (zewnętrzny, zmienny UI) — pozytywną ścieżkę return-page
 * weryfikujemy manualnie w test mode; tu testujemy ścieżkę "konto niekompletne"
 * oraz render UI dla obu stanów flagi stripe_onboarding_done.
 */
import { test, expect } from '@playwright/test'
import Stripe from 'stripe'
import { STUDENT_EMAIL, TUTOR2_EMAIL, adminClient } from './global-setup'
import { loginAs, getTestUserIds } from './helpers'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

async function getTutor2Id(): Promise<string> {
  const { byEmail } = await getTestUserIds()
  return byEmail(TUTOR2_EMAIL)!
}

async function getStudentId(): Promise<string> {
  const { byEmail } = await getTestUserIds()
  return byEmail(STUDENT_EMAIL)!
}

/** Przywraca stan wyjściowy pól Stripe na profilu korepetytora. */
async function resetTutorStripeFields(tutorId: string) {
  await adminClient()
    .from('tutor_profiles')
    .update({ stripe_account_id: null, stripe_onboarding_done: false })
    .eq('id', tutorId)
}

/**
 * Konto Connect aktywowane w całości przez API (typ custom) — Express nie da
 * się ukończyć bez hostowanego formularza Stripe, a do weryfikacji transferów
 * (krok 8) potrzebne jest konto z aktywną capability `transfers`.
 */
async function createActivatedConnectAccount(stripe: Stripe): Promise<string> {
  const account = await stripe.accounts.create({
    type: 'custom',
    country: 'PL',
    business_type: 'individual',
    individual: {
      first_name: 'Jan',
      last_name: 'Testowy',
      email: 'jan.testowy@test.zaliczone.local',
      dob: { day: 1, month: 1, year: 1990 },
      address: { line1: 'Testowa 1', city: 'Warszawa', postal_code: '00-001', country: 'PL' },
      phone: '+48600000000',
    },
    business_profile: { mcc: '8299', product_description: 'Korepetycje online' },
    capabilities: { transfers: { requested: true } },
    tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: '127.0.0.1' },
    external_account: {
      object: 'bank_account',
      country: 'PL',
      currency: 'pln',
      account_number: 'PL61109010140000071219812874',
    },
    metadata: { purpose: 'e2e-split' },
  })

  // Poczekaj aż Stripe aktywuje capability transfers (test mode: sekundy)
  for (let i = 0; i < 20; i++) {
    const refreshed = await stripe.accounts.retrieve(account.id)
    if (refreshed.capabilities?.transfers === 'active' && refreshed.payouts_enabled) {
      return account.id
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Konto Connect ${account.id} nie aktywowało capability transfers w czasie`)
}

/** Tworzy PaymentIntent z preautoryzacją (status 'requires_capture'). */
async function createAuthorizedPaymentIntent(stripe: Stripe, amount = 10000) {
  return stripe.paymentIntents.create({
    amount,
    currency: 'pln',
    capture_method: 'manual',
    payment_method: 'pm_card_visa',
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
  })
}

/** Zaakceptowane zlecenie + sesja in_progress — gotowe do zakończenia przez UI. */
async function insertAcceptedSession(studentId: string, tutorId: string, paymentIntentId: string) {
  const db = adminClient()
  const { data: request } = await db
    .from('matching_requests')
    .insert({
      student_id: studentId,
      subject_id: 'matematyka',
      status: 'accepted',
      tutor_id: tutorId,
      stripe_payment_intent_id: paymentIntentId,
      stripe_status: 'authorized',
    })
    .select('id')
    .single()

  const roomName = `test-room-${Date.now()}`
  const { data: session } = await db
    .from('sessions')
    .insert({
      matching_request_id: request!.id,
      student_id: studentId,
      tutor_id: tutorId,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      daily_room_name: roomName,
      daily_room_url: `https://test.whereby.com/${roomName}`,
      host_room_url: `https://test.whereby.com/${roomName}?roomKey=testkey`,
    })
    .select('id')
    .single()

  return { requestId: request!.id, sessionId: session!.id }
}

/** Kończy sesję przez UI jako korepetytor (uruchamia capturePayment w tle). */
async function completeSessionViaUi(page: import('@playwright/test').Page, sessionId: string) {
  await page.goto(`/session/${sessionId}`)
  await expect(page.getByRole('button', { name: 'Zakończ sesję' })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Zakończ sesję' }).click()
  await page.getByRole('button', { name: 'Tak, zakończ' }).click()
  await page.waitForURL(/\/rate\/|\/dashboard/, { timeout: 15_000 })
}

type FinancialsRow = {
  stripe_transfer_id: string | null
  transfer_pending: boolean
  tutor_earning_grosz: number
  platform_commission_grosz: number
  student_cost_grosz: number
  stripe_charge_id: string | null
  stripe_status: string
}

async function pollFinancials(
  sessionId: string,
  predicate: (row: FinancialsRow) => boolean
): Promise<FinancialsRow> {
  const db = adminClient()
  for (let i = 0; i < 30; i++) {
    const { data } = await db
      .from('session_financials')
      .select(
        'stripe_transfer_id, transfer_pending, tutor_earning_grosz, platform_commission_grosz, student_cost_grosz, stripe_charge_id, stripe_status'
      )
      .eq('session_id', sessionId)
      .maybeSingle()
    if (data && predicate(data)) return data
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`session_financials dla sesji ${sessionId} nie osiągnęły oczekiwanego stanu`)
}

let connectEnabled = true

test.beforeAll(async () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    connectEnabled = false
    return
  }
  // Sonda: tworzenie konta Express nie powiedzie się, jeśli platforma nie ma
  // aktywowanego Connect w test mode — wtedy pomijamy cały plik.
  try {
    const probe = await getStripe().accounts.create({
      type: 'express',
      country: 'PL',
      capabilities: { transfers: { requested: true } },
      metadata: { purpose: 'e2e-connect-probe' },
    })
    await getStripe().accounts.del(probe.id)
  } catch {
    connectEnabled = false
  }
})

test.beforeEach(async () => {
  test.skip(
    !connectEnabled,
    'Stripe Connect nieaktywny (brak STRIPE_SECRET_KEY lub Connect niewłączony w dashboardzie)'
  )
  await resetTutorStripeFields(await getTutor2Id())
})

test('korepetytor bez konta Stripe widzi przycisk "Połącz konto bankowe"', async ({ page }) => {
  await loginAs(page, TUTOR2_EMAIL)
  await page.goto('/settings')

  await expect(page.getByRole('heading', { name: 'Konto bankowe' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Połącz konto bankowe' })).toBeVisible()
})

test('kliknięcie przycisku tworzy konto Connect i przekierowuje na Stripe', async ({ page }) => {
  const tutorId = await getTutor2Id()

  await loginAs(page, TUTOR2_EMAIL)
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Połącz konto bankowe' }).click()

  await page.waitForURL(/connect\.stripe\.com/, { timeout: 20_000 })

  const { data } = await adminClient()
    .from('tutor_profiles')
    .select('stripe_account_id, stripe_onboarding_done')
    .eq('id', tutorId)
    .single()

  expect(data?.stripe_account_id).toMatch(/^acct_/)
  expect(data?.stripe_onboarding_done).toBe(false)
})

test('powrót z niekompletnym kontem pokazuje prośbę o dokończenie konfiguracji', async ({ page }) => {
  const tutorId = await getTutor2Id()

  // Świeże konto Express bez przejścia onboardingu — payouts_enabled = false
  const account = await getStripe().accounts.create({
    type: 'express',
    country: 'PL',
    capabilities: { transfers: { requested: true } },
    metadata: { tutor_id: tutorId, purpose: 'e2e' },
  })
  await adminClient()
    .from('tutor_profiles')
    .update({ stripe_account_id: account.id })
    .eq('id', tutorId)

  await loginAs(page, TUTOR2_EMAIL)
  await page.goto('/settings/stripe/return')

  await expect(page.getByText('Stripe wymaga dodatkowych informacji')).toBeVisible()

  const { data } = await adminClient()
    .from('tutor_profiles')
    .select('stripe_onboarding_done')
    .eq('id', tutorId)
    .single()
  expect(data?.stripe_onboarding_done).toBe(false)
})

test('po ukończonym onboardingu ustawienia pokazują "Konto podłączone"', async ({ page }) => {
  const tutorId = await getTutor2Id()

  await adminClient()
    .from('tutor_profiles')
    .update({ stripe_account_id: 'acct_e2e_done', stripe_onboarding_done: true })
    .eq('id', tutorId)

  await loginAs(page, TUTOR2_EMAIL)
  await page.goto('/settings')

  await expect(page.getByText('✓ Konto podłączone')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Otwórz panel wypłat Stripe' })).toBeVisible()

  await resetTutorStripeFields(tutorId)
})

test('korepetytor bez onboardingu widzi ostrzeżenie na dashboardzie', async ({ page }) => {
  await loginAs(page, TUTOR2_EMAIL)

  await expect(
    page.getByText('Podłącz konto bankowe w', { exact: false })
  ).toBeVisible()
})

// ── Krok 8: split payment ────────────────────────────────────────────────────

test('pełny przepływ: capture po sesji wysyła transfer 70% i zapisuje ewidencję', async ({ page }) => {
  test.setTimeout(120_000)
  const stripe = getStripe()
  const tutorId = await getTutor2Id()
  const studentId = await getStudentId()
  const db = adminClient()

  const { data: oldSessions } = await db.from('sessions').select('id').eq('student_id', studentId)
  if (oldSessions?.length) {
    const oldIds = oldSessions.map((s: { id: string }) => s.id)
    await db.from('ratings').delete().in('session_id', oldIds)
    await db.from('session_financials').delete().in('session_id', oldIds)
  }
  await db.from('sessions').delete().eq('student_id', studentId)
  await db.from('matching_requests').delete().eq('student_id', studentId)

  const accountId = await createActivatedConnectAccount(stripe)
  await db
    .from('tutor_profiles')
    .update({ stripe_account_id: accountId, stripe_onboarding_done: true })
    .eq('id', tutorId)

  const pi = await createAuthorizedPaymentIntent(stripe)
  const { sessionId } = await insertAcceptedSession(studentId, tutorId, pi.id)

  await loginAs(page, TUTOR2_EMAIL)
  await completeSessionViaUi(page, sessionId)

  const financials = await pollFinancials(sessionId, (r) => r.stripe_transfer_id !== null)

  // Zdejmij blokadę oceny (4h od ended_at) — nie może przeciekać do kolejnych testów
  await db
    .from('sessions')
    .update({ ended_at: new Date(Date.now() - 5 * 3600_000).toISOString() })
    .eq('id', sessionId)

  // Podział 70/30 przy cenie 100 zł (10000 gr) i prowizji 30%
  expect(financials.student_cost_grosz).toBe(10000)
  expect(financials.tutor_earning_grosz).toBe(7000)
  expect(financials.platform_commission_grosz).toBe(3000)
  expect(financials.transfer_pending).toBe(false)
  expect(financials.stripe_transfer_id).toMatch(/^tr_/)

  // Kwota transferu zweryfikowana w Stripe — 70% trafia na konto korepetytora
  const transfer = await stripe.transfers.retrieve(financials.stripe_transfer_id!)
  expect(transfer.amount).toBe(7000)
  expect(transfer.destination).toBe(accountId)

  await resetTutorStripeFields(tutorId)
})

test('korepetytor bez onboardingu: udział odłożony, wysłany po podłączeniu konta', async ({ page }) => {
  test.setTimeout(120_000)
  const stripe = getStripe()
  const tutorId = await getTutor2Id()
  const studentId = await getStudentId()
  const db = adminClient()

  const { data: oldSessions } = await db.from('sessions').select('id').eq('student_id', studentId)
  if (oldSessions?.length) {
    const oldIds = oldSessions.map((s: { id: string }) => s.id)
    await db.from('ratings').delete().in('session_id', oldIds)
    await db.from('session_financials').delete().in('session_id', oldIds)
  }
  await db.from('sessions').delete().eq('student_id', studentId)
  await db.from('matching_requests').delete().eq('student_id', studentId)

  // Sesja kończy się ZANIM korepetytor podłączył konto bankowe
  const pi = await createAuthorizedPaymentIntent(stripe)
  const { sessionId } = await insertAcceptedSession(studentId, tutorId, pi.id)

  await loginAs(page, TUTOR2_EMAIL)
  await completeSessionViaUi(page, sessionId)

  const deferred = await pollFinancials(sessionId, (r) => r.stripe_status === 'captured')
  expect(deferred.transfer_pending).toBe(true)
  expect(deferred.stripe_transfer_id).toBeNull()
  expect(deferred.tutor_earning_grosz).toBe(7000)

  // Zdejmij blokadę oceny (4h od ended_at) — middleware przekierowywałby
  // nawigację korepetytora na /rate zamiast na stronę powrotu z onboardingu
  await db
    .from('sessions')
    .update({ ended_at: new Date(Date.now() - 5 * 3600_000).toISOString() })
    .eq('id', sessionId)

  // Korepetytor podłącza konto — powrót z onboardingu uruchamia flush
  const accountId = await createActivatedConnectAccount(stripe)
  await db.from('tutor_profiles').update({ stripe_account_id: accountId }).eq('id', tutorId)

  await page.goto('/settings/stripe/return')
  await expect(page.getByText('✓ Konto bankowe zostało podłączone')).toBeVisible({ timeout: 20_000 })

  const flushed = await pollFinancials(sessionId, (r) => r.stripe_transfer_id !== null)
  expect(flushed.transfer_pending).toBe(false)

  const transfer = await stripe.transfers.retrieve(flushed.stripe_transfer_id!)
  expect(transfer.amount).toBe(7000)
  expect(transfer.destination).toBe(accountId)

  await resetTutorStripeFields(tutorId)
})
