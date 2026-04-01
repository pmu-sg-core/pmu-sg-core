CREATE TABLE audit_vault (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hash_signature TEXT NOT NULL,      -- Cryptographic hash of the transaction
  previous_hash TEXT,                -- Blockchain-style chaining for integrity
  actor_bsuid TEXT NOT NULL,
  reasoning_trace JSONB NOT NULL,    -- The full ReAct "thought" process
  action_taken TEXT,                 -- e.g., "Created Jira Ticket PROJ-123"
  model_version TEXT,                -- Traceability for which LLM version was used
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enforce Immutability (The "Legal Shield")
CREATE RULE no_update_audit AS ON UPDATE TO audit_vault DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO audit_vault DO INSTEAD NOTHING;