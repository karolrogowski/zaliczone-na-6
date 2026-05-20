// Tworzy konto administratora.
// Wywoływany automatycznie przez `npm run db:reset`.
// Można też uruchomić ręcznie: node scripts/create-admin.mjs [email] [hasło] ["imię"]
//
// Credentials pobierane są z .env.local (zmienne ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME)
// lub z argumentów linii poleceń (mają pierwszeństwo).

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

function loadEnv(path) {
  try {
    const env = readFileSync(path, 'utf8')
    for (const line of env.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue
      const key = trimmed.slice(0, eqIndex).trim()
      const raw = trimmed.slice(eqIndex + 1).trim()
      const value = raw.replace(/^(['"])(.*)\1$/, '$2')
      if (key) process.env[key] ??= value
    }
  } catch { /* plik opcjonalny */ }
}

loadEnv('.env.local')
loadEnv('.env.scripts')

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('❌ Nie znaleziono .env.local — uruchom skrypt z katalogu projektu.')
  process.exit(1)
}

const email    = process.argv[2] || process.env.ADMIN_EMAIL
const password = process.argv[3] || process.env.ADMIN_PASSWORD
const fullName = process.argv[4] || process.env.ADMIN_FULL_NAME

if (!email || !password || !fullName) {
  console.error('❌ Brak danych admina. Uzupełnij ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME w .env.scripts')
  console.error('   lub podaj jako argumenty: node scripts/create-admin.mjs <email> <hasło> "<imię>"')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  user_metadata: { role: 'admin', full_name: fullName },
  email_confirm: true,
})

if (error) {
  if (error.message?.includes('already registered')) {
    console.log(`ℹ️  Konto admina (${email}) już istnieje — pomijam.`)
    process.exit(0)
  }
  console.error('❌ Błąd:', error.message)
  process.exit(1)
}

// Trigger handle_new_user whitelistuje role do 'student'|'tutor' i ignoruje 'admin'
// w user_metadata. Ręcznie promujemy świeżo utworzone konto przez service role.
const { error: roleError } = await supabase
  .from('profiles')
  .update({ role: 'admin' })
  .eq('id', data.user.id)

if (roleError) {
  console.error('❌ Nie udało się ustawić roli admin:', roleError.message)
  process.exit(1)
}

console.log(`✅ Konto admina odtworzone: ${email} (${fullName})`)
