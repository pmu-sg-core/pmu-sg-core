import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-03-25.dahlia',
    });
  }
  return _stripe;
}

export function getPlanPrices(): Record<string, string> {
  return {
    lite: process.env.STRIPE_PRICE_LITE!,
    pro:  process.env.STRIPE_PRICE_PRO!,
    // corporate is invite-only — handled manually, no Stripe price ID
  };
}
