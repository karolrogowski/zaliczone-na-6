/**
 * seed-demo.mjs — odtwarzalne dane demonstracyjne na cloud Supabase
 *
 * Tworzy 3 użytkowników demo z realistyczną historią sesji, ocen i preferencji.
 * Skrypt jest idempotentny: najpierw usuwa stare dane demo, potem tworzy nowe.
 *
 * Użycie:
 *   npm run seed:demo                # czyta klucze z .env.local (lokalny dev)
 *   npm run seed:demo -- --prod      # jak wyżej, ale bez ostrzeżenia (tryb prod)
 *
 * Wymagane zmienne środowiskowe (.env.local lub shell):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// ─── Wczytaj .env.local ──────────────────────────────────────────────────────
try {
  const env = readFileSync('.env.local', 'utf8')
  for (const line of env.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && !key.startsWith('#') && key.trim()) {
      process.env[key.trim()] ??= rest.join('=').trim()
    }
  }
} catch {
  // .env.local nie istnieje — zakładamy że zmienne są w środowisku
}

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env
if (!url || !key) {
  console.error('❌ Brakuje NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const db = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Konfiguracja demo ───────────────────────────────────────────────────────
const DEMO_PASSWORD = 'Demo2024!'

const STUDENT = { email: 'demo-uczen@zaliczone.pl',        role: 'student', fullName: 'Piotr Wiśniewski' }
const TUTOR1  = { email: 'demo-korepetytor@zaliczone.pl',  role: 'tutor',   fullName: 'Anna Kowalska'   }
const TUTOR2  = { email: 'demo-korepetytor2@zaliczone.pl', role: 'tutor',   fullName: 'Marek Nowak'     }

// ─── Pomocniki ───────────────────────────────────────────────────────────────

/** Zwraca timestampy sesji kończącej się `days` dni temu, trwającej `duration` minut */
function ago(days, duration = 30) {
  const ended   = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const started = new Date(ended.getTime() - duration * 60 * 1000)
  return { started_at: started.toISOString(), ended_at: ended.toISOString() }
}

/** Unikalna nazwa pokoju dla sesji demo */
function roomName(label) {
  return `demo-${label}-${Math.random().toString(36).slice(2, 7)}`
}

/** Tworzy lub aktualizuje użytkownika auth, zwraca jego ID */
async function ensureUser({ email, role, fullName }) {
  // Próba utworzenia
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    user_metadata: { role, full_name: fullName },
    email_confirm: true,
  })
  if (!error) return created.user

  // Użytkownik już istnieje — znajdź przez listę
  if (error.message?.includes('already registered') || error.status === 422) {
    const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 })
    const existing = list?.users?.find(u => u.email === email)
    if (existing) {
      // Odśwież hasło i metadane
      await db.auth.admin.updateUserById(existing.id, {
        password: DEMO_PASSWORD,
        user_metadata: { role, full_name: fullName },
      })
      return existing
    }
  }

  throw new Error(`Nie można uzyskać użytkownika ${email}: ${error.message}`)
}

// ─── Czyszczenie starych danych demo ─────────────────────────────────────────
async function cleanupDemo(ids) {
  if (!ids.length) return

  // Znajdź sesje należące do demo-użytkowników
  const { data: sessions } = await db
    .from('sessions')
    .select('id')
    .or(ids.map(id => `student_id.eq.${id}`).join(',') + ',' + ids.map(id => `tutor_id.eq.${id}`).join(','))

  if (sessions?.length) {
    const sids = sessions.map(s => s.id)
    await db.from('ratings').delete().in('session_id', sids)
    await db.from('session_financials').delete().in('session_id', sids)
    await db.from('sessions').delete().in('id', sids)
  }

  for (const id of ids) {
    await db.from('matching_requests').delete()
      .or(`student_id.eq.${id},tutor_id.eq.${id}`)
    await db.from('tutor_subjects').delete().eq('tutor_id', id)
    await db.from('tutor_profiles').delete().eq('id', id)
  }
}

