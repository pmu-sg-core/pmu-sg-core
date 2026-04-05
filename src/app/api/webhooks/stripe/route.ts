import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';
import type Stripe from 'stripe';

// Stripe requires the raw body for signature verification — disable body parsing
export const runtime = 'nodejs';

async function getStatusId(statusCode: string): Promise<number | null> {
  const { data } = await supabase
    .from('system_status')
    .select('id')
    .eq('domain', 'subscription')
    .eq('status_code', statusCode)
    .single();
  return data?.id ?? null;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const subscriptionId = session.metadata?.subscription_id;
  if (!subscriptionId) return;

  const stripeSubId = session.subscription as string;
  const stripeCustomerId = session.customer as string;
  const plan = session.metadata?.plan ?? 'lite';

  // Fetch period end from the Stripe subscription
  const stripeSub = await getStripe().subscriptions.retrieve(stripeSubId);
  const periodEnd = new Date((stripeSub as any).current_period_end * 1000).toISOString();

  const activeStatusId = await getStatusId('active');

  await supabase
    .from('subscriptions')
    .update({
      external_customer_id: stripeCustomerId,
      external_subscription_id: stripeSubId,
      billing_provider: 'stripe',
      plan_type: plan,
      current_period_end: periodEnd,
      ...(activeStatusId ? { status_fk: activeStatusId } : {}),
    })
    .eq('id', subscriptionId);
}

async function handleSubscriptionUpdated(stripeSub: Stripe.Subscription) {
  const subscriptionId = stripeSub.metadata?.subscription_id;
  if (!subscriptionId) return;

  const periodEnd = new Date((stripeSub as any).current_period_end * 1000).toISOString();

  const statusMap: Record<string, string> = {
    active:   'active',
    trialing: 'trialing',
    past_due: 'suspended',
    canceled: 'cancelled',
    unpaid:   'suspended',
    paused:   'suspended',
  };
  const statusCode = statusMap[stripeSub.status] ?? 'suspended';
  const statusId = await getStatusId(statusCode);

  await supabase
    .from('subscriptions')
    .update({
      current_period_end: periodEnd,
      ...(statusId ? { status_fk: statusId } : {}),
    })
    .eq('external_subscription_id', stripeSub.id);
}

async function handleSubscriptionDeleted(stripeSub: Stripe.Subscription) {
  const cancelledStatusId = await getStatusId('cancelled');
  await supabase
    .from('subscriptions')
    .update({
      ...(cancelledStatusId ? { status_fk: cancelledStatusId } : {}),
      current_period_end: new Date().toISOString(),
    })
    .eq('external_subscription_id', stripeSub.id);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const stripeSubId = (invoice as any).subscription as string | null;
  if (!stripeSubId) return;
  const suspendedStatusId = await getStatusId('suspended');
  if (!suspendedStatusId) return;
  await supabase
    .from('subscriptions')
    .update({ status_fk: suspendedStatusId })
    .eq('external_subscription_id', stripeSubId);
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        // Ignore unhandled event types
        break;
    }
  } catch (err) {
    console.error(`[stripe/webhook] Error handling ${event.type}:`, err);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
