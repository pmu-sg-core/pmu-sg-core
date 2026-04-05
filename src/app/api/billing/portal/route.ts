import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { subscriptionId } = await req.json();

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Missing subscriptionId' }, { status: 400 });
    }

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('external_customer_id')
      .eq('id', subscriptionId)
      .single();

    const customerId = sub?.external_customer_id as string | undefined;
    if (!customerId) {
      return NextResponse.json({ error: 'No Stripe customer found for this subscription' }, { status: 404 });
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[billing/portal]', error);
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
  }
}
