import { describe, it, expect } from 'vitest'
import { validateSubmitRequest } from '../validation'

describe('validateSubmitRequest', () => {
  it('zwraca undefined dla wybranego przedmiotu', () => {
    expect(validateSubmitRequest({ subject_id: 'matematyka' })).toBeUndefined()
  })

  it('błąd gdy przedmiot nie jest wybrany', () => {
    const result = validateSubmitRequest({ subject_id: '' })
    expect(result?.errors?.subject_id).toBeDefined()
  })

  it('błąd gdy subject_id to same spacje', () => {
    const result = validateSubmitRequest({ subject_id: '   ' })
    expect(result?.errors?.subject_id).toBeDefined()
  })

  it('akceptuje dowolny niepusty string jako subject_id', () => {
    expect(validateSubmitRequest({ subject_id: 'fizyka' })).toBeUndefined()
    expect(validateSubmitRequest({ subject_id: 'jezyk_angielski' })).toBeUndefined()
  })
})
