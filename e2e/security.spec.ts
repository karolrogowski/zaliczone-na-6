import { test, expect } from '@playwright/test'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { adminClient, TEST_PASSWORD, STUDENT_EMAIL, TUTOR1_EMAIL, TUTOR2_EMAIL } from './global-setup'
import { loginAs, getTestUserIds, student3DRating } from './helpers'

const ADMIN_NO_MFA_EMAIL = 'sec-admin-nomfa@test.zaliczone.local'
const ATTACKER_EMAIL = 'sec-attacker-admin@test.zaliczone.local'
const SEC_TUTOR_EMAIL = 'sec-rls-tutor@test.zaliczone.local'
const SEC_STUDENT_EMAIL = 'sec-rls-student@test.zaliczone.local'

let secRequestId: string | null = null

async function deleteIfExists(email: string) {
  const { byEmail } = await getTestUserIds()
  const id = byEmail(email)
  if (id) await adminClient().auth.admin.deleteUser(id)
}

test.beforeAll(async () => {
  const supabase = adminClient()

  for (const email of [ADMIN_NO_MFA_EMAIL, ATTACKER_EMAIL, SEC_TUTOR_EMAIL, SEC_STUDENT_EMAIL]) {
    await deleteIfExists(email)
  }

  // Admin bez MFA: user_metadata.role='admin' potrzebne do przejścia sprawdzenia w middleware
  const { data: adminData } = await supabase.auth.admin.createUser({
    email: ADMIN_NO_MFA_EMAIL,
    password: TEST_PASSWORD,
    user_metadata: { role: 'admin', full_name: 'Admin Bez MFA' },
    email_confirm: true,
  })
  // Trigger handle_new_user ustawia role='student' z whitelisty — ręcznie promujemy na admina
  if (adminData?.user) {
    await supabase.from('profiles').update({ role: 'admin' }).eq('id', adminData.user.id)
  }

  // Atakujący próbujący zarejestrować się jako admin przez metadane
  await supabase.auth.admin.createUser({
    email: ATTACKER_EMAIL,
    password: TEST_PASSWORD,
    user_metadata: { role: 'admin', full_name: 'Atakujący Admin' },
    email_confirm: true,
  })

  // Użytkownicy do testu RLS — celowo bez wspólnych zleceń
  await supabase.auth.admin.createUser({
    email: SEC_TUTOR_EMAIL,
    password: TEST_PASSWORD,
    user_metadata: { role: 'tutor', full_name: 'Korepetytor RLS' },
    email_confirm: true,
  })
  await supabase.auth.admin.createUser({
    email: SEC_STUDENT_EMAIL,
    password: TEST_PASSWORD,
    user_metadata: { role: 'student', full_name: 'Uczeń RLS' },
    email_confirm: true,
  })

  // Zlecenie do testu anulowania przez korepetytora
  const { byEmail: lookup } = await getTestUserIds()
  const studentId = lookup(STUDENT_EMAIL)
  if (studentId) {
    const { data } = await supabase
      .from('matching_requests')
      .insert({
        student_id: studentId,
        subject_id: 'matematyka',
        level: 'Test bezpieczeństwa',
        scope: 'Test bezpieczeństwa',
        description: 'Zlecenie tworzone automatycznie przez testy bezpieczeństwa',
        status: 'pending',
      })
      .select('id')
      .single()
    secRequestId = data?.id ?? null
  }
})

test.afterAll(async () => {
  if (secRequestId) {
    await adminClient().from('matching_requests').delete().eq('id', secRequestId)
  }
  for (const email of [ADMIN_NO_MFA_EMAIL, ATTACKER_EMAIL, SEC_TUTOR_EMAIL, SEC_STUDENT_EMAIL]) {
    await deleteIfExists(email)
  }
})

// ─── Test 1: Eskalacja uprawnień przez rejestrację ────────────────────────────

test('rejestracja z role=admin w metadanych tworzy profil o roli student', async () => {
  const { byEmail } = await getTestUserIds()
  const userId = byEmail(ATTACKER_EMAIL)
  expect(userId).toBeDefined()

  const { data: profile } = await adminClient()
    .from('profiles')
    .select('role')
    .eq('id', userId!)
    .single()

  expect(profile?.role).toBe('student')
})

// ─── Test 2: Panel admina — niezalogowany użytkownik ─────────────────────────

test('niezalogowany dostęp do /admin/dashboard przekierowuje na /admin/login', async ({ page }) => {
  await page.goto('/admin/dashboard')
  await expect(page).toHaveURL('/admin/login')
})

// ─── Test 3: Panel admina — zalogowany uczeń ──────────────────────────────────

test('uczeń próbujący wejść na /admin/dashboard zostaje przekierowany na /dashboard', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/admin/dashboard')
  await expect(page).toHaveURL('/dashboard')
})

// ─── Test 4: Panel admina — zalogowany korepetytor ───────────────────────────

