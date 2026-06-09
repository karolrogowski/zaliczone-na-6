import 'server-only'
import Stripe from 'stripe'

let cached: Stripe | null = null

/** Singleton klienta Stripe (server-side). Wymaga STRIPE_SECRET_KEY w .env.local. */
export function getStripeClient(): Stripe {
  if (cached) return cached

  const apiKey = process.env.STRIPE_SECRET_KEY
  if (!apiKey) {
    throw new Error('Brak STRIPE_SECRET_KEY w zmiennych środowiskowych — zobacz .env.local.example')
  }

  cached = new Stripe(apiKey)
  return cached
}
