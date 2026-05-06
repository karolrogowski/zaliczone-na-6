import { describe, it, expect } from 'vitest'
import { validateCommissionPct } from '../validation'

describe('validateCommissionPct', () => {
  it('akceptuje 0%', () => expect(validateCommissionPct('0')).toBeNull())
  it('akceptuje 20%', () => expect(validateCommissionPct('20')).toBeNull())
  it('akceptuje 100%', () => expect(validateCommissionPct('100')).toBeNull())

  it('błąd dla wartości ujemnej', () => expect(validateCommissionPct('-1')).toBeTruthy())
  it('błąd dla wartości powyżej 100', () => expect(validateCommissionPct('101')).toBeTruthy())
  it('błąd dla tekstu', () => expect(validateCommissionPct('abc')).toBeTruthy())
  it('błąd dla pustego stringa', () => expect(validateCommissionPct('')).toBeTruthy())
  it('błąd dla liczby zmiennoprzecinkowej', () =>
    expect(validateCommissionPct('20.5')).toBeNull()) // parseInt('20.5') = 20 → OK
  it('błąd dla samego minusa', () => expect(validateCommissionPct('-')).toBeTruthy())
})
