import { AdminLoginForm } from '@/domains/admin/components/AdminLoginForm'

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
            Panel administracyjny
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">Zaliczone na 6</h1>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-sm border border-zinc-200">
          <h2 className="mb-6 text-lg font-semibold text-zinc-900">Logowanie</h2>
          <AdminLoginForm />
        </div>
      </div>
    </div>
  )
}
