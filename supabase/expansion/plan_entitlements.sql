-- Plan entitlements: flexible per-tier limits replacing flat config columns
-- Add new entitlement_type rows to extend without schema changes
DROP TABLE IF EXISTS public.plan_entitlements CASCADE;

CREATE TABLE public.plan_entitlements (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_tier_id     UUID NOT NULL REFERENCES public.plan_tiers(id) ON DELETE CASCADE,
    entitlement_type TEXT NOT NULL,   -- 'max_channels', 'max_humans', 'max_recipients', etc.
    max_value        INT NOT NULL,    -- -1 = unlimited
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (plan_tier_id, entitlement_type)
);

-- Seed entitlements per plan tier
INSERT INTO public.plan_entitlements (plan_tier_id, entitlement_type, max_value)
SELECT pt.id, t.entitlement_type, t.max_value
FROM public.plan_tiers pt
JOIN (VALUES
    ('pilot',     'max_channels',           1),
    ('pilot',     'max_humans',             1),
    ('pilot',     'max_recipients',         1),
    ('pilot',     'max_workitems_per_month',10),
    ('pilot',     'max_system_connections', 1),
    ('pilot',     'max_threads',            1),
    ('lite',      'max_channels',           2),
    ('lite',      'max_humans',             5),
    ('lite',      'max_recipients',         5),
    ('lite',      'max_workitems_per_month',50),
    ('lite',      'max_system_connections', 2),
    ('lite',      'max_threads',            5),
    ('pro',       'max_channels',           4),
    ('pro',       'max_humans',             20),
    ('pro',       'max_recipients',         20),
    ('pro',       'max_workitems_per_month',200),
    ('pro',       'max_system_connections', 5),
    ('pro',       'max_threads',            20),
    ('corporate', 'max_channels',           -1),
    ('corporate', 'max_humans',             -1),
    ('corporate', 'max_recipients',         -1),
    ('corporate', 'max_workitems_per_month',-1),
    ('corporate', 'max_system_connections', -1),
    ('corporate', 'max_threads',            -1)
) AS t(plan_type, entitlement_type, max_value) ON pt.plan_type = t.plan_type
ON CONFLICT (plan_tier_id, entitlement_type) DO NOTHING;
