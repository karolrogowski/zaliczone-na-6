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

export type SessionData = { id: string; daily_room_url: string | null; notes?: string | null }

export type MatchingRequestWithSubject = MatchingRequest & {
  subjects: { label: string }
  tutor_profile: { full_name: string } | null
  student_profile?: { full_name: string } | null
  session?: SessionData | SessionData[] | null
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
  rating_avg: number | null
  rating_count: number
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

export type TutorPublicProfile = {
  hourly_rate_grosz: number | null
  bio: string | null
  is_available: boolean
  rating_avg: number | null
  rating_count: number
  levels: string[]
  profiles: { full_name: string } | null
  tutor_subjects: { subject_id: string; subjects: { label: string } | null }[]
}

export type RatedBy = 'student' | 'tutor'
export type RatingPreference = 'want_again' | 'avoid'
export type TutorPreference = 'flag'

/**
 * Poprzednia interakcja korepetytora z danym uczniem.
 * Używane do wyświetlania odznak w kartach zleceń.
 */
export type TutorStudentInteraction = {
  studentId: string
  /** Uczeń dodał korepetytora do ulubionych */
  wantAgain: boolean
  /** Korepetytor uczył już tego ucznia (istnieje poprzednia ocena) */
  hasPreviousSession: boolean
  /** Ostatnia ocena ucznia wystawiona korepetytorowi */
  studentLastScore: number | null
  /** Korepetytor oznaczył tego ucznia jako problematycznego */
  tutorFlagged: boolean
  /** Prywatna notatka korepetytora o uczniu (widoczna tylko temu korepetytorowi) */
  tutorNote: string | null
}

export type RatingFormState =
  | {
      errors?: { score?: string[]; comment?: string[] }
      message?: string
    }
  | undefined