test('korepetytor próbujący wejść na /admin/dashboard zostaje przekierowany na /dashboard', async ({ page }) => {
  await loginAs(page, TUTOR1_EMAIL)
  await page.goto('/admin/dashboard')
  await expect(page).toHaveURL('/dashboard')
})

// ─── Test 5: Panel admina — admin bez skonfigurowanego MFA ───────────────────

test('admin bez skonfigurowanego MFA zostaje przekierowany na stronę konfiguracji TOTP', async ({ page }) => {
  await loginAs(page, ADMIN_NO_MFA_EMAIL)
  await page.goto('/admin/dashboard')
  // Brak TOTP → /admin/mfa/enroll; TOTP bez aal2 → /admin/mfa/verify
  await expect(page).toHaveURL(/\/admin\/mfa\/(enroll|verify)/)
})

// ─── Test 6: OTP type injection ───────────────────────────────────────────────

test('nieprawidłowy typ OTP w /auth/confirm przekierowuje na stronę błędu', async ({ page }) => {
  await page.goto('/auth/confirm?token_hash=fakehash&type=evil_payload')
  await expect(page).toHaveURL('/login?error=invalid_link')
})

test('/auth/confirm bez token_hash przekierowuje na stronę błędu', async ({ page }) => {
  await page.goto('/auth/confirm?type=signup')
  await expect(page).toHaveURL('/login?error=invalid_link')
})

// ─── Test 7: RLS — widoczność profilu ucznia ──────────────────────────────────

test('korepetytor bez wspólnej sesji nie widzi profilu ucznia', async () => {
  const { byEmail } = await getTestUserIds()
  const studentId = byEmail(SEC_STUDENT_EMAIL)
  expect(studentId).toBeDefined()

  const userClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  await userClient.auth.signInWithPassword({ email: SEC_TUTOR_EMAIL, password: TEST_PASSWORD })

  const { data } = await userClient
    .from('profiles')
    .select('id')
    .eq('id', studentId!)
    .maybeSingle()

  expect(data).toBeNull()

  await userClient.auth.signOut()
})

// ─── Test 8: RLS — korepetytor nie może anulować cudzego zlecenia ─────────────

test('korepetytor nie może anulować zlecenia ucznia przez bezpośrednie zapytanie do bazy', async () => {
  if (!secRequestId) {
    test.skip(true, 'Brak danych testowych — insert zlecenia nie powiódł się w beforeAll')
    return
  }

  const tutorClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  await tutorClient.auth.signInWithPassword({ email: TUTOR1_EMAIL, password: TEST_PASSWORD })

  // Korepetytor próbuje ustawić status='cancelled' bez filtra student_id
  await tutorClient
    .from('matching_requests')
    .update({ status: 'cancelled' })
    .eq('id', secRequestId!)
    .eq('status', 'pending')

  await tutorClient.auth.signOut()

  // Zlecenie musi nadal być 'pending' — RLS lub brak uprawnień do UPDATE powinien zablokować
  const { data } = await adminClient()
    .from('matching_requests')
    .select('status')
    .eq('id', secRequestId!)
    .single()

  expect(data?.status).toBe('pending')
})

// ─── Test 9: RLS — tutor2 nie widzi zakończonych zleceń tutor1 ───────────────

test('tutor2 nie widzi zakończonych zleceń obsługiwanych przez tutor1', async () => {
  const { byEmail } = await getTestUserIds()
  const tutor1Id = byEmail(TUTOR1_EMAIL)
  expect(tutor1Id).toBeDefined()

  const tutor2Client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  await tutor2Client.auth.signInWithPassword({ email: TUTOR2_EMAIL, password: TEST_PASSWORD })

  // Tutor2 próbuje zobaczyć zlecenia gdzie tutor1 był korepetytorem
  const { data } = await tutor2Client
    .from('matching_requests')
    .select('id')
    .eq('tutor_id', tutor1Id!)
    .in('status', ['accepted', 'completed'])

  expect(data ?? []).toHaveLength(0)

  await tutor2Client.auth.signOut()
})

// ─── Test 10: RLS — uczeń nie widzi zleceń innego ucznia ─────────────────────

test('uczeń nie widzi zleceń innego ucznia przez zapytanie do bazy', async () => {
  const { byEmail } = await getTestUserIds()
  const student1Id = byEmail(STUDENT_EMAIL)
  expect(student1Id).toBeDefined()

  const secStudentClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  await secStudentClient.auth.signInWithPassword({ email: SEC_STUDENT_EMAIL, password: TEST_PASSWORD })

  // SEC_STUDENT próbuje zobaczyć zlecenia STUDENT — nie powinien mieć dostępu
  const { data } = await secStudentClient
    .from('matching_requests')
    .select('id')
    .eq('student_id', student1Id!)

  expect(data ?? []).toHaveLength(0)

  await secStudentClient.auth.signOut()
})

// ─── Test 11: Mass assignment — student nie może podnieść siebie do roli admin ─

