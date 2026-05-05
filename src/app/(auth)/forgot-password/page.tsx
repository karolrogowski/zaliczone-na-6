import { ForgotPasswordForm } from '@/domains/auth/components/ForgotPasswordForm'

export default function ForgotPasswordPage() {
  return (
    <>
      <h2 className="mb-2 text-xl font-semibold text-zinc-900">Resetowanie hasła</h2>
      <p className="mb-6 text-sm text-zinc-500">
        Podaj swój adres email — wyślemy Ci link do ustawienia nowego hasła.
      </p>
      <ForgotPasswordForm />
    </>
  )
}
