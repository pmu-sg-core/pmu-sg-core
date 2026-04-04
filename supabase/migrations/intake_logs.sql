-- Intake logs: platform-agnostic inbound message capture
-- Consolidated from: whatsapp_logs.sql, alter_rename_whatsapp_tables.sql,
--                    drop_legacy_whatsapp_columns.sql, alter_add_system_status_fks.sql
CREATE TABLE IF NOT EXISTS public.intake_logs (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform_message_id TEXT UNIQUE,
    sender_id           TEXT NOT NULL,
    message_body        TEXT,
    pm_issue_key        TEXT,
    error_log           TEXT,
    raw_payload         JSONB,
    status_fk           INT REFERENCES public.system_status(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_logs_sender ON public.intake_logs(sender_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.intake_logs;
