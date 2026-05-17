// Synchronizuje zmienne z .env.vercel do Vercel (środowisko production).
// Użycie: node scripts/sync-env-vercel.mjs
// Wymaga VERCEL_TOKEN i VERCEL_PROJECT_ID w .env.local.

import { readFileSync } from 'fs'

function parseEnvFile(path) {
  try {
    const content = readFileSync(path, 'utf8')
    const result = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue
      const key = trimmed.slice(0, eqIndex).trim()
      const value = trimmed.slice(eqIndex + 1).trim()
      if (key) result[key] = value
    }
    return result
  } catch {
    return {}
  }
}

const local = parseEnvFile('.env.local')
const TOKEN = local.VERCEL_TOKEN
const PROJECT_ID = local.VERCEL_PROJECT_ID

if (!TOKEN || !PROJECT_ID) {
  console.error('❌ Brak VERCEL_TOKEN lub VERCEL_PROJECT_ID w .env.local')
  process.exit(1)
}

const varsToSync = parseEnvFile('.env.vercel')

if (Object.keys(varsToSync).length === 0) {
  console.error('❌ Plik .env.vercel jest pusty lub nie istnieje')
  process.exit(1)
}

const BASE = `https://api.vercel.com/v10/projects/${PROJECT_ID}/env`
const HEADERS = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
}

const listRes = await fetch(`${BASE}?limit=100`, { headers: HEADERS })
if (!listRes.ok) {
  const err = await listRes.json()
  console.error('❌ Błąd pobierania zmiennych z Vercel:', err.error?.message)
  process.exit(1)
}

const { envs: existing } = await listRes.json()

let created = 0
let updated = 0
let failed = 0

console.log('Synchronizacja .env.vercel → Vercel (production):\n')

for (const [key, value] of Object.entries(varsToSync)) {
  const existingVar = existing.find(e => e.key === key && e.target?.includes('production'))

  if (existingVar) {
    const res = await fetch(`${BASE}/${existingVar.id}`, {
      method: 'PATCH',
      headers: HEADERS,
      body: JSON.stringify({ value, target: ['production'] }),
    })
    if (res.ok) {
      updated++
      console.log(`  ↻  ${key}`)
    } else {
      const err = await res.json()
      console.error(`  ✗  ${key}: ${err.error?.message}`)
      failed++
    }
  } else {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ key, value, target: ['production'], type: 'encrypted' }),
    })
    if (res.ok) {
      created++
      console.log(`  +  ${key}`)
    } else {
      const err = await res.json()
      console.error(`  ✗  ${key}: ${err.error?.message}`)
      failed++
    }
  }
}

console.log(`\n✅ Gotowe: ${created} dodane, ${updated} zaktualizowane${failed ? `, ${failed} błędów` : ''}`)
if (created > 0) {
  console.log('\n⚠️  Nowe zmienne wymagają redeploymentu: vercel redeploy --prod')
}