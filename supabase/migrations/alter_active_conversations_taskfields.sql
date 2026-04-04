-- Store partial task fields collected during multi-turn gathering.
-- Code drives field ordering and completion checks; the LLM only extracts values.
ALTER TABLE public.active_conversations
    ADD COLUMN IF NOT EXISTS task_fields JSONB DEFAULT '{}';
