import { MfaEnrollForm } from '@/domains/admin/components/MfaEnrollForm'

export default function MfaEnrollPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-white p-8 shadow-sm border border-zinc-200">
          <MfaEnrollForm />
        </div>
      </div>
    </div>
  )
}
