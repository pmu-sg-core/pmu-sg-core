-- ============================================================
-- BCA Flow Test Data — CloudLabHub
-- Email: admin@cloudlabhub.sg
-- Phone: +6597106689
-- Run in Supabase SQL editor (project: qpwpcdvqntumbnayimgn)
-- ============================================================

BEGIN;

-- 1. Subscriber — upsert by email (safe to re-run)
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
    uen         = EXCLUDED.uen,
    sector      = EXCLUDED.sector,
    sector_tags = EXCLUDED.sector_tags;

-- 2. Subscription — update existing row by phone number
-- Links the subscriber only; plan_type is left as-is
UPDATE public.subscriptions
SET subscriber_id = 'bb000001-0000-0000-0000-000000000001'
WHERE whatsapp_number = '+6597106689';

-- 3. Site Project — upsert linked to the subscription above
INSERT INTO public.site_projects (
    id, subscription_id, project_ref, uen, project_name, address,
    lat, long, geolocation_verified
)
SELECT
    'bb000003-0000-0000-0000-000000000003',
    sub.id,
    '202500001A-PRJ001',
    '202500001A',
    'Toa Payoh Integrated Hub — Block A',
    '1 Toa Payoh Lor 8, Singapore 319253',
    1.331974, 103.848465,
    FALSE
FROM public.subscriptions sub
WHERE sub.whatsapp_number = '+6597106689'
ON CONFLICT (subscription_id, project_ref) DO NOTHING;

COMMIT;


-- ============================================================
-- Verification — run separately after seeding
-- ============================================================

SELECT
    sub.id              AS subscription_id,
    sub.plan_type,
    sr.email,
    sr.sector,
    sr.sector_tags,
    sr.uen,
    sp.id               AS site_project_id,
    sp.project_ref,
    sp.project_name
FROM public.subscriptions sub
LEFT JOIN public.subscriber sr ON sr.id = sub.subscriber_id
LEFT JOIN public.site_projects sp ON sp.subscription_id = sub.id
WHERE sub.whatsapp_number = '+6597106689';