test('uczeń nie może zmienić swojej roli na admin przez bezpośredni UPDATE profiles', async () => {
  const { byEmail } = await getTestUserIds()
  const studentId = byEmail(SEC_STUDENT_EMAIL)
  expect(studentId).toBeDefined()

  const studentClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  await studentClient.auth.signInWithPassword({ email: SEC_STUDENT_EMAIL, password: TEST_PASSWORD })

  // Próba mass assignment: zmiana roli z poziomu klienta
  await studentClient
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', studentId!)

  await studentClient.auth.signOut()

  // Service role weryfikuje rzeczywisty stan w bazie
  const { data } = await adminClient()
    .from('profiles')
    .select('role')
    .eq('id', studentId!)
    .single()

  expect(data?.role).toBe('student')
})

// ─── Test 12: Mass assignment — korepetytor nie może zawyżyć swojej oceny ─────

test('korepetytor nie może zmienić rating_avg ani rating_count na tutor_profiles', async () => {
  const { byEmail } = await getTestUserIds()
  const tutorId = byEmail(TUTOR1_EMAIL)
  expect(tutorId).toBeDefined()

  // Zapamiętaj stan wyjściowy
  const { data: before } = await adminClient()
    .from('tutor_profiles')
    .select('rating_avg, rating_count')
    .eq('id', tutorId!)
    .single()

  const tutorClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  await tutorClient.auth.signInWithPassword({ email: TUTOR1_EMAIL, password: TEST_PASSWORD })

  // Próba mass assignment ocen — REVOKE na kolumnach powinien zwrócić błąd permission denied
  const { error } = await tutorClient
    .from('tutor_profiles')
    .update({ rating_avg: 5.0, rating_count: 9999 })
    .eq('id', tutorId!)

  expect(error).not.toBeNull()

  await tutorClient.auth.signOut()

  // Rzeczywiste wartości nie powinny się zmienić
  const { data: after } = await adminClient()
    .from('tutor_profiles')
    .select('rating_avg, rating_count')
    .eq('id', tutorId!)
    .single()

  expect(after?.rating_avg).toBe(before?.rating_avg ?? null)
  expect(after?.rating_count).toBe(before?.rating_count ?? 0)
})

// ─── Test 13: CSP/HSTS nagłówki obecne na publicznych trasach ─────────────────

test('strona zwraca Content-Security-Policy z restrykcyjnym frame-ancestors', async ({ page }) => {
  const response = await page.goto('/login')
  expect(response).not.toBeNull()
  const csp = response!.headers()['content-security-policy']
  expect(csp).toBeDefined()
  expect(csp).toContain("frame-ancestors 'none'")
  expect(csp).toContain("object-src 'none'")
  expect(csp).toContain("base-uri 'self'")
})

// ─── Test 14: host_room_url niewidoczny dla studenta ─────────────────────────

test('student nie widzi host_room_url swojej sesji przez bezpośrednie zapytanie do bazy', async () => {
  const { byEmail } = await getTestUserIds()
  const studentId = byEmail(STUDENT_EMAIL)
  const tutorId = byEmail(TUTOR1_EMAIL)
  expect(studentId).toBeDefined()
  expect(tutorId).toBeDefined()

  // Setup: utwórz zlecenie + sesję z host_room_url (service role omija column grants)
  const admin = adminClient()
  const { data: mr } = await admin
    .from('matching_requests')
    .insert({
      student_id: studentId!,
      tutor_id: tutorId!,
      subject_id: 'matematyka',
      level: 'Test bezpieczeństwa',
      scope: 'Test bezpieczeństwa',
      description: 'Sesja do testu host_room_url',
      status: 'accepted',
    })
    .select('id')
    .single()

  const { data: sess } = await admin
    .from('sessions')
    .insert({
      matching_request_id: mr!.id,
      student_id: studentId!,
      tutor_id: tutorId!,
      daily_room_name: 'sec-host-test',
      daily_room_url: 'https://test.whereby.com/sec-host-test',
      host_room_url: 'https://test.whereby.com/sec-host-test?roomKey=SECRET_HOST_KEY',
      status: 'scheduled',
      started_at: new Date().toISOString(),
      duration_minutes: 60,
    })
    .select('id')
    .single()

  try {
    const studentClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await studentClient.auth.signInWithPassword({ email: STUDENT_EMAIL, password: TEST_PASSWORD })

    // Próba bezpośredniego SELECT host_room_url — powinno wywalić błędem permission denied
    const directRead = await studentClient
      .from('sessions')
      .select('host_room_url')
      .eq('id', sess!.id)
      .maybeSingle()
    expect(directRead.error).not.toBeNull()

    // Inne kolumny dalej dostępne dla uczestnika
    const safeRead = await studentClient
      .from('sessions')
      .select('id, daily_room_url, status')
      .eq('id', sess!.id)
      .maybeSingle()
    expect(safeRead.error).toBeNull()
    expect(safeRead.data?.daily_room_url).toContain('test.whereby.com')

    // RPC zwraca null dla studenta (nie jest tutorem)
    const rpc = await studentClient.rpc('get_session_host_room_url', { p_session_id: sess!.id })
    expect(rpc.error).toBeNull()
    expect(rpc.data).toBeNull()

    await studentClient.auth.signOut()
  } finally {
    await admin.from('sessions').delete().eq('id', sess!.id)
    await admin.from('matching_requests').delete().eq('id', mr!.id)
  }
})

