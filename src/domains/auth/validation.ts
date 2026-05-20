import type { RegisterFormState, LoginFormState, UserRole, TutorProfileFormState } from './types'

// Limity bezpiecznikowe — przeciwdziałają DoS przez payload i zaśmiecaniu UI
export const MAX_FULL_NAME = 100
export const MAX_BIO = 2000
export const MAX_PASSWORD = 100

export const MIN_PASSWORD = 10
const LEVEL_VALUES = new Set([
  'sp_4_6', 'sp_7_8', 'liceum_1', 'liceum_2', 'liceum_3', 'matura', 'studia', 'inne',
])

// Hasło musi mieć min. MIN_PASSWORD znaków i co najmniej 3 z 4 klas (mała, duża, cyfra, znak specjalny).
// Słabe hasła ('12345678', 'password') przepuszczała poprzednia walidacja — to było main complaint w audycie.
export function validatePasswordStrength(password: string): string[] | null {
  if (password.length < MIN_PASSWORD)
    return [`Hasło musi mieć co najmniej ${MIN_PASSWORD} znaków`]
  if (password.length > MAX_PASSWORD)
    return [`Hasło nie może być dłuższe niż ${MAX_PASSWORD} znaków`]

  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length

  if (classes < 3)
    return ['Hasło musi zawierać co najmniej 3 z 4 klas znaków: małe litery, wielkie litery, cyfry, znaki specjalne']

  return null
}

export function validateRegisterForm(fields: {
  full_name: string
  email: string
  password: string
  role: string
}): RegisterFormState {
  const errors: NonNullable<RegisterFormState>['errors'] = {}

  const trimmedName = fields.full_name.trim()
  if (trimmedName.length < 2)
    errors.full_name = ['Imię i nazwisko musi mieć co najmniej 2 znaki']
  else if (trimmedName.length > MAX_FULL_NAME)
    errors.full_name = [`Imię i nazwisko nie może być dłuższe niż ${MAX_FULL_NAME} znaków`]

  if (!fields.email.trim())
    errors.email = ['Email jest wymagany']

  const passwordErr = validatePasswordStrength(fields.password)
  if (passwordErr) errors.password = passwordErr

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

  const passwordErr = validatePasswordStrength(fields.password)
  if (passwordErr) errors.password = passwordErr
  if (fields.password !== fields.confirmPassword)
    errors.confirmPassword = ['Hasła nie są identyczne']

  if (Object.keys(errors).length > 0) return { errors }
  return undefined
}

export function validateTutorProfile(fields: {
  subject_ids: string[]
  levels: string[]
  hourly_rate_pln: string
  bio?: string
}): TutorProfileFormState {
  const errors: NonNullable<TutorProfileFormState>['errors'] = {}

  if (fields.subject_ids.length === 0)
    errors.subjects = ['Wybierz co najmniej jeden przedmiot']

  if (fields.levels.length === 0)
    errors.levels = ['Wybierz co najmniej jeden poziom nauczania']
  else if (!fields.levels.every((l) => LEVEL_VALUES.has(l)))
    // Whitelist — odrzucamy obce wartości, żeby klient nie zaśmiecił bazy lub nie wstrzyknął niestandardowych etykiet
    errors.levels = ['Nieprawidłowy poziom nauczania']

  const rate = parseFloat(fields.hourly_rate_pln.replace(',', '.'))
  if (!fields.hourly_rate_pln.trim() || isNaN(rate) || rate <= 0)
    errors.hourly_rate = ['Podaj stawkę godzinową większą od zera']

  if (fields.bio !== undefined && fields.bio.length > MAX_BIO)
    errors.bio = [`Bio nie może być dłuższe niż ${MAX_BIO} znaków`]

  if (Object.keys(errors).length > 0) return { errors }
  return undefined
}