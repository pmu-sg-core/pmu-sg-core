-- Subscriber: owner of a subscription — individual or organisation
DROP TABLE IF EXISTS public.subscriber CASCADE;

CREATE TABLE public.subscriber (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_type  TEXT NOT NULL CHECK (subscriber_type IN ('individual', 'organisation')),
    display_name     TEXT NOT NULL,
    email            TEXT UNIQUE NOT NULL,
    country_code     TEXT DEFAULT 'SG',
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Link subscriptions to subscriber (nullable — populated during Phase 2 onboarding)
ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS subscriber_id UUID REFERENCES public.subscriber(id) ON DELETE SET NULL;

-- Link organisations to subscriber (nullable — populated during Phase 2 onboarding)
ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS subscriber_id UUID REFERENCES public.subscriber(id) ON DELETE SET NULL;
