-- Retention policies: per business function × entity type × plan retention rules
-- Drives tiered storage, PDPA compliance, and data lifecycle management
CREATE TABLE IF NOT EXISTS public.retention_policies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    function_id   UUID NOT NULL REFERENCES public.business_functions(id),
    entity_type     TEXT NOT NULL,       -- 'message', 'workitem', 'audit_event', 'consent'
    retention_days  INT NOT NULL,        -- -1 = permanent
    storage_tier    TEXT NOT NULL CHECK (storage_tier IN ('hot', 'warm', 'cold', 'permanent')),
    legal_basis     TEXT,                -- PDPA purpose (e.g. 'contract', 'employment', 'legal_obligation')
    plan_tier_id    UUID REFERENCES public.plan_tiers(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (function_id, entity_type, plan_tier_id)
);

-- Seed PM business function retention policies
INSERT INTO public.retention_policies (function_id, entity_type, retention_days, storage_tier, legal_basis, plan_tier_id)
SELECT d.id, t.entity_type, t.retention_days, t.storage_tier, t.legal_basis, pt.id
FROM public.business_functions d
CROSS JOIN public.plan_tiers pt
JOIN (VALUES
    ('pm', 'message',     30,  'hot',       NULL,              'pilot'),
    ('pm', 'message',     90,  'warm',      NULL,              'lite'),
    ('pm', 'message',     365, 'warm',      NULL,              'pro'),
    ('pm', 'message',     -1,  'cold',      NULL,              'corporate'),
    ('pm', 'workitem',    365, 'warm',      'contract',        'pilot'),
    ('pm', 'workitem',    365, 'warm',      'contract',        'lite'),
    ('pm', 'workitem',    -1,  'permanent', 'contract',        'pro'),
    ('pm', 'workitem',    -1,  'permanent', 'contract',        'corporate'),
    ('pm', 'audit_event', -1,  'permanent', 'legal_obligation','pilot'),
    ('pm', 'audit_event', -1,  'permanent', 'legal_obligation','lite'),
    ('pm', 'audit_event', -1,  'permanent', 'legal_obligation','pro'),
    ('pm', 'audit_event', -1,  'permanent', 'legal_obligation','corporate')
) AS t(dept_code, entity_type, retention_days, storage_tier, legal_basis, plan_type)
  ON d.code = t.dept_code AND pt.plan_type = t.plan_type
ON CONFLICT (function_id, entity_type, plan_tier_id) DO NOTHING;

-- Finance & Legal: permanent by regulation (all tiers)
INSERT INTO public.retention_policies (function_id, entity_type, retention_days, storage_tier, legal_basis, plan_tier_id)
SELECT d.id, t.entity_type, t.retention_days, t.storage_tier, t.legal_basis, pt.id
FROM public.business_functions d
CROSS JOIN public.plan_tiers pt
JOIN (VALUES
    ('finance', 'audit_event', -1, 'permanent', 'legal_obligation'),
    ('finance', 'workitem',    -1, 'permanent', 'legal_obligation'),
    ('legal',   'audit_event', -1, 'permanent', 'legal_privilege'),
    ('legal',   'workitem',    -1, 'permanent', 'legal_privilege'),
    ('hr',      'audit_event', -1, 'permanent', 'employment'),
    ('hr',      'workitem',    -1, 'permanent', 'employment')
) AS t(dept_code, entity_type, retention_days, storage_tier, legal_basis)
  ON d.code = t.dept_code
ON CONFLICT (function_id, entity_type, plan_tier_id) DO NOTHING;
