-- Pending actions queue: async work items awaiting execution by the agent
DROP TABLE IF EXISTS public.pending_actions_queue CASCADE;

CREATE TABLE public.pending_actions_queue (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id       UUID NOT NULL REFERENCES public.organizations(id),
    payload      JSONB NOT NULL,         -- The intent to be executed (Jira/GitHub/etc.)
    status       TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    retry_count  INT DEFAULT 0,
    last_error   TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Index for FIFO processing
CREATE INDEX IF NOT EXISTS idx_pending_actions_fifo
    ON public.pending_actions_queue (created_at)
    WHERE status = 'pending';
