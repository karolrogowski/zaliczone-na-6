'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '')

export function CheckoutForm({ clientSecret }: { clientSecret: string }) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentForm />
    </Elements>
  )
}

function PaymentForm() {
  const stripe = useStripe()
  const elements = useElements()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setIsSubmitting(true)
    setErrorMessage(null)

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard?payment=success`,
      },
      redirect: 'if_required',
    })

    if (error) {
      setErrorMessage(error.message ?? 'Płatność nie powiodła się. Spróbuj ponownie.')
      setIsSubmitting(false)
      return
    }

    window.location.href = '/dashboard?payment=success'
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#e8e6de] rounded-[12px] p-5">
      <PaymentElement />

      {errorMessage && (
        <p className="mt-4 text-[13px] text-red-600">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={!stripe || isSubmitting}
        className="mt-5 w-full px-[22px] py-[11px] bg-[#185FA5] text-white text-[13px] font-medium rounded-[9px] hover:bg-[#0C447C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ boxShadow: '0 1px 0 rgba(12,68,124,0.3)' }}
      >
        {isSubmitting ? 'Przetwarzanie…' : 'Zapłać'}
      </button>
    </form>
  )
}
