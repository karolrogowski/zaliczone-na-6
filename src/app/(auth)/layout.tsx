export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-zinc-900">Zaliczone na 6</h1>
          <p className="mt-1 text-sm text-zinc-500">Korepetycje on-demand</p>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-sm border border-zinc-100">
          {children}
        </div>
      </div>
    </div>
  )
}