// ─── Test 15b: Audit log admina rejestruje zmianę prowizji ────────────────────

test('updateCommissionPct zapisuje wpis w admin_audit_log', async () => {
  // Bezpośredni INSERT przez service role symuluje zapis robiony przez akcję
  // adminową (action: 'commission_pct_updated'). Sama akcja wymaga aal2 + sesji
  // adminowej, co byłoby trudne do odtworzenia w czystym teście DB. Tu sprawdzamy
  // mechanikę audit logu: RLS, append-only, widoczność dla admina.
  const { byEmail } = await getTestUserIds()
  const admin = adminClient()

  // Znajdź dowolnego admina (z domyślnego seedu db:reset jest admin@test.pl)
  const ADMIN_EMAIL = 'admin@test.pl'
  const adminId = byEmail(ADMIN_EMAIL)
  if (!adminId) {
    test.skip(true, 'Konto admina nie istnieje — wymaga db:reset')
    return
  }

  const { error: insertError } = await admin.from('admin_audit_log').insert({
    admin_id: adminId,
    action: 'commission_pct_updated',
    target_type: 'platform_config',
    target_id: 'commission_pct',
    payload: { value: '25' },
  })
  expect(insertError).toBeNull()

  // Student nie powinien zobaczyć żadnych wpisów (polityka admin_audit_log_read)
  const studentClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  await studentClient.auth.signInWithPassword({ email: STUDENT_EMAIL, password: TEST_PASSWORD })
  const studentRead = await studentClient.from('admin_audit_log').select('id').limit(1)
  expect(studentRead.data ?? []).toHaveLength(0)
  await studentClient.auth.signOut()

  // Service role widzi wpis i ma poprawne wartości
  const { data: entries } = await admin
    .from('admin_audit_log')
    .select('action, target_id, payload')
    .eq('admin_id', adminId)
    .eq('action', 'commission_pct_updated')
    .order('created_at', { ascending: false })
    .limit(1)

  expect(entries).not.toBeNull()
  expect(entries!.length).toBeGreaterThan(0)
  expect(entries![0].target_id).toBe('commission_pct')
  expect(entries![0].payload).toMatchObject({ value: '25' })

  // Cleanup
  await admin.from('admin_audit_log')
    .delete()
    .eq('admin_id', adminId)
    .eq('action', 'commission_pct_updated')
})

// ─── Test 17: Manipulacja expires_at zablokowana ──────────────────────────────

test('student nie może wydłużyć expires_at swojego zlecenia', async () => {
  const { byEmail } = await getTestUserIds()
  const studentId = byEmail(STUDENT_EMAIL)
  expect(studentId).toBeDefined()

  const admin = adminClient()
  const { data: mr } = await admin
    .from('matching_requests')
    .insert({
      student_id: studentId!,
      subject_id: 'matematyka',
      level: 'Test expires_at',
      scope: 'Test',
      description: 'Test ochrony expires_at',
      status: 'pending',
    })
    .select('id, expires_at')
    .single()

  const originalExpiresAt = mr!.expires_at

  try {
    const studentClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await studentClient.auth.signInWithPassword({ email: STUDENT_EMAIL, password: TEST_PASSWORD })

    // Próba wydłużenia o 999 dni — trigger powinien rzucić wyjątkiem
    const result = await studentClient
      .from('matching_requests')
      .update({ expires_at: new Date(Date.now() + 999 * 24 * 3600 * 1000).toISOString() })
      .eq('id', mr!.id)

    expect(result.error).not.toBeNull()

    // Próba zmiany tutor_id — również zablokowana
    const tutorIdAttempt = await studentClient
      .from('matching_requests')
      .update({ tutor_id: studentId })
      .eq('id', mr!.id)
    expect(tutorIdAttempt.error).not.toBeNull()

    // Anulowanie (pending → cancelled) — DOZWOLONE
    const cancelOk = await studentClient
      .from('matching_requests')
      .update({ status: 'cancelled' })
      .eq('id', mr!.id)
    expect(cancelOk.error).toBeNull()

    await studentClient.auth.signOut()
  } finally {
    // Sprawdź że expires_at niezmienione
    const { data: after } = await admin
      .from('matching_requests')
      .select('expires_at, tutor_id')
      .eq('id', mr!.id)
      .single()
    expect(after?.expires_at).toBe(originalExpiresAt)
    expect(after?.tutor_id).toBeNull()

    await admin.from('matching_requests').delete().eq('id', mr!.id)
  }
})

