-- Governance: block specific numbers or identities from triggering work items
DROP TABLE IF EXISTS public.governance_blacklist CASCADE;

CREATE TABLE public.governance_blacklist (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    identity   TEXT UNIQUE NOT NULL,    -- phone number, email, Teams user ID, or handle
    reason     TEXT,
    blocked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_blacklist_identity
    ON public.governance_blacklist (identity);
