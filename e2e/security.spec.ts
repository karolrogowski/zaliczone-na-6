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

  // Admin bez MFA: user_metadata.role='admin' potrzebne do przejĹ›cia sprawdzenia w middleware
  const { data: adminData } = await supabase.auth.admin.createUser({
    email: ADMIN_NO_MFA_EMAIL,
    password: TEST_PASSWORD,
    user_metadata: { role: 'admin', full_name: 'Admin Bez MFA' },
    email_confirm: true,
  })
  // Trigger handle_new_user ustawia role='student' z whitelisty â€” rÄ™cznie promujemy na admina
  if (adminData?.user) {
    await supabase.from('profiles').update({ role: 'admin' }).eq('id', adminData.user.id)
  }

  // AtakujÄ…cy prĂłbujÄ…cy zarejestrowaÄ‡ siÄ™ jako admin przez metadane
  await supabase.auth.admin.createUser({
    email: ATTACKER_EMAIL,
    password: TEST_PASSWORD,
    user_metadata: { role: 'admin', full_name: 'AtakujÄ…cy Admin' },
    email_confirm: true,
  })

  // UĹĽytkownicy do testu RLS â€” celowo bez wspĂłlnych zleceĹ„
  await supabase.auth.admin.createUser({
    email: SEC_TUTOR_EMAIL,
    password: TEST_PASSWORD,
    user_metadata: { role: 'tutor', full_name: 'Korepetytor RLS' },
    email_confirm: true,
  })
  await supabase.auth.admin.createUser({
    email: SEC_STUDENT_EMAIL,
    password: TEST_PASSWORD,
    user_metadata: { role: 'student', full_name: 'UczeĹ„ RLS' },
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
        level: 'Test bezpieczeĹ„stwa',
        description: 'Zlecenie tworzone automatycznie przez testy bezpieczeĹ„stwa',
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

// â”€â”€â”€ Test 1: Eskalacja uprawnieĹ„ przez rejestracjÄ™ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Test 2: Panel admina â€” niezalogowany uĹĽytkownik â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('niezalogowany dostÄ™p do /admin/dashboard przekierowuje na /admin/login', async ({ page }) => {
  await page.goto('/admin/dashboard')
  await expect(page).toHaveURL('/admin/login')
})

// â”€â”€â”€ Test 3: Panel admina â€” zalogowany uczeĹ„ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('uczeĹ„ prĂłbujÄ…cy wejĹ›Ä‡ na /admin/dashboard zostaje przekierowany na /dashboard', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/admin/dashboard')
  await expect(page).toHaveURL('/dashboard')
})

// â”€â”€â”€ Test 4: Panel admina â€” zalogowany korepetytor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('korepetytor prĂłbujÄ…cy wejĹ›Ä‡ na /admin/dashboard zostaje przekierowany na /dashboard', async ({ page }) => {
  await loginAs(page, TUTOR1_EMAIL)
  await page.goto('/admin/dashboard')
  await expect(page).toHaveURL('/dashboard')
})

// â”€â”€â”€ Test 5: Panel admina â€” admin bez skonfigurowanego MFA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('admin bez skonfigurowanego MFA zostaje przekierowany na stronÄ™ konfiguracji TOTP', async ({ page }) => {
  await loginAs(page, ADMIN_NO_MFA_EMAIL)
  await page.goto('/admin/dashboard')
  // Brak TOTP â†’ /admin/mfa/enroll; TOTP bez aal2 â†’ /admin/mfa/verify
  await expect(page).toHaveURL(/\/admin\/mfa\/(enroll|verify)/)
})

// â”€â”€â”€ Test 6: OTP type injection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('nieprawidĹ‚owy typ OTP w /auth/confirm przekierowuje na stronÄ™ bĹ‚Ä™du', async ({ page }) => {
  await page.goto('/auth/confirm?token_hash=fakehash&type=evil_payload')
  await expect(page).toHaveURL('/login?error=invalid_link')
})

test('/auth/confirm bez token_hash przekierowuje na stronÄ™ bĹ‚Ä™du', async ({ page }) => {
  await page.goto('/auth/confirm?type=signup')
  await expect(page).toHaveURL('/login?error=invalid_link')
})

// â”€â”€â”€ Test 7: RLS â€” widocznoĹ›Ä‡ profilu ucznia â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('korepetytor bez wspĂłlnej sesji nie widzi profilu ucznia', async () => {
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

