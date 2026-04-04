-- Active conversations: tracks per-channel state for multi-turn task collection.
-- Consolidated from: active_conversations.sql, alter_rename_jira_columns.sql,
--                    alter_add_system_status_fks.sql, drop_legacy_status_columns.sql,
--                    alter_active_conversations_multirecord.sql,
--                    alter_active_conversations_taskfields.sql
DROP TABLE IF EXISTS public.active_conversations CASCADE;

CREATE TABLE public.active_conversations (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id            TEXT        NOT NULL,       -- phone number, Teams user ID, or any channel identity
    channel              TEXT        NOT NULL,       -- 'whatsapp', 'teams', 'slack', etc.
    is_active            BOOLEAN     NOT NULL DEFAULT TRUE,  -- FALSE once superseded by a new conversation
    last_pm_issue_key    TEXT,
    last_interaction_at  TIMESTAMPTZ DEFAULT NOW(),
    status_fk            INT         REFERENCES public.system_status(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    conversation_history JSONB       DEFAULT '[]',   -- last N exchanges: [{role, content}]
    gathering_task       BOOLEAN     DEFAULT FALSE,  -- true while Miyu is collecting task details
    task_fields          JSONB       DEFAULT '{}'    -- partial field state during multi-turn gathering
);

-- One active conversation per sender per channel; inactive records kept for audit.
CREATE UNIQUE INDEX unique_active_conversation
    ON public.active_conversations (sender_id, channel)
    WHERE is_active = TRUE;
