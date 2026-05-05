import Link from 'next/link'
import { LoginForm } from '@/domains/auth/components/LoginForm'

export default function LoginPage() {
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-900">Zaloguj się</h2>
        <Link href="/forgot-password" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
          Zapomniałem hasła
        </Link>
      </div>
      <LoginForm />
    </>
  )
}
