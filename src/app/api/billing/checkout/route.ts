import { NextResponse } from 'next/server';
import { getStripe, getPlanPrices } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { subscriptionId, plan, email, name } = await req.json();

    if (!subscriptionId || !plan || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const stripe = getStripe();
    const priceId = getPlanPrices()[plan];
    if (!priceId) {
      return NextResponse.json({ error: `Unknown plan: ${plan}` }, { status: 400 });
    }

    // Retrieve or create Stripe customer
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('external_customer_id')
      .eq('id', subscriptionId)
      .single();

    let customerId = sub?.external_customer_id as string | undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: name ?? undefined,
        metadata: { subscription_id: subscriptionId },
      });
      customerId = customer.id;

      await supabase
        .from('subscriptions')
        .update({ external_customer_id: customerId, billing_provider: 'stripe' })
        .eq('id', subscriptionId);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/cancelled`,
      metadata: { subscription_id: subscriptionId, plan },
      subscription_data: {
        metadata: { subscription_id: subscriptionId, plan },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[billing/checkout]', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
