import { getStripeClient } from '@/domains/payments/stripe-client'
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

  // Obsługa zdarzeń zostanie dodana w kolejnych krokach (status płatności w DB).
  console.log('[Stripe webhook] Otrzymano zdarzenie:', event.type)

  return Response.json({ received: true })
}
