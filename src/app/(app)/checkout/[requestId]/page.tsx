import { redirect } from 'next/navigation'
import { createClient } from '@/shared/supabase/server'
import { getCurrentUserOrNull } from '@/shared/auth/getCurrentUser'
import { createCheckoutSession } from '@/domains/payments/actions'
import { getSessionPriceGrosz } from '@/domains/payments/queries'
import { CheckoutForm } from './CheckoutForm'

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ requestId: string }>
}) {
  const { requestId } = await params

  const user = await getCurrentUserOrNull()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: request } = await supabase
    .from('matching_requests')
    .select('id, student_id')
    .eq('id', requestId)
    .maybeSingle()

  if (!request || request.student_id !== user.id) redirect('/dashboard')

  const result = await createCheckoutSession(requestId)
  if (!result.success) redirect('/dashboard')

  const priceGrosz = await getSessionPriceGrosz()

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 bg-white border-b border-[#e8e6de] px-[26px] py-4">
        <h1 className="text-[16px] font-medium text-[#2c2c2a]">Płatność za sesję</h1>
        <p className="text-[11px] text-[#888780] mt-[1px]">
          Kwota zostanie zablokowana na karcie i pobrana po zakończeniu sesji
        </p>
      </div>

      <div className="flex-1 overflow-auto p-[22px_26px] flex justify-center">
        <div className="w-full max-w-[480px]">
          <div className="bg-white border border-[#e8e6de] rounded-[12px] p-5 mb-4">
            <p className="text-[13px] text-[#5f5e5a]">Sesja korepetycji (60 min)</p>
            <p className="text-[24px] font-medium text-[#2c2c2a] mt-1">
              {(priceGrosz / 100).toFixed(2)} zł
            </p>
          </div>

          <CheckoutForm clientSecret={result.clientSecret} />
        </div>
      </div>
    </div>
  )
}
