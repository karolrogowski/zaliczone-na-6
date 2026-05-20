import { describe, it, expect } from 'vitest'
import {
  validateRegisterForm,
  validateLoginForm,
  validateForgotPasswordForm,
  validateResetPasswordForm,
  validateTutorProfile,
} from '../validation'

const validRegister = {
  full_name: 'Jan Kowalski',
  email: 'jan@example.com',
  password: 'StrongPass1!',
  role: 'student',
}

const validLogin = {
  email: 'jan@example.com',
  password: 'haslo123',
}

describe('validateRegisterForm', () => {
  it('zwraca undefined dla poprawnych danych', () => {
    expect(validateRegisterForm(validRegister)).toBeUndefined()
  })

  it('zwraca undefined dla roli tutor', () => {
    expect(validateRegisterForm({ ...validRegister, role: 'tutor' })).toBeUndefined()
  })

  it('błąd gdy imię krótsze niż 2 znaki', () => {
    const result = validateRegisterForm({ ...validRegister, full_name: 'J' })
    expect(result?.errors?.full_name).toBeDefined()
  })

  it('brak błędu gdy imię ma dokładnie 2 znaki', () => {
    const result = validateRegisterForm({ ...validRegister, full_name: 'Jo' })
    expect(result).toBeUndefined()
  })

  it('błąd gdy email jest pusty', () => {
    const result = validateRegisterForm({ ...validRegister, email: '' })
    expect(result?.errors?.email).toBeDefined()
  })

  it('błąd gdy email to same spacje', () => {
    const result = validateRegisterForm({ ...validRegister, email: '   ' })
    expect(result?.errors?.email).toBeDefined()
  })

  it('błąd gdy hasło krótsze niż 10 znaków', () => {
    const result = validateRegisterForm({ ...validRegister, password: 'Short1!' })
    expect(result?.errors?.password).toBeDefined()
  })

  it('błąd gdy hasło składa się tylko z cyfr (jedna klasa znaków)', () => {
    const result = validateRegisterForm({ ...validRegister, password: '1234567890' })
    expect(result?.errors?.password).toBeDefined()
  })

  it('błąd gdy hasło ma 2 klasy znaków zamiast 3', () => {
    const result = validateRegisterForm({ ...validRegister, password: 'lowercase1' })
    expect(result?.errors?.password).toBeDefined()
  })

  it('brak błędu gdy hasło ma 10 znaków i 3 klasy', () => {
    const result = validateRegisterForm({ ...validRegister, password: 'Password11' })
    expect(result).toBeUndefined()
  })

  it('brak błędu gdy hasło ma 4 klasy znaków', () => {
    const result = validateRegisterForm({ ...validRegister, password: 'Aa1!Aa1!Aa1!' })
    expect(result).toBeUndefined()
  })

  it('błąd gdy imię ma ponad 100 znaków', () => {
    const result = validateRegisterForm({ ...validRegister, full_name: 'x'.repeat(101) })
    expect(result?.errors?.full_name).toBeDefined()
  })

  it('błąd gdy rola jest niepoprawna', () => {
    const result = validateRegisterForm({ ...validRegister, role: 'admin' })
    expect(result?.errors?.role).toBeDefined()
  })

  it('błąd gdy rola jest pusta', () => {
    const result = validateRegisterForm({ ...validRegister, role: '' })
    expect(result?.errors?.role).toBeDefined()
  })

  it('zwraca wszystkie błędy naraz gdy wiele pól jest niepoprawnych', () => {
    const result = validateRegisterForm({ full_name: '', email: '', password: '', role: '' })
    expect(result?.errors?.full_name).toBeDefined()
    expect(result?.errors?.email).toBeDefined()
    expect(result?.errors?.password).toBeDefined()
    expect(result?.errors?.role).toBeDefined()
  })
})

describe('validateLoginForm', () => {
  it('zwraca undefined dla poprawnych danych', () => {
    expect(validateLoginForm(validLogin)).toBeUndefined()
  })

  it('błąd gdy email jest pusty', () => {
    const result = validateLoginForm({ ...validLogin, email: '' })
    expect(result?.errors?.email).toBeDefined()
  })

  it('błąd gdy hasło jest puste', () => {
    const result = validateLoginForm({ ...validLogin, password: '' })
    expect(result?.errors?.password).toBeDefined()
  })

  it('zwraca oba błędy gdy email i hasło są puste', () => {
    const result = validateLoginForm({ email: '', password: '' })
    expect(result?.errors?.email).toBeDefined()
    expect(result?.errors?.password).toBeDefined()
  })
})

describe('validateForgotPasswordForm', () => {
  it('zwraca undefined dla poprawnego emaila', () => {
    expect(validateForgotPasswordForm({ email: 'jan@example.com' })).toBeUndefined()
  })

  it('błąd gdy email jest pusty', () => {
    const result = validateForgotPasswordForm({ email: '' })
    expect(result?.errors?.email).toBeDefined()
  })

  it('błąd gdy email to same spacje', () => {
    const result = validateForgotPasswordForm({ email: '   ' })
    expect(result?.errors?.email).toBeDefined()
  })
})

