-- Governance: Block specific numbers or identities from triggering Jira tickets
CREATE TABLE IF NOT EXISTS public.governance_blacklist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    identity TEXT UNIQUE, -- Phone number, email, or handle
    reason TEXT,
    blocked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup during message processing
CREATE INDEX IF NOT EXISTS idx_governance_blacklist_identity
ON public.governance_blacklist (identity);
