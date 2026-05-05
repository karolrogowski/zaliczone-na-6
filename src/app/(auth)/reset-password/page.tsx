import { ResetPasswordForm } from '@/domains/auth/components/ResetPasswordForm'

export default function ResetPasswordPage() {
  return (
    <>
      <h2 className="mb-6 text-xl font-semibold text-zinc-900">Ustaw nowe hasło</h2>
      <ResetPasswordForm />
    </>
  )
}
