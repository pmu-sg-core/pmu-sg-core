-- Tracks active conversations to prevent duplicate ticket creation
CREATE TABLE IF NOT EXISTS public.active_conversations (
    phone_number TEXT PRIMARY KEY,
    last_pm_issue_key TEXT,      -- The last task this person opened (e.g. PMU-101)
    last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
    conversation_state TEXT      -- e.g., 'awaiting_description', 'idle'
);
