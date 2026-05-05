import { describe, it, expect } from 'vitest'
import {
  validateRegisterForm,
  validateLoginForm,
  validateForgotPasswordForm,
  validateResetPasswordForm,
} from '../validation'

const validRegister = {
  full_name: 'Jan Kowalski',
  email: 'jan@example.com',
  password: 'haslo123',
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

  it('błąd gdy hasło krótsze niż 8 znaków', () => {
    const result = validateRegisterForm({ ...validRegister, password: '1234567' })
    expect(result?.errors?.password).toBeDefined()
  })

  it('brak błędu gdy hasło ma dokładnie 8 znaków', () => {
    const result = validateRegisterForm({ ...validRegister, password: '12345678' })
    expect(result).toBeUndefined()
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
    const result = validateResetPasswordForm({ password: 'noweHaslo1', confirmPassword: 'noweHaslo1' })
    expect(result).toBeUndefined()
  })

  it('błąd gdy hasło krótsze niż 8 znaków', () => {
    const result = validateResetPasswordForm({ password: '1234567', confirmPassword: '1234567' })
    expect(result?.errors?.password).toBeDefined()
  })

  it('błąd gdy hasła nie są identyczne', () => {
    const result = validateResetPasswordForm({ password: 'noweHaslo1', confirmPassword: 'inneHaslo' })
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
