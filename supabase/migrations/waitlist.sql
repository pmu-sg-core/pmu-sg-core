-- Waitlist: landing page signups and omni-channel identity linking
-- Consolidated from: waitlist.sql, waitlist_add_identity_columns.sql
CREATE TABLE IF NOT EXISTS public.waitlist (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    first_name      TEXT,
    last_name       TEXT,
    company         TEXT,
    reason          TEXT,
    source          TEXT NOT NULL DEFAULT 'landing_page',
    phone           TEXT,
    telegram_handle TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_identity ON public.waitlist(phone, email);

-- Service role only access
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
    ON public.waitlist
    FOR ALL
    USING (auth.role() = 'service_role');
