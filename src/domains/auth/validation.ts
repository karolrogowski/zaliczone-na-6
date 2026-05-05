import type { RegisterFormState, LoginFormState, UserRole } from './types'

export function validateRegisterForm(fields: {
  full_name: string
  email: string
  password: string
  role: string
}): RegisterFormState {
  const errors: NonNullable<RegisterFormState>['errors'] = {}

  if (fields.full_name.trim().length < 2)
    errors.full_name = ['Imię i nazwisko musi mieć co najmniej 2 znaki']
  if (!fields.email.trim())
    errors.email = ['Email jest wymagany']
  if (fields.password.length < 8)
    errors.password = ['Hasło musi mieć co najmniej 8 znaków']
  if (!['student', 'tutor'].includes(fields.role))
    errors.role = ['Wybierz rolę']

  if (Object.keys(errors).length > 0) return { errors }
  return undefined
}

export function validateLoginForm(fields: {
  email: string
  password: string
}): LoginFormState {
  const errors: NonNullable<LoginFormState>['errors'] = {}

  if (!fields.email.trim())
    errors.email = ['Email jest wymagany']
  if (!fields.password)
    errors.password = ['Hasło jest wymagane']

  if (Object.keys(errors).length > 0) return { errors }
  return undefined
}

export const VALID_ROLES: UserRole[] = ['student', 'tutor']

export function validateForgotPasswordForm(fields: {
  email: string
}): import('./types').ForgotPasswordFormState {
  if (!fields.email.trim())
    return { errors: { email: ['Email jest wymagany'] } }
  return undefined
}

export function validateResetPasswordForm(fields: {
  password: string
  confirmPassword: string
}): import('./types').ResetPasswordFormState {
  const errors: NonNullable<import('./types').ResetPasswordFormState>['errors'] = {}

  if (fields.password.length < 8)
    errors.password = ['Hasło musi mieć co najmniej 8 znaków']
  if (fields.password !== fields.confirmPassword)
    errors.confirmPassword = ['Hasła nie są identyczne']

  if (Object.keys(errors).length > 0) return { errors }
  return undefined
}
