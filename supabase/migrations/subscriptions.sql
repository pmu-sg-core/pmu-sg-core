-- The Core Subscription Engine
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

    -- Stripe / Billing Integration
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT UNIQUE,
    current_period_end TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraint: Prevent illegal plan types
    CONSTRAINT check_plan_type CHECK (plan_type IN ('pilot', 'lite', 'pro', 'corporate'))
);

-- Index for the "Gatekeeper" lookup
CREATE INDEX IF NOT EXISTS idx_sub_waitlist_id ON public.subscriptions(waitlist_id);
