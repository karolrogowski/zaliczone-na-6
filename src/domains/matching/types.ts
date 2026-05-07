export type RequestStatus = 'pending' | 'accepted' | 'cancelled' | 'expired' | 'completed'

export type MatchingRequest = {
  id: string
  student_id: string
  tutor_id: string | null
  subject_id: string
  level: string | null
  scope: string | null
  description: string | null
  status: RequestStatus
  expires_at: string
  created_at: string
  updated_at: string
}

export type MatchingRequestWithSubject = MatchingRequest & {
  subjects: { label: string }
  tutor_profile: { full_name: string } | null
}

export type Subject = {
  id: string
  label: string
}

export type TutorProfileDetails = {
  is_available: boolean
  hourly_rate_grosz: number | null
  levels: string[]
  tutor_subjects: { subject_id: string }[]
}

export type SubmitRequestFormState =
  | {
      errors?: {
        subject_id?: string[]
        level?: string[]
        scope?: string[]
        description?: string[]
      }
      message?: string
    }
  | undefined

export type AcceptRequestResult =
  | { success: true }
  | { success: false; message: string }

export type StudentStats = {
  totalCompleted: number
  subjectsBreakdown: { subject_id: string; label: string; count: number }[]
  uniqueTutors: number
}
