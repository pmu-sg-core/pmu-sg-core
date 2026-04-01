CREATE TABLE pending_actions_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id),
  payload JSONB NOT NULL,            -- The intent to be executed (Jira/GitHub/etc.)
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Index for FIFO processing
CREATE INDEX idx_pending_actions_fifo ON pending_actions_queue (created_at) 
WHERE status = 'pending';