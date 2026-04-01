-- WhatsApp message logs for Miyu agent processing
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wa_id TEXT UNIQUE,               -- The unique message ID from Meta
    sender_number TEXT NOT NULL,      -- The customer's phone number
    message_body TEXT,                -- The actual text they sent
    jira_issue_key TEXT,              -- The resulting Jira ID (e.g., WS-101)
    status TEXT DEFAULT 'received',   -- 'received', 'processed', 'error'
    error_log TEXT,                   -- Stores any Jira API errors for debugging
    raw_payload JSONB,                -- The full JSON from Meta (crucial for MVP)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups by phone number
CREATE INDEX IF NOT EXISTS idx_whatsapp_sender ON public.whatsapp_logs(sender_number);

-- Enable Realtime for live frontend updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_logs;
