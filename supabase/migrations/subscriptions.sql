-- Subscriptions: vendor-agnostic billing and plan management
-- Consolidated from: subscriptions.sql, subscriptions_billing_refactor.sql,
--                    alter_subscriptions_add_whatsapp.sql,
--                    alter_subscriptions_add_teams_user_id.sql,
--                    alter_add_system_status_fks.sql
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    waitlist_id                 UUID REFERENCES public.waitlist(id) ON DELETE CASCADE,

    -- Tier Configuration
    plan_type                   TEXT DEFAULT 'pilot',
    CONSTRAINT check_plan_type  CHECK (plan_type IN ('pilot', 'lite', 'pro', 'corporate')),

    -- Usage Tracking
    tasks_created_this_month    INT DEFAULT 0,
    pilot_tasks_used            INT DEFAULT 0,
    projects_active             INT DEFAULT 1,

    -- Vendor-Agnostic Billing
    billing_provider            TEXT,           -- 'stripe', 'paypal', 'hitpay', 'manual'
    external_customer_id        TEXT UNIQUE,
    external_subscription_id    TEXT UNIQUE,
    current_period_end          TIMESTAMPTZ,

    -- Channel Identities
    whatsapp_number             TEXT UNIQUE,
    teams_user_id               TEXT UNIQUE,

    -- Normalised Status
    status_fk                   INT REFERENCES public.system_status(id) ON UPDATE CASCADE ON DELETE RESTRICT,

    created_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_waitlist_id      ON public.subscriptions(waitlist_id);
CREATE INDEX IF NOT EXISTS idx_sub_whatsapp_number  ON public.subscriptions(whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_sub_teams_user_id    ON public.subscriptions(teams_user_id);

ALTER TABLE public.subscriptions
    ADD CONSTRAINT fk_sub_plan_type
    FOREIGN KEY (plan_type) REFERENCES public.plan_tiers(plan_type);
