import { test, expect } from '@playwright/test'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { adminClient, TEST_PASSWORD, STUDENT_EMAIL, TUTOR1_EMAIL, TUTOR2_EMAIL } from './global-setup'
import { loginAs, getTestUserIds } from './helpers'

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

// ─── Test 15: host_room_url dostępny dla korepetytora przez RPC ──────────────

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
