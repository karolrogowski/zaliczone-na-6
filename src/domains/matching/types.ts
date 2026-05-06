export type RequestStatus = 'pending' | 'accepted' | 'cancelled' | 'expired'

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
}

export type Subject = {
  id: string
  label: string
}

export type TutorProfileDetails = {
  is_available: boolean
  hourly_rate_grosz: number | null
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
