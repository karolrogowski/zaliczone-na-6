import { vi, describe, it, expect } from 'vitest'

// server-only guard blokuje import w Vitest — mockujemy, bo testowane ścieżki
// (nieprawidłowy type lub brak token_hash) nigdy nie wywołują createClient().
vi.mock('server-only', () => ({}))

import { NextRequest } from 'next/server'
import { GET } from '../confirm/route'

const BASE = 'http://localhost:3000'

// Testy ścieżek, które NIE wywołują Supabase (type=null lub token_hash=null).
// Weryfikują, że whitelist OTP odrzuca nieznane typy przed wysłaniem żądania do Supabase.

describe('GET /auth/confirm — whitelist typów OTP', () => {
  it('przekierowuje na błąd gdy typ OTP nie należy do whitelisty', async () => {
    const req = new NextRequest(`${BASE}/auth/confirm?token_hash=abc123&type=evil_payload`)
    const res = await GET(req)
    expect(res.headers.get('location')).toContain('/login?error=invalid_link')
  })

  it('przekierowuje na błąd gdy typ OTP to pusty string', async () => {
    const req = new NextRequest(`${BASE}/auth/confirm?token_hash=abc123&type=`)
    const res = await GET(req)
    expect(res.headers.get('location')).toContain('/login?error=invalid_link')
  })

  it('przekierowuje na błąd gdy brakuje token_hash (nawet przy prawidłowym typie)', async () => {
    const req = new NextRequest(`${BASE}/auth/confirm?type=signup`)
    const res = await GET(req)
    expect(res.headers.get('location')).toContain('/login?error=invalid_link')
  })

  it('przekierowuje na błąd gdy brakuje obu parametrów', async () => {
    const req = new NextRequest(`${BASE}/auth/confirm`)
    const res = await GET(req)
    expect(res.headers.get('location')).toContain('/login?error=invalid_link')
  })
})
