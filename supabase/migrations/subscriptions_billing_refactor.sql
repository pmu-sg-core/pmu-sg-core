-- Migrate subscriptions from Stripe-specific to vendor-agnostic billing fields
ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS billing_provider TEXT,
    ADD COLUMN IF NOT EXISTS external_customer_id TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS external_subscription_id TEXT UNIQUE;

-- Migrate existing Stripe data if present
UPDATE public.subscriptions
SET
    billing_provider = 'stripe',
    external_customer_id = stripe_customer_id,
    external_subscription_id = stripe_subscription_id
WHERE stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL;

-- Drop old Stripe-specific columns
ALTER TABLE public.subscriptions
    DROP COLUMN IF EXISTS stripe_customer_id,
    DROP COLUMN IF EXISTS stripe_subscription_id;