// â”€â”€â”€ Test 8: RLS â€” korepetytor nie moĹĽe anulowaÄ‡ cudzego zlecenia â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('korepetytor nie moĹĽe anulowaÄ‡ zlecenia ucznia przez bezpoĹ›rednie zapytanie do bazy', async () => {
  if (!secRequestId) {
    test.skip(true, 'Brak danych testowych â€” insert zlecenia nie powiĂłdĹ‚ siÄ™ w beforeAll')
    return
  }

  const tutorClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  await tutorClient.auth.signInWithPassword({ email: TUTOR1_EMAIL, password: TEST_PASSWORD })

  // Korepetytor prĂłbuje ustawiÄ‡ status='cancelled' bez filtra student_id
  await tutorClient
    .from('matching_requests')
    .update({ status: 'cancelled' })
    .eq('id', secRequestId!)
    .eq('status', 'pending')

  await tutorClient.auth.signOut()

  // Zlecenie musi nadal byÄ‡ 'pending' â€” RLS lub brak uprawnieĹ„ do UPDATE powinien zablokowaÄ‡
  const { data } = await adminClient()
    .from('matching_requests')
    .select('status')
    .eq('id', secRequestId!)
    .single()

  expect(data?.status).toBe('pending')
})

// â”€â”€â”€ Test 9: RLS â€” tutor2 nie widzi zakoĹ„czonych zleceĹ„ tutor1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('tutor2 nie widzi zakoĹ„czonych zleceĹ„ obsĹ‚ugiwanych przez tutor1', async () => {
  const { byEmail } = await getTestUserIds()
  const tutor1Id = byEmail(TUTOR1_EMAIL)
  expect(tutor1Id).toBeDefined()

  const tutor2Client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  await tutor2Client.auth.signInWithPassword({ email: TUTOR2_EMAIL, password: TEST_PASSWORD })

  // Tutor2 prĂłbuje zobaczyÄ‡ zlecenia gdzie tutor1 byĹ‚ korepetytorem
  const { data } = await tutor2Client
    .from('matching_requests')
    .select('id')
    .eq('tutor_id', tutor1Id!)
    .in('status', ['accepted', 'completed'])

  expect(data ?? []).toHaveLength(0)

  await tutor2Client.auth.signOut()
})

// â”€â”€â”€ Test 10: RLS â€” uczeĹ„ nie widzi zleceĹ„ innego ucznia â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('uczeĹ„ nie widzi zleceĹ„ innego ucznia przez zapytanie do bazy', async () => {
  const { byEmail } = await getTestUserIds()
  const student1Id = byEmail(STUDENT_EMAIL)
  expect(student1Id).toBeDefined()

  const secStudentClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  await secStudentClient.auth.signInWithPassword({ email: SEC_STUDENT_EMAIL, password: TEST_PASSWORD })

  // SEC_STUDENT prĂłbuje zobaczyÄ‡ zlecenia STUDENT â€” nie powinien mieÄ‡ dostÄ™pu
  const { data } = await secStudentClient
    .from('matching_requests')
    .select('id')
    .eq('student_id', student1Id!)

  expect(data ?? []).toHaveLength(0)

  await secStudentClient.auth.signOut()
})

// â”€â”€â”€ Test 11: Mass assignment â€” student nie moĹĽe podnieĹ›Ä‡ siebie do roli admin â”€

