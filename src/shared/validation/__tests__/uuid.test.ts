import { describe, it, expect } from 'vitest'
import { isUuid } from '../uuid'

describe('isUuid', () => {
  it('akceptuje UUID v4 wygenerowany przez Postgres', () => {
    expect(isUuid('a3a07ec8-5b7d-4d6b-8b3e-3a4d4f6a7b8c')).toBe(true)
  })

  it('akceptuje UUID pisany wielkimi literami', () => {
    expect(isUuid('A3A07EC8-5B7D-4D6B-8B3E-3A4D4F6A7B8C')).toBe(true)
  })

  it('odrzuca string bez myślników', () => {
    expect(isUuid('a3a07ec85b7d4d6b8b3e3a4d4f6a7b8c')).toBe(false)
  })

  it('odrzuca pusty string', () => {
    expect(isUuid('')).toBe(false)
  })

  it('odrzuca null i undefined', () => {
    expect(isUuid(null)).toBe(false)
    expect(isUuid(undefined)).toBe(false)
  })

  it('odrzuca slug tekstowy', () => {
    expect(isUuid('123-some-slug')).toBe(false)
  })

  it('odrzuca SQL injection attempt', () => {
    expect(isUuid("' OR 1=1 --")).toBe(false)
  })

  it('odrzuca UUID v6+ (poza specyfikacją RFC 4122)', () => {
    expect(isUuid('a3a07ec8-5b7d-6d6b-8b3e-3a4d4f6a7b8c')).toBe(false)
  })
})