// ─── Tworzenie jednej sesji z ocenami ─────────────────────────────────────────
async function createSession({
  studentId, tutorId, subject, description,
  daysAgo: days, duration,
  notes,
  studentScore, studentComment, studentPreference,
  tutorScore, tutorComment, tutorFlagged,
}) {
  const room = roomName(subject)
  const times = ago(days, duration)

  // 1. matching_request
  const { data: req, error: reqErr } = await db
    .from('matching_requests')
    .insert({
      student_id: studentId,
      tutor_id:   tutorId,
      subject_id: subject,
      status:     'completed',
      description,
    })
    .select('id')
    .single()

  if (reqErr) throw new Error(`matching_request (${subject}): ${reqErr.message}`)

  // 2. session — serwisowy klient omija trigger sessions_normalize_insert (auth.uid() is null)
  const { data: session, error: sessErr } = await db
    .from('sessions')
    .insert({
      matching_request_id: req.id,
      student_id:          studentId,
      tutor_id:            tutorId,
      daily_room_name:     room,
      daily_room_url:      `https://demo.daily.co/${room}`,
      host_room_url:       `https://demo.daily.co/${room}?t=demo_host`,
      status:              'completed',
      notes,
      duration_minutes:    duration,
      ...times,
    })
    .select('id')
    .single()

  if (sessErr) throw new Error(`session (${subject}): ${sessErr.message}`)

  // 3. Ocena ucznia
  const { error: rStudErr } = await db.from('ratings').insert({
    session_id: session.id,
    student_id: studentId,
    tutor_id:   tutorId,
    score:      studentScore,
    comment:    studentComment ?? null,
    rated_by:   'student',
    preference: studentPreference ?? null,
  })
  if (rStudErr) throw new Error(`rating student (${subject}): ${rStudErr.message}`)

  // 4. Ocena korepetytora
  const { error: rTutErr } = await db.from('ratings').insert({
    session_id:       session.id,
    student_id:       studentId,
    tutor_id:         tutorId,
    score:            tutorScore,
    comment:          tutorComment ?? null,
    rated_by:         'tutor',
    tutor_preference: tutorFlagged ? 'flag' : null,
  })
  if (rTutErr) throw new Error(`rating tutor (${subject}): ${rTutErr.message}`)

  return session.id
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🎬  Przygotowuję dane demo…\n')

  // 1. Użytkownicy
  process.stdout.write('👤  Tworzę/aktualizuję użytkowników… ')
  const student = await ensureUser(STUDENT)
  const tutor1  = await ensureUser(TUTOR1)
  const tutor2  = await ensureUser(TUTOR2)
  console.log('OK')

  // Upewnij się, że profile mają poprawne imiona (trigger mógł nie wystrzelić przy update)
  await db.from('profiles').update({ full_name: STUDENT.fullName, role: 'student' }).eq('id', student.id)
  await db.from('profiles').update({ full_name: TUTOR1.fullName,  role: 'tutor'   }).eq('id', tutor1.id)
  await db.from('profiles').update({ full_name: TUTOR2.fullName,  role: 'tutor'   }).eq('id', tutor2.id)

  // 2. Czyść stare dane
  process.stdout.write('🧹  Czyszczę stare dane demo… ')
  await cleanupDemo([student.id, tutor1.id, tutor2.id])
  console.log('OK')

  // 3. Profil Anny Kowalskiej (dobry korepetytor)
  process.stdout.write('📋  Konfiguruję profil Anna Kowalska… ')
  await db.from('tutor_profiles').insert({
    id:                 tutor1.id,
    hourly_rate_grosz:  8000,
    bio:                'Jestem nauczycielką matematyki i fizyk z 7-letnim doświadczeniem. ' +
                        'Specjalizuję się w przygotowaniu maturalnym — moi uczniowie osiągają ' +
                        'średnio 85% na maturze rozszerzonej. Prowadzę zajęcia w przyjaznej ' +
                        'atmosferze, cierpliwie wyjaśniam każde zagadnienie i dostosowuję ' +
                        'tempo do potrzeb ucznia.',
    is_available:       true,
    levels:             ['liceum_1', 'liceum_2', 'liceum_3', 'matura'],
  })
  for (const s of ['matematyka', 'fizyka', 'chemia']) {
    await db.from('tutor_subjects').insert({ tutor_id: tutor1.id, subject_id: s })
  }
  console.log('OK')

  // 4. Profil Marka Nowaka (słabszy korepetytor)
  process.stdout.write('📋  Konfiguruję profil Marek Nowak… ')
  await db.from('tutor_profiles').insert({
    id:                 tutor2.id,
    hourly_rate_grosz:  6500,
    bio:                'Korepetytor matematyki i fizyki, student politechniki.',
    is_available:       false,
    levels:             ['sp_7_8', 'liceum_1', 'liceum_2'],
  })
  for (const s of ['matematyka', 'fizyka']) {
    await db.from('tutor_subjects').insert({ tutor_id: tutor2.id, subject_id: s })
  }
  console.log('OK')

  // 5. Sesje i oceny
  console.log('📅  Tworzę sesje…')
  const sessionDefs = [
    {
      // #1 — 8 dni temu | matematyka | 45 min | 5★ want_again
      tutorId:           tutor1.id,
      subject:           'matematyka',
      description:       'Potrzebuję pomocy z całkowaniem przez podstawienie i przez części — mam jutro kartkówkę.',
      daysAgo:           8,
      duration:          45,
      notes:             'Przerobiliśmy metody całkowania: przez podstawienie (substytucja trygonometryczna i algebraiczna) oraz przez części. Zadania domowe: zestaw 5 zadań z podręcznika str. 142.',
      studentScore:      5,
      studentComment:    'Pani Anna świetnie tłumaczy — bez problemu nadążałem za materiałem. Polecam!',
      studentPreference: 'want_again',
      tutorScore:        5,
    },
    {
      // #2 — 14 dni temu | fizyka | 30 min | 5★
      tutorId:           tutor1.id,
      subject:           'fizyka',
      description:       'Fale de Broglie\'a i zasada nieoznaczoności Heisenberga — nie mogę tego zrozumieć z podręcznika.',
      daysAgo:           14,
      duration:          30,
      notes:             'Omówiliśmy fale materii de Broglie\'a i zasadę nieoznaczoności Heisenberga. Obliczenia długości fali dla elektronu i protonów przy różnych energiach kinetycznych.',
      studentScore:      5,
      studentComment:    'Bardzo jasne wyjaśnienia, teraz rozumiem skąd biorą się te wzory.',
      studentPreference: null,
      tutorScore:        4,
    },
    {
      // #3 — 3 dni temu | matematyka | 60 min | 4★ (najnowsza)
      tutorId:           tutor1.id,
      subject:           'matematyka',
      description:       'Przygotowanie do matury z matematyki, zakres rozszerzony — rachunek różniczkowy.',
      daysAgo:           3,
      duration:          60,
      notes:             'Pochodne złożone, reguła łańcuchowa, pochodna funkcji odwrotnej. Omówiliśmy kilka zadań maturalnych z poprzednich lat. Na następną sesję: całkowanie i zastosowania geometryczne pochodnej.',
      studentScore:      4,
      studentComment:    'Bardzo dobra sesja, choć trochę za szybkie tempo na samym początku.',
      studentPreference: null,
      tutorScore:        4,
    },
    {
      // #4 — 20 dni temu | matematyka | 30 min | 2★ avoid (Marek Nowak)
      tutorId:           tutor2.id,
      subject:           'matematyka',
      description:       'Szybkie przypomnienie geometrii analitycznej — równania prostych i okręgów.',
      daysAgo:           20,
      duration:          30,
      notes:             null,
      studentScore:      2,
      studentComment:    'Korepetytor był nieprzygotowany i nie odpowiedział na moje pytania dotyczące równania okręgu. Nie polecam — szkoda czasu i pieniędzy.',
      studentPreference: 'avoid',
      tutorScore:        3,
    },
    {
      // #5 — 5 dni temu | chemia | 45 min | 5★ want_again
      tutorId:           tutor1.id,
      subject:           'chemia',
      description:       'Stechiometria i bilansowanie równań chemicznych — mam sprawdzian za 3 dni.',
      daysAgo:           5,
      duration:          45,
      notes:             'Bilansowanie równań metodą algebraiczną i bilansu elektronowego (reakcje redoks). Obliczenia stechiometryczne z molowością i wydajnością reakcji. Zadania z arkuszy CKE.',
      studentScore:      5,
      studentComment:    'Polecam z całego serca — pani Anna zawsze jest świetnie przygotowana.',
      studentPreference: 'want_again',
      tutorScore:        5,
    },
    {
      // #6 — 10 dni temu | fizyka | 30 min | 4★
      tutorId:           tutor1.id,
      subject:           'fizyka',
      description:       'Optyka geometryczna — soczewki, zwierciadła i prawo Snella.',
      daysAgo:           10,
      duration:          30,
      notes:             'Równanie soczewki i zwierciadła, powiększenie liniowe. Bieg promieni przez soczewki skupiające i rozpraszające. Wzór na kąt graniczny całkowitego wewnętrznego odbicia.',
      studentScore:      4,
      studentComment:    null,
      studentPreference: null,
      tutorScore:        4,
    },
    {
      // #7 — 25 dni temu | matematyka | 60 min | 4★ (najstarsza)
      tutorId:           tutor1.id,
      subject:           'matematyka',
      description:       'Trygonometria — wzory redukcyjne i jedynka trygonometryczna.',
      daysAgo:           25,
      duration:          60,
      notes:             'Wzory redukcyjne dla ±α, π±α, π/2±α. Tożsamości trygonometryczne. Rozwiązywanie równań i nierówności trygonometrycznych. Zastosowanie w zadaniach geometrycznych.',
      studentScore:      4,
      studentComment:    null,
      studentPreference: null,
      tutorScore:        4,
    },
  ]

  let ok = 0
  for (const def of sessionDefs) {
    try {
      await createSession({ studentId: student.id, ...def })
      const label = `  ✓ ${def.subject.padEnd(12)} ${def.daysAgo} dni temu  ${def.studentScore}★ (uczeń) / ${def.tutorScore}★ (korepetytor)${def.studentPreference ? '  →  ' + def.studentPreference : ''}`
      console.log(label)
      ok++
    } catch (e) {
      console.error(`  ✗ ${def.subject}: ${e.message}`)
    }
  }

  // 6. Podsumowanie
  console.log()
  console.log('══════════════════════════════════════════════════')
  console.log(`🎬  Dane demo gotowe  (${ok}/${sessionDefs.length} sesji)`)
  console.log()
  console.log('┌─ Dane logowania ─────────────────────────────────')
  console.log(`│  Hasło (wszystkich):  ${DEMO_PASSWORD}`)
  console.log(`│  Uczeń:              ${STUDENT.email}`)
  console.log(`│  Korepetytor 1:      ${TUTOR1.email}`)
  console.log(`│  Korepetytor 2:      ${TUTOR2.email}`)
  console.log('├─ Scenariusz ─────────────────────────────────────')
  console.log(`│  ${STUDENT.fullName} (uczeń)`)
  console.log('│    6 sesji z Anną Kowalską (matematyka×4, fizyka×2, chemia×1)')
  console.log('│    Preferuje Annę Kowalską → want_again')
  console.log('│    1 sesja z Markiem Nowakiem (matematyka) → avoid 2★')
  console.log(`│  ${TUTOR1.fullName} (korepetytor, 80 zł/h, dostępna)`)
  console.log('│    6 sesji, śr. ocena uczniów ≈ 4.7★, Wilson score obliczony')
  console.log('│    Piotr jest dla niej „want_again" → odznak w karcie zlecenia')
  console.log(`│  ${TUTOR2.fullName} (korepetytor, 65 zł/h, niedostępny)`)
  console.log('│    1 sesja, ocena ucznia 2★ → zablokowany przez Piotra')
  console.log('└──────────────────────────────────────────────────')
  console.log()
  console.log('💡 Wskazówki do demo:')
  console.log('   • Zaloguj jako uczeń → historia, preferencje w ustawieniach')
  console.log('   • Zaloguj jako korepetytor1 → historia, oceny, widok ucznia w zleceniach')
  console.log('   • Zaloguj jako korepetytor2 → brak zleceń od Piotra (avoided)')
  console.log('   • Nowa sesja: złóż zlecenie jako uczeń, akceptuj jako korepetytor1')
}

main().catch(err => {
  console.error('\n❌ Błąd seeda:', err.message)
  process.exit(1)
})
