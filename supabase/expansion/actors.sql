-- Actors: entity registry for all communication participants
-- Phase 1: human + bot only
CREATE TABLE IF NOT EXISTS public.actors (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type   TEXT NOT NULL CHECK (actor_type IN ('human', 'bot', 'system', 'channel')),
    display_name TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Actor identities: resolves same human across multiple channels
CREATE TABLE IF NOT EXISTS public.actor_identities (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    UUID NOT NULL REFERENCES public.actors(id) ON DELETE CASCADE,
    channel_id  UUID NOT NULL REFERENCES public.channels(id),
    external_id TEXT NOT NULL,   -- phone number, Teams user ID, Slack user ID, etc.
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (channel_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_actor_identities_actor    ON public.actor_identities(actor_id);
CREATE INDEX IF NOT EXISTS idx_actor_identities_external ON public.actor_identities(channel_id, external_id);

-- Seed Miyu bot as a first-class actor
INSERT INTO public.actors (id, actor_type, display_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'bot', 'Miyu')
ON CONFLICT (id) DO NOTHING;
