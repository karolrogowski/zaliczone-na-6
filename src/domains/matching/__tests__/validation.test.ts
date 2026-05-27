import { describe, it, expect } from 'vitest'
import { validateSubmitRequest, validateRatingComment, MAX_DESCRIPTION, MAX_COMMENT, MIN_COMMENT_LOW_SCORE } from '../validation'

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

  it(`błąd gdy opis przekracza ${MAX_DESCRIPTION} znaków`, () => {
    const result = validateSubmitRequest({ ...valid, description: 'x'.repeat(MAX_DESCRIPTION + 1) })
    expect(result?.errors?.description).toBeDefined()
  })

  it('błąd gdy poziom (wpis własny) przekracza 100 znaków', () => {
    expect(validateSubmitRequest({ ...valid, level: 'x'.repeat(101) })?.errors?.level).toBeDefined()
  })
})

describe('validateRatingComment', () => {
  it('zwraca null dla pustego komentarza (bez score)', () => {
    expect(validateRatingComment('')).toBeNull()
  })

  it('zwraca null dla normalnego komentarza (bez score)', () => {
    expect(validateRatingComment('Świetny korepetytor, polecam!')).toBeNull()
  })

  it(`zwraca błąd gdy komentarz przekracza ${MAX_COMMENT} znaków`, () => {
    expect(validateRatingComment('x'.repeat(MAX_COMMENT + 1))).not.toBeNull()
  })

  it('zwraca null dla pustego komentarza przy score >= 3', () => {
    expect(validateRatingComment('', 3)).toBeNull()
    expect(validateRatingComment('', 4)).toBeNull()
    expect(validateRatingComment('', 5)).toBeNull()
  })

  it('zwraca błąd dla pustego komentarza przy score <= 2', () => {
    expect(validateRatingComment('', 1)).not.toBeNull()
    expect(validateRatingComment('', 2)).not.toBeNull()
  })

  it(`zwraca błąd gdy komentarz jest krótszy niż ${MIN_COMMENT_LOW_SCORE} znaków przy score <= 2`, () => {
    const shortComment = 'Za krótki'
    expect(shortComment.length).toBeLessThan(MIN_COMMENT_LOW_SCORE)
    expect(validateRatingComment(shortComment, 1)).not.toBeNull()
    expect(validateRatingComment(shortComment, 2)).not.toBeNull()
  })

  it(`zwraca null gdy komentarz ma dokładnie ${MIN_COMMENT_LOW_SCORE} znaków przy score <= 2`, () => {
    const exactComment = 'x'.repeat(MIN_COMMENT_LOW_SCORE)
    expect(validateRatingComment(exactComment, 1)).toBeNull()
    expect(validateRatingComment(exactComment, 2)).toBeNull()
  })

  it('zwraca null dla długiego komentarza przy score <= 2 (spełnia minimum)', () => {
    const goodComment = 'Korepetytor nie był przygotowany do zajęć i nie wyjaśnił żadnego z moich pytań.'
    expect(goodComment.length).toBeGreaterThanOrEqual(MIN_COMMENT_LOW_SCORE)
    expect(validateRatingComment(goodComment, 1)).toBeNull()
  })
})
