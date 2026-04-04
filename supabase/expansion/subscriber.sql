-- Subscriber: owner of a subscription — individual or organisation
CREATE TABLE IF NOT EXISTS public.subscriber (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_type  TEXT NOT NULL CHECK (subscriber_type IN ('individual', 'organisation')),
    display_name     TEXT NOT NULL,
    email            TEXT UNIQUE NOT NULL,
    country_code     TEXT DEFAULT 'SG',
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Link subscriptions to subscriber
ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS subscriber_id UUID REFERENCES public.subscriber(id);

-- Link organisations to subscriber
ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS subscriber_id UUID REFERENCES public.subscriber(id);
