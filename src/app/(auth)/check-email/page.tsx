import Link from 'next/link'

export default function CheckEmailPage() {
  return (
    <div className="flex flex-col gap-4 text-center">
      <div className="text-4xl">📬</div>
      <h2 className="text-xl font-semibold text-zinc-900">Sprawdź skrzynkę mailową</h2>
      <p className="text-sm text-zinc-600">
        Wysłaliśmy link potwierdzający na Twój adres email.
        Kliknij go, żeby aktywować konto.
      </p>
      <p className="text-xs text-zinc-400">
        Nie widzisz maila? Sprawdź folder spam.
      </p>
      <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
        Wróć do logowania
      </Link>
    </div>
  )
}
