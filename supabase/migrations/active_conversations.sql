-- Active conversations: tracks per-channel state to prevent duplicate ticket creation
-- Consolidated from: active_conversations.sql, alter_rename_jira_columns.sql,
--                    alter_add_system_status_fks.sql, drop_legacy_status_columns.sql
DROP TABLE IF EXISTS public.active_conversations CASCADE;

CREATE TABLE public.active_conversations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id           TEXT NOT NULL,      -- phone number, Teams user ID, or any channel identity
    channel             TEXT NOT NULL,      -- 'whatsapp', 'teams', 'slack', etc.
    last_pm_issue_key   TEXT,
    last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
    status_fk           INT REFERENCES public.system_status(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    UNIQUE (sender_id, channel)             -- one active conversation per sender per channel
);