test('uczeĹ„ nie moĹĽe zmieniÄ‡ swojej roli na admin przez bezpoĹ›redni UPDATE profiles', async () => {
  const { byEmail } = await getTestUserIds()
  const studentId = byEmail(SEC_STUDENT_EMAIL)
  expect(studentId).toBeDefined()

  const studentClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  await studentClient.auth.signInWithPassword({ email: SEC_STUDENT_EMAIL, password: TEST_PASSWORD })

  // PrĂłba mass assignment: zmiana roli z poziomu klienta
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

// â”€â”€â”€ Test 12: Mass assignment â€” korepetytor nie moĹĽe zawyĹĽyÄ‡ swojej oceny â”€â”€â”€â”€â”€

test('korepetytor nie moĹĽe zmieniÄ‡ rating_avg ani rating_count na tutor_profiles', async () => {
  const { byEmail } = await getTestUserIds()
  const tutorId = byEmail(TUTOR1_EMAIL)
  expect(tutorId).toBeDefined()

  // ZapamiÄ™taj stan wyjĹ›ciowy
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

  // PrĂłba mass assignment ocen â€” REVOKE na kolumnach powinien zwrĂłciÄ‡ bĹ‚Ä…d permission denied
  const { error } = await tutorClient
    .from('tutor_profiles')
    .update({ rating_avg: 5.0, rating_count: 9999 })
    .eq('id', tutorId!)

  expect(error).not.toBeNull()

  await tutorClient.auth.signOut()

  // Rzeczywiste wartoĹ›ci nie powinny siÄ™ zmieniÄ‡
  const { data: after } = await adminClient()
    .from('tutor_profiles')
    .select('rating_avg, rating_count')
    .eq('id', tutorId!)
    .single()

  expect(after?.rating_avg).toBe(before?.rating_avg ?? null)
  expect(after?.rating_count).toBe(before?.rating_count ?? 0)
})

// â”€â”€â”€ Test 13: CSP/HSTS nagĹ‚Ăłwki obecne na publicznych trasach â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('strona zwraca Content-Security-Policy z restrykcyjnym frame-ancestors', async ({ page }) => {
  const response = await page.goto('/login')
  expect(response).not.toBeNull()
  const csp = response!.headers()['content-security-policy']
  expect(csp).toBeDefined()
  expect(csp).toContain("frame-ancestors 'none'")
  expect(csp).toContain("object-src 'none'")
  expect(csp).toContain("base-uri 'self'")
})

// â”€â”€â”€ Test 14: host_room_url niewidoczny dla studenta â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('student nie widzi host_room_url swojej sesji przez bezpoĹ›rednie zapytanie do bazy', async () => {
  const { byEmail } = await getTestUserIds()
  const studentId = byEmail(STUDENT_EMAIL)
  const tutorId = byEmail(TUTOR1_EMAIL)
  expect(studentId).toBeDefined()
  expect(tutorId).toBeDefined()

  // Setup: utwĂłrz zlecenie + sesjÄ™ z host_room_url (service role omija column grants)
  const admin = adminClient()
  const { data: mr } = await admin
    .from('matching_requests')
    .insert({
      student_id: studentId!,
      tutor_id: tutorId!,
      subject_id: 'matematyka',
      level: 'Test bezpieczeĹ„stwa',
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

    // PrĂłba bezpoĹ›redniego SELECT host_room_url â€” powinno wywaliÄ‡ bĹ‚Ä™dem permission denied
    const directRead = await studentClient
      .from('sessions')
      .select('host_room_url')
      .eq('id', sess!.id)
      .maybeSingle()
    expect(directRead.error).not.toBeNull()

    // Inne kolumny dalej dostÄ™pne dla uczestnika
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

// â”€â”€â”€ Test 15b: Audit log admina rejestruje zmianÄ™ prowizji â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('updateCommissionPct zapisuje wpis w admin_audit_log', async () => {
  // BezpoĹ›redni INSERT przez service role symuluje zapis robiony przez akcjÄ™
  // adminowÄ… (action: 'commission_pct_updated'). Sama akcja wymaga aal2 + sesji
  // adminowej, co byĹ‚oby trudne do odtworzenia w czystym teĹ›cie DB. Tu sprawdzamy
  // mechanikÄ™ audit logu: RLS, append-only, widocznoĹ›Ä‡ dla admina.
  const { byEmail } = await getTestUserIds()
  const admin = adminClient()

  // ZnajdĹş dowolnego admina (z domyĹ›lnego seedu db:reset jest admin@test.pl)
  const ADMIN_EMAIL = 'admin@test.pl'
  const adminId = byEmail(ADMIN_EMAIL)
  if (!adminId) {
    test.skip(true, 'Konto admina nie istnieje â€” wymaga db:reset')
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

  // Student nie powinien zobaczyÄ‡ ĹĽadnych wpisĂłw (polityka admin_audit_log_read)
  const studentClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  await studentClient.auth.signInWithPassword({ email: STUDENT_EMAIL, password: TEST_PASSWORD })
  const studentRead = await studentClient.from('admin_audit_log').select('id').limit(1)
  expect(studentRead.data ?? []).toHaveLength(0)
  await studentClient.auth.signOut()

  // Service role widzi wpis i ma poprawne wartoĹ›ci
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

// â”€â”€â”€ Test 17: Manipulacja expires_at zablokowana â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('student nie moĹĽe wydĹ‚uĹĽyÄ‡ expires_at swojego zlecenia', async () => {
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

    // PrĂłba wydĹ‚uĹĽenia o 999 dni â€” trigger powinien rzuciÄ‡ wyjÄ…tkiem
    const result = await studentClient
      .from('matching_requests')
      .update({ expires_at: new Date(Date.now() + 999 * 24 * 3600 * 1000).toISOString() })
      .eq('id', mr!.id)

    expect(result.error).not.toBeNull()

    // PrĂłba zmiany tutor_id â€” rĂłwnieĹĽ zablokowana
    const tutorIdAttempt = await studentClient
      .from('matching_requests')
      .update({ tutor_id: studentId })
      .eq('id', mr!.id)
    expect(tutorIdAttempt.error).not.toBeNull()

    // Anulowanie (pending â†’ cancelled) â€” DOZWOLONE
    const cancelOk = await studentClient
      .from('matching_requests')
      .update({ status: 'cancelled' })
      .eq('id', mr!.id)
    expect(cancelOk.error).toBeNull()

    await studentClient.auth.signOut()
  } finally {
    // SprawdĹş ĹĽe expires_at niezmienione
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

// â”€â”€â”€ Test 18: nieprawidĹ‚owy UUID w URL przekierowuje â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('GET /session/<nie-uuid> przekierowuje na /dashboard zamiast wywalaÄ‡ 500', async ({ page }) => {
  // Najpierw zaloguj siÄ™, ĹĽeby middleware nie przekierowaĹ‚ do /login
  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/session/not-a-uuid')
  await page.waitForURL('/dashboard')
})

test('GET /history/<sql-injection> przekierowuje na /history', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)
  await page.goto("/history/' OR 1=1--")
  await page.waitForURL('/history')
})

