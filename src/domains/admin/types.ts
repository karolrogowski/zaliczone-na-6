export type AdminSession = {
  id: string
  status: string
  started_at: string | null
  ended_at: string | null
  duration_minutes: number | null
  student_id: string
  tutor_id: string
  student: { full_name: string } | null
  tutor: { full_name: string } | null
  matching_requests: {
    subjects: { label: string } | null
  } | null
  session_financials: {
    student_cost_grosz: number
    tutor_earning_grosz: number
    platform_commission_grosz: number
    paid_out_at: string | null
  } | null
}

export type AdminUser = {
  id: string
  role: string
  full_name: string
  created_at: string
  email?: string
  email_confirmed_at?: string | null
  tutor_profiles?: {
    hourly_rate_grosz: number | null
    is_available: boolean
    rating_avg: number | null
    rating_count: number
  } | null
}

export type AdminStats = {
  totalSessions: number
  totalUsers: number
  pendingPayoutGrosze: number
}

export type AdminLoginFormState =
  | { message?: string }
  | undefined

export type ConfigFormState =
  | { errors?: { commission_pct?: string }; success?: boolean }
  | undefined
