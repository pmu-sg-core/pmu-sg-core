-- Communication logs: platform-agnostic outbound message capture
-- Consolidated from: communication_logs.sql, alter_rename_jira_columns.sql,
--                    alter_add_system_status_fks.sql, drop_legacy_status_columns.sql
CREATE TABLE IF NOT EXISTS public.communication_logs (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform            TEXT NOT NULL,          -- 'whatsapp', 'teams', 'slack', 'telegram', 'signal'
    platform_message_id TEXT UNIQUE,
    sender_id           TEXT NOT NULL,
    message_body        TEXT,
    pm_issue_key        TEXT,
    error_log           TEXT,
    raw_payload         JSONB,
    status_fk           INT REFERENCES public.system_status(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_logs_sender   ON public.communication_logs(sender_id);
CREATE INDEX IF NOT EXISTS idx_comm_logs_platform ON public.communication_logs(platform);