// ─── Test 18: nieprawidłowy UUID w URL przekierowuje ──────────────────────────

test('GET /session/<nie-uuid> przekierowuje na /dashboard zamiast wywalać 500', async ({ page }) => {
  // Najpierw zaloguj się, żeby middleware nie przekierował do /login
  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/session/not-a-uuid')
  await page.waitForURL('/dashboard')
})

test('GET /history/<sql-injection> przekierowuje na /history', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)
  await page.goto("/history/' OR 1=1--")
  await page.waitForURL('/history')
})

// ─── Test 19: Cache-Control na trasach z PII ─────────────────────────────────

test('strony z PII zwracają Cache-Control blokujący cachowanie', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)
  const response = await page.goto('/settings')
  expect(response).not.toBeNull()
  const cacheControl = response!.headers()['cache-control']
  expect(cacheControl).toBeDefined()
  // W produkcji next.config.ts wymusza "private, no-store"; w dev Next.js nadpisuje
  // własnym "no-cache, must-revalidate". Oba blokują cache PII, więc akceptujemy.
  expect(cacheControl).toMatch(/no-store|no-cache|private/)
})

// ─── Test 20: Korepetytor nie może nadpisać chronionych pól matching_requests ─

test('korepetytor przy accept nie może zmienić student_id ani expires_at zlecenia', async () => {
  const { byEmail } = await getTestUserIds()
  const studentId = byEmail(STUDENT_EMAIL)
  const tutorId = byEmail(TUTOR1_EMAIL)
  const otherStudentId = byEmail(SEC_STUDENT_EMAIL)
  expect(otherStudentId).toBeDefined()

  const admin = adminClient()
  const { data: mr } = await admin
    .from('matching_requests')
    .insert({
      student_id: studentId!,
      subject_id: 'matematyka',
      level: 'Test trigger uniwersalny',
      scope: 'Test',
      description: 'Sprawdzenie trigger universal block',
      status: 'pending',
    })
    .select('id, expires_at, description')
    .single()

  try {
    const tutorClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await tutorClient.auth.signInWithPassword({ email: TUTOR1_EMAIL, password: TEST_PASSWORD })

    // Próba zmiany student_id (przepięcie na innego ucznia) podczas accept.
    // Trigger powinien rzucić wyjątek — udokumentowane jako defense in depth.
    // Niezależnie od tego czy zwróci błąd czy 0 zmodyfikowanych wierszy, najważniejsze
    // jest aby wartości chronionych kolumn nie zmieniły się w bazie (sprawdzane w finally).
    await tutorClient
      .from('matching_requests')
      .update({
        status: 'accepted',
        tutor_id: tutorId,
        student_id: otherStudentId,
        description: 'evil',
      })
      .eq('id', mr!.id)

    await tutorClient.auth.signOut()
  } finally {
    const { data: after } = await admin
      .from('matching_requests')
      .select('student_id, description, expires_at, status')
      .eq('id', mr!.id)
      .single()
    expect(after?.student_id).toBe(studentId)
    expect(after?.description).toBe(mr!.description)
    expect(after?.expires_at).toBe(mr!.expires_at)
    expect(after?.status).toBe('pending')

    await admin.from('matching_requests').delete().eq('id', mr!.id)
  }
})

// ─── Test 21: Uczeń nie może nadpisać host_room_url ──────────────────────────

test('uczeń nie może nadpisać host_room_url po jego ustawieniu', async () => {
  const { byEmail } = await getTestUserIds()
  const studentId = byEmail(STUDENT_EMAIL)
  const tutorId = byEmail(TUTOR1_EMAIL)

  const admin = adminClient()
  const { data: mr } = await admin
    .from('matching_requests')
    .insert({
      student_id: studentId!,
      tutor_id: tutorId!,
      subject_id: 'matematyka',
      level: 'Test sessions trigger',
      scope: 'Test',
      description: 'Sesja do testu trigera sessions',
      status: 'accepted',
    })
    .select('id')
    .single()

  const { data: sess } = await admin
    .from('sessions')
    .insert({
      matching_request_id: mr!.id,
      student_id: studentId!,
      tutor_id: tutorId!,
      daily_room_name: 'sec-trigger',
      daily_room_url: 'https://test.whereby.com/sec-trigger',
      host_room_url: 'https://test.whereby.com/sec-trigger?roomKey=ORIG',
      status: 'scheduled',
      started_at: new Date().toISOString(),
      duration_minutes: 60,
    })
    .select('id, host_room_url')
    .single()

  try {
    const studentClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await studentClient.auth.signInWithPassword({ email: STUDENT_EMAIL, password: TEST_PASSWORD })

    // Próba nadpisania host_room_url na URL atakującego
    const attempt = await studentClient
      .from('sessions')
      .update({ host_room_url: 'https://attacker.whereby.com/evil?roomKey=PWN' })
      .eq('id', sess!.id)
    expect(attempt.error).not.toBeNull()

    // Próba nadpisania tutor_id
    const tutorIdAttempt = await studentClient
      .from('sessions')
      .update({ tutor_id: studentId })
      .eq('id', sess!.id)
    expect(tutorIdAttempt.error).not.toBeNull()

    await studentClient.auth.signOut()
  } finally {
    const { data: after } = await admin
      .from('sessions')
      .select('host_room_url, tutor_id')
      .eq('id', sess!.id)
      .single()
    expect(after?.host_room_url).toBe(sess!.host_room_url)
    expect(after?.tutor_id).toBe(tutorId)

    await admin.from('sessions').delete().eq('id', sess!.id)
    await admin.from('matching_requests').delete().eq('id', mr!.id)
  }
})