describe('validateResetPasswordForm', () => {
  it('zwraca undefined gdy hasła są poprawne i identyczne', () => {
    const result = validateResetPasswordForm({ password: 'NoweHaslo1!', confirmPassword: 'NoweHaslo1!' })
    expect(result).toBeUndefined()
  })

  it('błąd gdy hasło krótsze niż 10 znaków', () => {
    const result = validateResetPasswordForm({ password: 'Short1!', confirmPassword: 'Short1!' })
    expect(result?.errors?.password).toBeDefined()
  })

  it('błąd gdy hasła nie są identyczne', () => {
    const result = validateResetPasswordForm({ password: 'NoweHaslo1!', confirmPassword: 'InneHaslo1!' })
    expect(result?.errors?.confirmPassword).toBeDefined()
  })

  it('błąd długości i niezgodności jednocześnie', () => {
    const result = validateResetPasswordForm({ password: 'abc', confirmPassword: 'xyz' })
    expect(result?.errors?.password).toBeDefined()
    expect(result?.errors?.confirmPassword).toBeDefined()
  })

  it('brak błędu niezgodności gdy oba hasła są identyczne mimo krótkości', () => {
    const result = validateResetPasswordForm({ password: 'abc', confirmPassword: 'abc' })
    expect(result?.errors?.password).toBeDefined()
    expect(result?.errors?.confirmPassword).toBeUndefined()
  })
})

describe('validateTutorProfile — whitelist levels', () => {
  const valid = { subject_ids: ['matematyka'], levels: ['liceum_1'], hourly_rate_pln: '80' }

  it('odrzuca level spoza whitelisty', () => {
    const result = validateTutorProfile({ ...valid, levels: ['liceum_1', '<script>'] })
    expect(result?.errors?.levels).toBeDefined()
  })

  it('akceptuje wszystkie poziomy z whitelisty', () => {
    const result = validateTutorProfile({
      ...valid,
      levels: ['sp_4_6', 'sp_7_8', 'liceum_1', 'liceum_2', 'liceum_3', 'matura', 'studia', 'inne'],
    })
    expect(result).toBeUndefined()
  })

  it('błąd gdy bio przekracza 2000 znaków', () => {
    const result = validateTutorProfile({ ...valid, bio: 'x'.repeat(2001) })
    expect(result?.errors?.bio).toBeDefined()
  })
})

describe('validateTutorProfile', () => {
  const valid = { subject_ids: ['matematyka'], levels: ['liceum_1'], hourly_rate_pln: '80' }

  it('zwraca undefined dla poprawnych danych', () => {
    expect(validateTutorProfile(valid)).toBeUndefined()
  })

  it('akceptuje stawkę z przecinkiem', () => {
    expect(validateTutorProfile({ ...valid, hourly_rate_pln: '79,99' })).toBeUndefined()
  })

  it('akceptuje stawkę z kropką', () => {
    expect(validateTutorProfile({ ...valid, hourly_rate_pln: '79.50' })).toBeUndefined()
  })

  it('akceptuje wiele przedmiotów i poziomów', () => {
    expect(validateTutorProfile({ ...valid, subject_ids: ['matematyka', 'fizyka'], levels: ['liceum_1', 'matura'] })).toBeUndefined()
  })

  it('błąd gdy brak przedmiotów', () => {
    expect(validateTutorProfile({ ...valid, subject_ids: [] })?.errors?.subjects).toBeDefined()
  })

  it('błąd gdy brak poziomów', () => {
    expect(validateTutorProfile({ ...valid, levels: [] })?.errors?.levels).toBeDefined()
  })

  it('błąd gdy stawka jest pusta', () => {
    expect(validateTutorProfile({ ...valid, hourly_rate_pln: '' })?.errors?.hourly_rate).toBeDefined()
  })

  it('błąd gdy stawka to same spacje', () => {
    expect(validateTutorProfile({ ...valid, hourly_rate_pln: '   ' })?.errors?.hourly_rate).toBeDefined()
  })

  it('błąd gdy stawka wynosi 0', () => {
    expect(validateTutorProfile({ ...valid, hourly_rate_pln: '0' })?.errors?.hourly_rate).toBeDefined()
  })

  it('błąd gdy stawka jest ujemna', () => {
    expect(validateTutorProfile({ ...valid, hourly_rate_pln: '-10' })?.errors?.hourly_rate).toBeDefined()
  })

  it('błąd gdy stawka nie jest liczbą', () => {
    expect(validateTutorProfile({ ...valid, hourly_rate_pln: 'abc' })?.errors?.hourly_rate).toBeDefined()
  })

  it('zwraca wszystkie błędy naraz', () => {
    const result = validateTutorProfile({ subject_ids: [], levels: [], hourly_rate_pln: '' })
    expect(result?.errors?.subjects).toBeDefined()
    expect(result?.errors?.levels).toBeDefined()
    expect(result?.errors?.hourly_rate).toBeDefined()
  })
})