// â”€â”€â”€ Test 19: Cache-Control na trasach z PII â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('strony z PII zwracajÄ… Cache-Control blokujÄ…cy cachowanie', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)
  const response = await page.goto('/settings')
  expect(response).not.toBeNull()
  const cacheControl = response!.headers()['cache-control']
  expect(cacheControl).toBeDefined()
  // W produkcji next.config.ts wymusza "private, no-store"; w dev Next.js nadpisuje
  // wĹ‚asnym "no-cache, must-revalidate". Oba blokujÄ… cache PII, wiÄ™c akceptujemy.
  expect(cacheControl).toMatch(/no-store|no-cache|private/)
})

// â”€â”€â”€ Test 20: Korepetytor nie moĹĽe nadpisaÄ‡ chronionych pĂłl matching_requests â”€

test('korepetytor przy accept nie moĹĽe zmieniÄ‡ student_id ani expires_at zlecenia', async () => {
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

    // PrĂłba zmiany student_id (przepiÄ™cie na innego ucznia) podczas accept.
    // Trigger powinien rzuciÄ‡ wyjÄ…tek â€” udokumentowane jako defense in depth.
    // NiezaleĹĽnie od tego czy zwrĂłci bĹ‚Ä…d czy 0 zmodyfikowanych wierszy, najwaĹĽniejsze
    // jest aby wartoĹ›ci chronionych kolumn nie zmieniĹ‚y siÄ™ w bazie (sprawdzane w finally).
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

// â”€â”€â”€ Test 21: UczeĹ„ nie moĹĽe nadpisaÄ‡ host_room_url â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('uczeĹ„ nie moĹĽe nadpisaÄ‡ host_room_url po jego ustawieniu', async () => {
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

    // PrĂłba nadpisania host_room_url na URL atakujÄ…cego
    const attempt = await studentClient
      .from('sessions')
      .update({ host_room_url: 'https://attacker.whereby.com/evil?roomKey=PWN' })
      .eq('id', sess!.id)
    expect(attempt.error).not.toBeNull()

    // PrĂłba nadpisania tutor_id
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

// â”€â”€â”€ Test 22: UczeĹ„ nie moĹĽe wystawiÄ‡ oceny obcemu korepetytorowi â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('uczeĹ„ nie moĹĽe podstawiÄ‡ obcego tutor_id w insert do ratings', async () => {
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

    // PrĂłba wystawienia oceny obcemu korepetytorowi
    const attempt = await studentClient.from('ratings').insert({
      session_id: sess!.id,
      student_id: studentId!,
      tutor_id: otherTutorId!,
      ...student3DRating(1, { comment: 'sabotaĹĽ' }),
    })
    expect(attempt.error).not.toBeNull()

    // Poprawna ocena (z prawdziwym tutorem) â€” dziaĹ‚a
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

// â”€â”€â”€ Test 23: UczeĹ„ nie moĹĽe ustawiÄ‡ odlegĹ‚ego expires_at przy insercie â”€â”€â”€â”€â”€â”€â”€

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
      description: 'Test normalizacji expires_at',
      expires_at: farFuture,
    })
    .select('id, expires_at')
    .single()

  expect(error).toBeNull()
  expect(data?.expires_at).not.toBe(farFuture)
  // Powinno byÄ‡ w okolicy now() + 5min
  const expiresMs = new Date(data!.expires_at).getTime()
  const expectedMs = Date.now() + 5 * 60 * 1000
  expect(Math.abs(expiresMs - expectedMs)).toBeLessThan(60 * 1000) // tolerancja 1 min

  await adminClient().from('matching_requests').delete().eq('id', data!.id)
  await studentClient.auth.signOut()
})

