import type Stripe from 'stripe'

/**
 * Korepetytorzy nie mają własnych stron — Stripe wymaga business_profile,
 * żeby aktywować wypłaty. product_description samo wystarcza (bez url);
 * adres platformy dodajemy tylko gdy jest publiczny, bo lokalny origin
 * (np. localhost) Stripe odrzuca jako "Not a valid URL".
 */
export function buildConnectBusinessProfile(siteUrl?: string): Stripe.AccountCreateParams.BusinessProfile {
  return {
    ...(siteUrl ? { url: siteUrl } : {}),
    product_description: 'Korepetycje online przez platformę Zaliczone na 6',
  }
}
