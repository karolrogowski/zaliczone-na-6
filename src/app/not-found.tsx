import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center">
      <p className="text-5xl font-bold text-zinc-200">404</p>
      <h1 className="text-xl font-semibold text-zinc-800">Nie znaleziono strony</h1>
      <p className="text-sm text-zinc-500">Strona, której szukasz, nie istnieje lub została przeniesiona.</p>
      <Link href="/login" className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors">
        Przejdź do logowania
      </Link>
    </div>
  )
}