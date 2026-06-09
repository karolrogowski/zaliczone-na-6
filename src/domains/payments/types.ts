export type StripePaymentStatus =
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'captured'
  | 'cancelled'
  | 'refunded'
  | 'failed'

export type SessionFinancials = {
  id: string
  session_id: string
  student_cost_grosz: number
  tutor_earning_grosz: number
  platform_commission_grosz: number
  paid_out_at: string | null
  stripe_payment_intent_id: string | null
  stripe_status: StripePaymentStatus
  stripe_transfer_id: string | null
  stripe_charge_id: string | null
  created_at: string
}
