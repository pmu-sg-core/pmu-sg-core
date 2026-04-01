-- Tracks active conversations to prevent duplicate ticket creation
CREATE TABLE IF NOT EXISTS public.active_conversations (
    phone_number TEXT PRIMARY KEY,
    last_jira_issue_key TEXT,    -- The last ticket this person opened
    last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
    conversation_state TEXT      -- e.g., 'awaiting_description', 'idle'
);
