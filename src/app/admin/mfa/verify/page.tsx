import { MfaVerifyForm } from '@/domains/admin/components/MfaVerifyForm'

export default function MfaVerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-white p-8 shadow-sm border border-zinc-200">
          <MfaVerifyForm />
        </div>
      </div>
    </div>
  )
}
