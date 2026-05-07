// Tworzy predefiniowanych użytkowników testowych (tylko local dev).
// Uruchamiany automatycznie przez `npm run db:reset`.
// USUNĄĆ przed deployem na produkcję.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

try {
  const env = readFileSync('.env.local', 'utf8')
  for (const line of env.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && !key.startsWith('#')) {
      process.env[key.trim()] ??= rest.join('=').trim()
    }
  }
} catch {
  console.error('❌ Nie znaleziono pliku .env.local')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const PASSWORD = 'testtest1'

const STUDENTS = [
  { email: 'uczen1@test.pl', full_name: 'Anna Kowalska' },
  { email: 'uczen2@test.pl', full_name: 'Piotr Nowak' },
]

const TUTORS = [
  {
    email: 'korepetytor1@test.pl',
    full_name: 'Jan Wiśniewski',
    hourly_rate_grosz: 8000,
    subjects: ['matematyka', 'fizyka'],
    levels: ['liceum_1', 'liceum_2', 'liceum_3', 'matura'],
  },
  {
    email: 'korepetytor2@test.pl',
    full_name: 'Maria Zielińska',
    hourly_rate_grosz: 9000,
    subjects: ['chemia', 'biologia'],
    levels: ['sp_7_8', 'liceum_1', 'liceum_2'],
  },
  {
    email: 'korepetytor3@test.pl',
    full_name: 'Tomasz Wójcik',
    hourly_rate_grosz: 7500,
    subjects: ['jezyk_angielski', 'informatyka'],
    levels: ['liceum_1', 'liceum_2', 'liceum_3', 'matura', 'studia'],
  },
]

async function upsertUser(email, role, full_name) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    user_metadata: { role, full_name },
    email_confirm: true,
  })

  if (error) {
    if (error.message?.includes('already registered')) return null
    throw new Error(`${email}: ${error.message}`)
  }

  return data.user
}

// Uczniowie
for (const s of STUDENTS) {
  await upsertUser(s.email, 'student', s.full_name)
}
console.log(`✅ Uczniowie: ${STUDENTS.map(s => s.email).join(', ')}`)

// Korepetytorzy + profil
for (const t of TUTORS) {
  const user = await upsertUser(t.email, 'tutor', t.full_name)

  if (user) {
    await supabase
      .from('tutor_profiles')
      .upsert({ id: user.id, hourly_rate_grosz: t.hourly_rate_grosz, levels: t.levels, is_available: false }, { onConflict: 'id' })

    for (const subject of t.subjects) {
      await supabase
        .from('tutor_subjects')
        .upsert({ tutor_id: user.id, subject_id: subject }, { onConflict: 'tutor_id,subject_id' })
    }
  }
}
console.log(`✅ Korepetytorzy: ${TUTORS.map(t => t.email).join(', ')}`)

console.log()
console.log('Dane do logowania:')
console.log('  Hasło dla wszystkich: testtest1')
console.log('  Uczniowie:      uczen1@test.pl, uczen2@test.pl')
console.log('  Korepetytorzy: korepetytor1@test.pl, korepetytor2@test.pl, korepetytor3@test.pl')
