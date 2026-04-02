-- The Core Subscription Engine (vendor-agnostic billing)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    waitlist_id UUID REFERENCES public.waitlist(id) ON DELETE CASCADE,

    -- Tier Configuration (Matches pmu.sg/waitlist)
    plan_type TEXT DEFAULT 'pilot', -- 'pilot', 'lite', 'pro', 'corporate'
    status TEXT DEFAULT 'active',   -- 'active', 'past_due', 'canceled'

    -- Usage Tracking
    tasks_created_this_month INT DEFAULT 0, -- Resets monthly for Lite (limit 100)
    pilot_tasks_used INT DEFAULT 0,         -- Hard cap of 10 for Pilot
    projects_active INT DEFAULT 1,          -- S$49 per project logic

    -- Vendor-Agnostic Billing Integration
    billing_provider TEXT,                  -- 'stripe', 'paypal', 'hitpay', 'manual'
    external_customer_id TEXT UNIQUE,       -- The ID in their system
    external_subscription_id TEXT UNIQUE,   -- The Subscription reference
    current_period_end TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT check_plan_type CHECK (plan_type IN ('pilot', 'lite', 'pro', 'corporate'))
);

CREATE INDEX IF NOT EXISTS idx_sub_waitlist_id ON public.subscriptions(waitlist_id);
