import { getStripeClient } from '@/domains/payments/stripe-client'
import { updatePaymentStatus } from '@/domains/payments/status'
import type Stripe from 'stripe'

/**
 * Webhook Stripe — odbiera asynchroniczne zdarzenia płatności.
 * Weryfikacja podpisu chroni przed sfałszowanymi żądaniami (każdy mógłby
 * inaczej wysłać POST z dowolnym payloadem i np. oznaczyć płatność jako opłaconą).
 */
export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    return Response.json({ error: 'Brak podpisu lub konfiguracji webhooka' }, { status: 400 })
  }

  const payload = await req.text()

  let event: Stripe.Event
  try {
    event = getStripeClient().webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (err) {
    console.error('[Stripe webhook] Nieprawidłowy podpis:', err)
    return Response.json({ error: 'Nieprawidłowy podpis' }, { status: 400 })
  }

  switch (event.type) {
    case 'payment_intent.amount_capturable_updated': {
      const pi = event.data.object as Stripe.PaymentIntent
      await updatePaymentStatus(pi.id, 'authorized')
      break
    }
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent
      await updatePaymentStatus(pi.id, 'paid')
      break
    }
    case 'charge.captured': {
      const charge = event.data.object as Stripe.Charge
      const paymentIntentId =
        typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
      if (paymentIntentId) {
        await updatePaymentStatus(paymentIntentId, 'captured', { stripe_charge_id: charge.id })
      }
      break
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent
      await updatePaymentStatus(pi.id, 'failed')
      break
    }
    case 'payment_intent.canceled': {
      const pi = event.data.object as Stripe.PaymentIntent
      await updatePaymentStatus(pi.id, 'cancelled')
      break
    }
    default:
      console.log('[Stripe webhook] Nieobsłużone zdarzenie:', event.type)
  }

  return Response.json({ received: true })
}
