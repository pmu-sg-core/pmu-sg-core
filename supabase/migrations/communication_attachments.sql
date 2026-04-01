-- The 'Multi-Platform, Multi-File' Attachment Table
CREATE TABLE IF NOT EXISTS public.communication_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    comm_log_id UUID REFERENCES public.communication_logs(id) ON DELETE CASCADE,

    -- File Metadata
    file_name TEXT,            -- e.g., 'invoice.pdf' or 'screenshot.png'
    file_type TEXT,            -- e.g., 'image/jpeg', 'application/pdf'
    file_size_bytes BIGINT,

    -- Platform Specific IDs
    external_media_id TEXT,    -- The ID from Meta/Telegram/Slack

    -- Storage & Integration
    storage_path TEXT,         -- The path in your Supabase 'attachments' bucket
    jira_attachment_id TEXT,   -- The ID returned by Jira after upload

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups when Jira pings back or for audit views
CREATE INDEX IF NOT EXISTS idx_attachment_log_id ON public.communication_attachments(comm_log_id);
