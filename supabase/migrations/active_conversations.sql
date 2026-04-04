-- Active conversations: tracks state to prevent duplicate ticket creation
-- Consolidated from: active_conversations.sql, alter_rename_jira_columns.sql,
--                    alter_add_system_status_fks.sql, drop_legacy_status_columns.sql
CREATE TABLE IF NOT EXISTS public.active_conversations (
    phone_number        TEXT PRIMARY KEY,
    last_pm_issue_key   TEXT,
    last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
    status_fk           INT REFERENCES public.system_status(id) ON UPDATE CASCADE ON DELETE RESTRICT
);
