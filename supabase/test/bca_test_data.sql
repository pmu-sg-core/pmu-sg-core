-- ============================================================
-- BCA Flow Test Data — CloudLabHub
-- Email: admin@cloudlabhub.sg
-- Run in Supabase SQL editor (project: qpwpcdvqntumbnayimgn)
-- ============================================================

BEGIN;

-- 1. Subscriber (organisation, construction sector, BCA enabled)
INSERT INTO public.subscriber (
    id, subscriber_type, display_name, email, country_code,
    uen, sector, sector_tags
)
VALUES (
    'bb000001-0000-0000-0000-000000000001',
    'organisation',
    'CloudLabHub Pte Ltd',
    'admin@cloudlabhub.sg',
    'SG',
    '202500001A',
    'construction',
    '{bca}'
)
ON CONFLICT (email) DO UPDATE SET
    uen          = EXCLUDED.uen,
    sector       = EXCLUDED.sector,
    sector_tags  = EXCLUDED.sector_tags;

-- 2. Subscription (pro plan, linked to subscriber, test WhatsApp number)
INSERT INTO public.subscriptions (
    id, plan_type, whatsapp_number, subscriber_id,
    tasks_created_this_month, pilot_tasks_used
)
VALUES (
    'bb000002-0000-0000-0000-000000000002',
    'pro',
    '+6591234567',
    'bb000001-0000-0000-0000-000000000001',
    0, 0
)
ON CONFLICT (whatsapp_number) DO UPDATE SET
    plan_type     = EXCLUDED.plan_type,
    subscriber_id = EXCLUDED.subscriber_id;

-- 3. Site Project (linked to subscription above)
INSERT INTO public.site_projects (
    id, subscription_id, project_ref, uen, project_name, address,
    lat, long, geolocation_verified
)
VALUES (
    'bb000003-0000-0000-0000-000000000003',
    'bb000002-0000-0000-0000-000000000002',
    '202500001A-PRJ001',
    '202500001A',
    'Toa Payoh Integrated Hub — Block A',
    '1 Toa Payoh Lor 8, Singapore 319253',
    1.331974, 103.848465,
    FALSE
)
ON CONFLICT (subscription_id, project_ref) DO NOTHING;

COMMIT;


-- ============================================================
-- Verification query — run separately after seeding
-- ============================================================

-- SELECT
--     sub.plan_type,
--     sr.sector,
--     sr.sector_tags,
--     sr.uen,
--     sp.id            AS site_project_id,
--     sp.project_ref,
--     sp.project_name
-- FROM public.subscriptions sub
-- LEFT JOIN public.subscriber sr ON sr.id = sub.subscriber_id
-- LEFT JOIN public.site_projects sp ON sp.subscription_id = sub.id
-- WHERE sub.whatsapp_number = '+6591234567';