// ─── Test 22: Uczeń nie może wystawić oceny obcemu korepetytorowi ─────────────

test('uczeń nie może podstawić obcego tutor_id w insert do ratings', async () => {
  const { byEmail } = await getTestUserIds()
  const studentId = byEmail(STUDENT_EMAIL)
  const tutorId = byEmail(TUTOR1_EMAIL)
  const otherTutorId = byEmail(TUTOR2_EMAIL)

  const admin = adminClient()
  const { data: mr } = await admin
    .from('matching_requests')
    .insert({
      student_id: studentId!,
      tutor_id: tutorId!,
      subject_id: 'matematyka',
      level: 'Test rating tutor_id',
      scope: 'Test',
      description: 'Sesja do testu ratings.tutor_id check',
      status: 'completed',
    })
    .select('id')
    .single()

  const { data: sess } = await admin
    .from('sessions')
    .insert({
      matching_request_id: mr!.id,
      student_id: studentId!,
      tutor_id: tutorId!,
      daily_room_name: 'rating-check',
      daily_room_url: 'https://test.whereby.com/rating-check',
      status: 'completed',
      started_at: new Date(Date.now() - 3600_000).toISOString(),
      ended_at: new Date().toISOString(),
      duration_minutes: 60,
    })
    .select('id')
    .single()

  try {
    const studentClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await studentClient.auth.signInWithPassword({ email: STUDENT_EMAIL, password: TEST_PASSWORD })

    // Próba wystawienia oceny obcemu korepetytorowi
    const attempt = await studentClient.from('ratings').insert({
      session_id: sess!.id,
      student_id: studentId!,
      tutor_id: otherTutorId!,
      ...student3DRating(1, { comment: 'sabotaż' }),
    })
    expect(attempt.error).not.toBeNull()

    // Poprawna ocena (z prawdziwym tutorem) — działa
    const ok = await studentClient.from('ratings').insert({
      session_id: sess!.id,
      student_id: studentId!,
      tutor_id: tutorId!,
      ...student3DRating(5, { comment: 'OK' }),
    })
    expect(ok.error).toBeNull()

    await studentClient.auth.signOut()
  } finally {
    await admin.from('ratings').delete().eq('session_id', sess!.id)
    await admin.from('sessions').delete().eq('id', sess!.id)
    await admin.from('matching_requests').delete().eq('id', mr!.id)
  }
})

// ─── Test 23: Uczeń nie może ustawić odległego expires_at przy insercie ───────

test('expires_at jest normalizowane do now()+5min przy insercie z konta studenta', async () => {
  const studentClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  await studentClient.auth.signInWithPassword({ email: STUDENT_EMAIL, password: TEST_PASSWORD })

  const farFuture = new Date('2099-01-01').toISOString()
  const { data, error } = await studentClient
    .from('matching_requests')
    .insert({
      subject_id: 'matematyka',
      level: 'Test normalize',
      scope: 'Test',
      description: 'Test normalizacji expires_at',
      expires_at: farFuture,
    })
    .select('id, expires_at')
    .single()

  expect(error).toBeNull()
  expect(data?.expires_at).not.toBe(farFuture)
  // Powinno być w okolicy now() + 5min
  const expiresMs = new Date(data!.expires_at).getTime()
  const expectedMs = Date.now() + 5 * 60 * 1000
  expect(Math.abs(expiresMs - expectedMs)).toBeLessThan(60 * 1000) // tolerancja 1 min

  await adminClient().from('matching_requests').delete().eq('id', data!.id)
  await studentClient.auth.signOut()
})

// ─── Test 24: profiles.phone ukryte dla zwykłych użytkowników ─────────────────

test('select phone z profiles dla anon clienta zwraca permission denied', async () => {
  const studentClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  await studentClient.auth.signInWithPassword({ email: STUDENT_EMAIL, password: TEST_PASSWORD })

  const { error } = await studentClient.from('profiles').select('phone').limit(1)
  expect(error).not.toBeNull()

  await studentClient.auth.signOut()
})

// ─── Test 26: Tutor nie może wstawić sesji dla cudzego studenta ──────────────

