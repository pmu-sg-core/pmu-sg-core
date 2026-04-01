-- Unified communication logs table (platform-agnostic: WhatsApp, Slack, Telegram, Signal)
CREATE TABLE IF NOT EXISTS public.communication_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform TEXT NOT NULL,          -- 'whatsapp', 'slack', 'telegram', 'signal'
    platform_message_id TEXT UNIQUE, -- Platform-specific message ID
    sender_id TEXT NOT NULL,         -- Phone number, Slack user ID, etc.
    message_body TEXT,
    jira_issue_key TEXT,
    status TEXT DEFAULT 'received',  -- 'received', 'processed', 'error'
    error_log TEXT,
    raw_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_logs_sender ON public.communication_logs(sender_id);
CREATE INDEX IF NOT EXISTS idx_comm_logs_platform ON public.communication_logs(platform);
