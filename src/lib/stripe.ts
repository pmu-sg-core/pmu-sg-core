import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
});

export const PLAN_PRICES: Record<string, string> = {
  lite:      process.env.STRIPE_PRICE_LITE!,
  pro:       process.env.STRIPE_PRICE_PRO!,
  corporate: process.env.STRIPE_PRICE_CORPORATE!,
};
