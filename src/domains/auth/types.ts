export type UserRole = 'student' | 'tutor' | 'admin'

export type Profile = {
  id: string
  role: UserRole
  full_name: string
  avatar_url: string | null
  phone: string | null
}

export type RegisterFormState =
  | {
      errors?: {
        full_name?: string[]
        email?: string[]
        password?: string[]
        role?: string[]
      }
      message?: string
    }
  | undefined

export type LoginFormState =
  | {
      errors?: {
        email?: string[]
        password?: string[]
      }
      message?: string
    }
  | undefined

export type ForgotPasswordFormState =
  | {
      errors?: { email?: string[] }
      message?: string
      success?: boolean
    }
  | undefined

export type ResetPasswordFormState =
  | {
      errors?: {
        password?: string[]
        confirmPassword?: string[]
      }
      message?: string
    }
  | undefined

export type TutorOwnProfile = {
  hourly_rate_grosz: number | null
  bio: string | null
  levels: string[]
  tutor_subjects: { subject_id: string }[]
}

export type SettingsFormState =
  | {
      errors?: {
        full_name?: string[]
        password?: string[]
        confirmPassword?: string[]
      }
      message?: string
      success?: boolean
    }
  | undefined

export type TutorProfileFormState =
  | {
      errors?: {
        subjects?: string[]
        levels?: string[]
        hourly_rate?: string[]
        bio?: string[]
      }
      message?: string
    }
  | undefined
