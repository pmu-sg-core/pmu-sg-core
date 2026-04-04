-- Support multiple conversation records per sender+channel.
-- Only one active conversation per sender+channel is enforced via partial unique index.
-- Inactive records are retained for audit; retention rules handle eventual cleanup.

-- 1. Drop the single-row unique constraint
ALTER TABLE public.active_conversations
    DROP CONSTRAINT IF EXISTS active_conversations_sender_id_channel_key;

-- 2. Add is_active flag (existing rows are all considered active)
ALTER TABLE public.active_conversations
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 3. Enforce one active conversation per sender+channel
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_conversation
    ON public.active_conversations (sender_id, channel)
    WHERE is_active = TRUE;