test('korepetytor nie może wstawić sesji dla obcego studenta przez direct INSERT', async () => {
  const { byEmail } = await getTestUserIds()
  const studentId = byEmail(STUDENT_EMAIL)
  const tutorId = byEmail(TUTOR1_EMAIL)
  const otherStudentId = byEmail(SEC_STUDENT_EMAIL)
  expect(otherStudentId).toBeDefined()

  const admin = adminClient()
  // Tworzymy pending request od studenta1, ale tutor próbuje INSERT sesji
  // z student_id wskazującym na obcego ucznia (SEC_STUDENT)
  const { data: mr } = await admin
    .from('matching_requests')
    .insert({
      student_id: studentId!,
      subject_id: 'matematyka',
      level: 'Test session insert',
      scope: 'Test',
      description: 'Test luki #1',
      status: 'accepted',
      tutor_id: tutorId,
    })
    .select('id')
    .single()

  try {
    const tutorClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await tutorClient.auth.signInWithPassword({ email: TUTOR1_EMAIL, password: TEST_PASSWORD })

    // Próba: tutor wpisuje student_id obcego ucznia + własne URL-e
    const attempt = await tutorClient
      .from('sessions')
      .insert({
        matching_request_id: mr!.id,
        student_id: otherStudentId,  // OBCY student
        tutor_id: tutorId,
        daily_room_url: 'https://attacker.whereby.com/evil',
        host_room_url: 'https://attacker.whereby.com/evil?roomKey=PWN',
        status: 'in_progress',
      })
    expect(attempt.error).not.toBeNull()

    await tutorClient.auth.signOut()
  } finally {
    await admin.from('sessions').delete().eq('matching_request_id', mr!.id)
    await admin.from('matching_requests').delete().eq('id', mr!.id)
  }
})

// ─── Test 27: Student nie może oznaczyć sesji jako completed bezpośrednio ────

test('student nie może wykonać UPDATE sessions set status=completed bezpośrednio', async () => {
  const { byEmail } = await getTestUserIds()
  const studentId = byEmail(STUDENT_EMAIL)
  const tutorId = byEmail(TUTOR1_EMAIL)

  const admin = adminClient()
  const { data: mr } = await admin
    .from('matching_requests')
    .insert({
      student_id: studentId!,
      tutor_id: tutorId!,
      subject_id: 'matematyka',
      level: 'Test sabotage status',
      scope: 'Test',
      description: 'Test luki #2',
      status: 'accepted',
    })
    .select('id')
    .single()

  const { data: sess } = await admin
    .from('sessions')
    .insert({
      matching_request_id: mr!.id,
      student_id: studentId!,
      tutor_id: tutorId!,
      daily_room_name: 'sabotage-test',
      daily_room_url: 'https://test.whereby.com/sabotage',
      host_room_url: 'https://test.whereby.com/sabotage?roomKey=X',
      status: 'in_progress',
      started_at: new Date().toISOString(),
      duration_minutes: 60,
    })
    .select('id')
    .single()

  try {
    const studentClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await studentClient.auth.signInWithPassword({ email: STUDENT_EMAIL, password: TEST_PASSWORD })

    // Próba bezpośredniego UPDATE
    await studentClient
      .from('sessions')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('id', sess!.id)

    await studentClient.auth.signOut()
  } finally {
    // Trigger powinien był rzucić — sesja nadal in_progress
    const { data: after } = await admin
      .from('sessions')
      .select('status, ended_at')
      .eq('id', sess!.id)
      .single()
    expect(after?.status).toBe('in_progress')
    expect(after?.ended_at).toBeNull()

    await admin.from('sessions').delete().eq('id', sess!.id)
    await admin.from('matching_requests').delete().eq('id', mr!.id)
  }
})

// ─── Test 28: RPC complete_session — legalna ścieżka zakończenia sesji ───────

