import { RegisterForm } from '@/domains/auth/components/RegisterForm'

export default function RegisterPage() {
  return (
    <>
      <h2 className="mb-6 text-xl font-semibold text-zinc-900">Utwórz konto</h2>
      <RegisterForm />
    </>
  )
}
