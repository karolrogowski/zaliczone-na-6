// Tworzy konto administratora.
// Wywoływany automatycznie przez `npm run db:reset`.
// Można też uruchomić ręcznie: node scripts/create-admin.mjs [email] [hasło] ["imię"]
//
// Credentials pobierane są z .env.local (zmienne ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME)
// lub z argumentów linii poleceń (mają pierwszeństwo).

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Wczytaj .env.local
try {
  const env = readFileSync('.env.local', 'utf8')
  for (const line of env.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && !key.startsWith('#')) {
      process.env[key.trim()] ??= rest.join('=').trim()
    }
  }
} catch {
  console.error('❌ Nie znaleziono pliku .env.local — uruchom skrypt z katalogu projektu.')
  process.exit(1)
}

const email    = process.argv[2] || process.env.ADMIN_EMAIL
const password = process.argv[3] || process.env.ADMIN_PASSWORD
const fullName = process.argv[4] || process.env.ADMIN_FULL_NAME

if (!email || !password || !fullName) {
  console.error('❌ Brak danych admina. Uzupełnij ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME w .env.local')
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

console.log(`✅ Konto admina odtworzone: ${email} (${fullName})`)
