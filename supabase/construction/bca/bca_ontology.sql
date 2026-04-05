-- BCA Site Management — Ontology seed data
-- Extends existing business_functions, intent_taxonomy, system_adapters,
-- system_status, retention_policies, and plan_entitlements.
-- Run BEFORE site_projects.sql and site_diary.sql.

-- ── 1. Business Function ──────────────────────────────────────────────────────

INSERT INTO public.business_functions (code, name, is_active)
VALUES ('bca', 'BCA Site Management', TRUE)
ON CONFLICT (code) DO NOTHING;

-- ── 2. Intent Taxonomy ────────────────────────────────────────────────────────

INSERT INTO public.intent_taxonomy (function_id, code, label, is_active)
SELECT bf.id, t.code, t.label, TRUE
FROM public.business_functions bf
JOIN (VALUES
    ('bca.site_diary_create',   'Site Diary Entry'),
    ('bca.site_diary_query',    'Site Diary Query'),
    ('bca.site_incident_report','Site Incident Report')
) AS t(code, label) ON bf.code = 'bca'
ON CONFLICT (code) DO NOTHING;

-- ── 3. System Adapter ─────────────────────────────────────────────────────────

INSERT INTO public.system_adapters (code, name, function_id, is_active)
SELECT 'sgbuildex', 'SGBuildex (BCA Portal)', bf.id, FALSE
FROM public.business_functions bf WHERE bf.code = 'bca'
ON CONFLICT (code) DO NOTHING;

-- ── 4. Status Lifecycle (site_diary domain) ───────────────────────────────────

INSERT INTO public.system_status (domain, status_code, label, description, is_terminal, sort_order) VALUES
('site_diary', 'draft',              'Draft',              'Entry extracted, not yet validated by RE/PM',      FALSE, 1),
('site_diary', 'pending_validation', 'Pending Validation', 'Awaiting human-in-the-loop sign-off (IMDA gate)',  FALSE, 2),
('site_diary', 'submitted',          'Submitted',          'Validated and logged — ready for BCA/SGBuildex',   FALSE, 3),
('site_diary', 'archived',           'Archived',           'Entry closed; meets BCA 7-year retention rule',    TRUE,  4)
ON CONFLICT (domain, status_code) DO NOTHING;

-- ── 5. Retention Policies (BCA regulatory = 7 years minimum) ─────────────────

INSERT INTO public.retention_policies
    (function_id, entity_type, retention_days, storage_tier, legal_basis, plan_tier_id)
SELECT
    bf.id,
    t.entity_type,
    t.retention_days,
    t.storage_tier,
    t.legal_basis,
    pt.id
FROM public.business_functions bf
CROSS JOIN (VALUES
    ('message',     90,    'warm',      'contract'),
    ('workitem',    2555,  'cold',      'legal_obligation'),  -- 7 years
    ('audit_event', -1,    'permanent', 'legal_obligation')   -- permanent
) AS t(entity_type, retention_days, storage_tier, legal_basis)
CROSS JOIN public.plan_tiers pt
WHERE bf.code = 'bca'
ON CONFLICT (function_id, entity_type, plan_tier_id) DO NOTHING;

-- ── 6. Plan Entitlements ──────────────────────────────────────────────────────

INSERT INTO public.plan_entitlements (plan_tier_id, entitlement_type, max_value)
SELECT pt.id, t.entitlement_type, t.max_value
FROM public.plan_tiers pt
JOIN (VALUES
    ('pilot',     'max_site_diary_entries_per_day', 1),
    ('lite',      'max_site_diary_entries_per_day', 3),
    ('pro',       'max_site_diary_entries_per_day', 10),
    ('corporate', 'max_site_diary_entries_per_day', -1)
) AS t(plan_type, entitlement_type, max_value) ON pt.plan_type = t.plan_type
ON CONFLICT (plan_tier_id, entitlement_type) DO NOTHING;