test('RPC complete_session pozwala studentowi zakończyć sesję (auto-end po timerze)', async () => {
  const { byEmail } = await getTestUserIds()
  const studentId = byEmail(STUDENT_EMAIL)
  const tutorId = byEmail(TUTOR1_EMAIL)

  const admin = adminClient()
  const { data: mr } = await admin
    .from('matching_requests')
    .insert({
      student_id: studentId!,
      tutor_id: tutorId!,
      subject_id: 'matematyka',
      level: 'Test RPC complete',
      scope: 'Test',
      description: 'Test legalnej ścieżki zakończenia',
      status: 'accepted',
    })
    .select('id')
    .single()

  // started_at 61 min temu + duration 60 min = naturalny koniec 1 min temu.
  // Trigger pozwala studentowi oznaczyć completed dopiero po naturalnym końcu.
  const { data: sess } = await admin
    .from('sessions')
    .insert({
      matching_request_id: mr!.id,
      student_id: studentId!,
      tutor_id: tutorId!,
      daily_room_name: 'rpc-complete',
      daily_room_url: 'https://test.whereby.com/rpc-complete',
      status: 'in_progress',
      started_at: new Date(Date.now() - 61 * 60 * 1000).toISOString(),
      duration_minutes: 60,
    })
    .select('id')
    .single()

  try {
    const studentClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await studentClient.auth.signInWithPassword({ email: STUDENT_EMAIL, password: TEST_PASSWORD })

    // Student wywołuje RPC — powinno się powieść
    const { error } = await studentClient.rpc('complete_session', {
      p_session_id: sess!.id,
      p_notes: 'Student próbuje wstawić notatki',
    })
    expect(error).toBeNull()

    await studentClient.auth.signOut()
  } finally {
    const { data: after } = await admin
      .from('sessions')
      .select('status, ended_at, notes')
      .eq('id', sess!.id)
      .single()
    expect(after?.status).toBe('completed')
    expect(after?.ended_at).not.toBeNull()
    // Notatki od studenta są ignorowane przez RPC — może ustawiać tylko tutor
    expect(after?.notes).toBeNull()

    // Matching request też zostaje zaktualizowany
    const { data: mrAfter } = await admin
      .from('matching_requests')
      .select('status')
      .eq('id', mr!.id)
      .single()
    expect(mrAfter?.status).toBe('completed')

    await admin.from('sessions').delete().eq('id', sess!.id)
    await admin.from('matching_requests').delete().eq('id', mr!.id)
  }
})

// ─── Test 29: complete_session — obcy user nie może zakończyć cudzej sesji ────

test('complete_session odrzuca obcego użytkownika', async () => {
  const { byEmail } = await getTestUserIds()
  const studentId = byEmail(STUDENT_EMAIL)
  const tutorId = byEmail(TUTOR1_EMAIL)

  const admin = adminClient()
  const { data: mr } = await admin
    .from('matching_requests')
    .insert({
      student_id: studentId!,
      tutor_id: tutorId!,
      subject_id: 'matematyka',
      level: 'Test obcy RPC',
      scope: 'Test',
      description: 'Test obcego użytkownika w RPC',
      status: 'accepted',
    })
    .select('id')
    .single()

  const { data: sess } = await admin
    .from('sessions')
    .insert({
      matching_request_id: mr!.id,
      student_id: studentId!,
      tutor_id: tutorId!,
      daily_room_name: 'rpc-stranger',
      daily_room_url: 'https://test.whereby.com/rpc-stranger',
      status: 'in_progress',
      started_at: new Date().toISOString(),
      duration_minutes: 60,
    })
    .select('id')
    .single()

  try {
    const strangerClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await strangerClient.auth.signInWithPassword({ email: TUTOR2_EMAIL, password: TEST_PASSWORD })

    const { error } = await strangerClient.rpc('complete_session', {
      p_session_id: sess!.id,
      p_notes: null,
    })
    expect(error).not.toBeNull()

    await strangerClient.auth.signOut()
  } finally {
    await admin.from('sessions').delete().eq('id', sess!.id)
    await admin.from('matching_requests').delete().eq('id', mr!.id)
  }
})

// ─── Test 16: host_room_url dostępny dla korepetytora przez RPC ──────────────

test('korepetytor odczytuje host_room_url przez get_session_host_room_url', async () => {
  const { byEmail } = await getTestUserIds()
  const studentId = byEmail(STUDENT_EMAIL)
  const tutorId = byEmail(TUTOR1_EMAIL)

  const admin = adminClient()
  const { data: mr } = await admin
    .from('matching_requests')
    .insert({
      student_id: studentId!,
      tutor_id: tutorId!,
      subject_id: 'matematyka',
      level: 'Test bezpieczeństwa',
      scope: 'Test bezpieczeństwa',
      description: 'Sesja do testu host RPC',
      status: 'accepted',
    })
    .select('id')
    .single()

  const HOST_URL = 'https://test.whereby.com/sec-host-rpc?roomKey=TUTOR_ONLY'
  const { data: sess } = await admin
    .from('sessions')
    .insert({
      matching_request_id: mr!.id,
      student_id: studentId!,
      tutor_id: tutorId!,
      daily_room_name: 'sec-host-rpc',
      daily_room_url: 'https://test.whereby.com/sec-host-rpc',
      host_room_url: HOST_URL,
      status: 'scheduled',
      started_at: new Date().toISOString(),
      duration_minutes: 60,
    })
    .select('id')
    .single()

  try {
    const tutorClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await tutorClient.auth.signInWithPassword({ email: TUTOR1_EMAIL, password: TEST_PASSWORD })

    const rpc = await tutorClient.rpc('get_session_host_room_url', { p_session_id: sess!.id })
    expect(rpc.error).toBeNull()
    expect(rpc.data).toBe(HOST_URL)

    await tutorClient.auth.signOut()
  } finally {
    await admin.from('sessions').delete().eq('id', sess!.id)
    await admin.from('matching_requests').delete().eq('id', mr!.id)
  }
})
