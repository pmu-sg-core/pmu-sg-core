-- Communication attachments: multi-platform file tracking
CREATE TABLE IF NOT EXISTS public.communication_attachments (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    comm_log_id         UUID REFERENCES public.communication_logs(id) ON DELETE CASCADE,
    file_name           TEXT,
    file_type           TEXT,
    file_size_bytes     BIGINT,
    external_media_id   TEXT,       -- Platform-specific media ID (Meta, Telegram, Slack)
    storage_path        TEXT,       -- Supabase storage bucket path
    pm_attachment_id    TEXT,       -- ID returned by PM tool after upload
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachment_log_id ON public.communication_attachments(comm_log_id);
