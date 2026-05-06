import { describe, it, expect } from 'vitest'
import { validateSubmitRequest } from '../validation'

const valid = {
  subject_id: 'matematyka',
  level: 'I klasa liceum / technikum',
  scope: 'Sprawdzian / kartkówka',
  description: 'Nie rozumiem równań kwadratowych',
}

describe('validateSubmitRequest', () => {
  it('zwraca undefined dla poprawnych danych', () => {
    expect(validateSubmitRequest(valid)).toBeUndefined()
  })

  it('błąd gdy przedmiot nie wybrany', () => {
    expect(validateSubmitRequest({ ...valid, subject_id: '' })?.errors?.subject_id).toBeDefined()
  })

  it('błąd gdy subject_id to same spacje', () => {
    expect(validateSubmitRequest({ ...valid, subject_id: '   ' })?.errors?.subject_id).toBeDefined()
  })

  it('błąd gdy poziom pusty', () => {
    expect(validateSubmitRequest({ ...valid, level: '' })?.errors?.level).toBeDefined()
  })

  it('błąd gdy zakres pusty', () => {
    expect(validateSubmitRequest({ ...valid, scope: '' })?.errors?.scope).toBeDefined()
  })

  it('błąd gdy opis pusty', () => {
    expect(validateSubmitRequest({ ...valid, description: '' })?.errors?.description).toBeDefined()
  })

  it('błąd gdy opis to same spacje', () => {
    expect(validateSubmitRequest({ ...valid, description: '   ' })?.errors?.description).toBeDefined()
  })

  it('zwraca wszystkie błędy naraz', () => {
    const result = validateSubmitRequest({ subject_id: '', level: '', scope: '', description: '' })
    expect(result?.errors?.subject_id).toBeDefined()
    expect(result?.errors?.level).toBeDefined()
    expect(result?.errors?.scope).toBeDefined()
    expect(result?.errors?.description).toBeDefined()
  })

  it('akceptuje dowolny niepusty string jako poziom (wpis własny)', () => {
    expect(validateSubmitRequest({ ...valid, level: 'Klasa VIII B' })).toBeUndefined()
  })
})
