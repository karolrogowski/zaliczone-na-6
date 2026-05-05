import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

export const STUDENT_EMAIL = 'student@test.zaliczone.local'
export const TUTOR1_EMAIL = 'tutor1@test.zaliczone.local'
export const TUTOR2_EMAIL = 'tutor2@test.zaliczone.local'
export const TEST_PASSWORD = 'Test1234!'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function globalSetup() {
  const supabase = adminClient()

  // Sprawdź czy Supabase działa
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/health`)
    if (!res.ok) throw new Error()
  } catch {
    throw new Error(
      '\n\n❌ Supabase nie działa. Uruchom: npx supabase start\n'
    )
  }

  const student = await upsertUser(supabase, STUDENT_EMAIL, 'student', 'Testowy Uczeń')
  const tutor1 = await upsertUser(supabase, TUTOR1_EMAIL, 'tutor', 'Testowy Korepetytor 1')
  const tutor2 = await upsertUser(supabase, TUTOR2_EMAIL, 'tutor', 'Testowy Korepetytor 2')

  // Skonfiguruj profile korepetytorów (stawka + przedmiot)
  for (const tutorId of [tutor1.id, tutor2.id]) {
    await supabase
      .from('tutor_profiles')
      .upsert({ id: tutorId, hourly_rate_grosz: 10000, is_available: false }, { onConflict: 'id' })

    await supabase
      .from('tutor_subjects')
      .upsert({ tutor_id: tutorId, subject_id: 'matematyka' }, { onConflict: 'tutor_id,subject_id' })
  }

  console.log(`✅ Użytkownicy testowi gotowi (uczeń: ${student.id}, korepetytor 1: ${tutor1.id}, korepetytor 2: ${tutor2.id})`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertUser(supabase: any, email: string, role: string, full_name: string) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    user_metadata: { role, full_name },
    email_confirm: true,
  })

  if (data?.user) return data.user

  // Użytkownik już istnieje — znajdź go
  const { data: list } = await supabase.auth.admin.listUsers()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = list?.users.find((u: any) => u.email === email)
  if (existing) return existing

  throw new Error(`Nie udało się utworzyć użytkownika ${email}: ${error?.message}`)
}