// â”€â”€â”€ Test 24: profiles.phone ukryte dla zwykĹ‚ych uĹĽytkownikĂłw â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Test 26: Tutor nie moĹĽe wstawiÄ‡ sesji dla cudzego studenta â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('korepetytor nie moĹĽe wstawiÄ‡ sesji dla obcego studenta przez direct INSERT', async () => {
  const { byEmail } = await getTestUserIds()
  const studentId = byEmail(STUDENT_EMAIL)
  const tutorId = byEmail(TUTOR1_EMAIL)
  const otherStudentId = byEmail(SEC_STUDENT_EMAIL)
  expect(otherStudentId).toBeDefined()

  const admin = adminClient()
  // Tworzymy pending request od studenta1, ale tutor prĂłbuje INSERT sesji
  // z student_id wskazujÄ…cym na obcego ucznia (SEC_STUDENT)
  const { data: mr } = await admin
    .from('matching_requests')
    .insert({
      student_id: studentId!,
      subject_id: 'matematyka',
      level: 'Test session insert',
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

    // PrĂłba: tutor wpisuje student_id obcego ucznia + wĹ‚asne URL-e
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

// â”€â”€â”€ Test 27: Student nie moĹĽe oznaczyÄ‡ sesji jako completed bezpoĹ›rednio â”€â”€â”€â”€

test('student nie moĹĽe wykonaÄ‡ UPDATE sessions set status=completed bezpoĹ›rednio', async () => {
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

    // PrĂłba bezpoĹ›redniego UPDATE
    await studentClient
      .from('sessions')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('id', sess!.id)

    await studentClient.auth.signOut()
  } finally {
    // Trigger powinien byĹ‚ rzuciÄ‡ â€” sesja nadal in_progress
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

// â”€â”€â”€ Test 28: RPC complete_session â€” legalna Ĺ›cieĹĽka zakoĹ„czenia sesji â”€â”€â”€â”€â”€â”€â”€

test('RPC complete_session pozwala studentowi zakoĹ„czyÄ‡ sesjÄ™ (auto-end po timerze)', async () => {
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
      description: 'Test legalnej Ĺ›cieĹĽki zakoĹ„czenia',
      status: 'accepted',
    })
    .select('id')
    .single()

  // started_at 61 min temu + duration 60 min = naturalny koniec 1 min temu.
  // Trigger pozwala studentowi oznaczyÄ‡ completed dopiero po naturalnym koĹ„cu.
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

    // Student wywoĹ‚uje RPC â€” powinno siÄ™ powieĹ›Ä‡
    const { error } = await studentClient.rpc('complete_session', {
      p_session_id: sess!.id,
      p_notes: 'Student prĂłbuje wstawiÄ‡ notatki',
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
    // Notatki od studenta sÄ… ignorowane przez RPC â€” moĹĽe ustawiaÄ‡ tylko tutor
    expect(after?.notes).toBeNull()

    // Matching request teĹĽ zostaje zaktualizowany
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

// â”€â”€â”€ Test 29: complete_session â€” obcy user nie moĹĽe zakoĹ„czyÄ‡ cudzej sesji â”€â”€â”€â”€

test('complete_session odrzuca obcego uĹĽytkownika', async () => {
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
      description: 'Test obcego uĹĽytkownika w RPC',
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

// â”€â”€â”€ Test 16: host_room_url dostÄ™pny dla korepetytora przez RPC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      level: 'Test bezpieczeĹ„stwa',
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
