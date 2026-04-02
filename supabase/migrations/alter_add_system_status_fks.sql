-- Add status_fk column referencing system_status(id) on all relevant tables
-- Run this AFTER system_status.sql

-- ── 1. communication_logs ────────────────────────────────────────────────────
ALTER TABLE public.communication_logs
    ADD COLUMN IF NOT EXISTS status_fk INT REFERENCES public.system_status(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- Normalise legacy free-text values then backfill status_fk
UPDATE public.communication_logs SET status = 'pending'   WHERE status IN ('received');
UPDATE public.communication_logs SET status = 'delivered' WHERE status = 'processed';
UPDATE public.communication_logs SET status = 'failed'    WHERE status = 'error';

UPDATE public.communication_logs cl
SET status_fk = ss.id
FROM public.system_status ss
WHERE ss.domain = 'communication'
  AND ss.status_code = cl.status;

-- ── 2. active_conversations ──────────────────────────────────────────────────
ALTER TABLE public.active_conversations
    ADD COLUMN IF NOT EXISTS status_fk INT REFERENCES public.system_status(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- Default any unrecognised or NULL states to 'active'
UPDATE public.active_conversations SET conversation_state = 'active'
WHERE conversation_state IS NULL
   OR conversation_state NOT IN (
       SELECT status_code FROM public.system_status WHERE domain = 'conversation'
   );

UPDATE public.active_conversations ac
SET status_fk = ss.id
FROM public.system_status ss
WHERE ss.domain = 'conversation'
  AND ss.status_code = ac.conversation_state;

-- ── 3. subscriptions ─────────────────────────────────────────────────────────
ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS status_fk INT REFERENCES public.system_status(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- Default NULL subscription lifecycle status to 'active'
UPDATE public.subscriptions s
SET status_fk = ss.id
FROM public.system_status ss
WHERE ss.domain = 'subscription'
  AND ss.status_code = 'active'
  AND s.status_fk IS NULL;

-- ── 4. agent_memory ──────────────────────────────────────────────────────────
ALTER TABLE public.agent_memory
    ADD COLUMN IF NOT EXISTS status_fk INT REFERENCES public.system_status(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- Default agent memory entries to agent 'idle' state
UPDATE public.agent_memory am
SET status_fk = ss.id
FROM public.system_status ss
WHERE ss.domain = 'agent'
  AND ss.status_code = 'idle'
  AND am.status_fk IS NULL;

-- ── 5. intake_logs ───────────────────────────────────────────────────────────
ALTER TABLE public.intake_logs
    ADD COLUMN IF NOT EXISTS status_fk INT REFERENCES public.system_status(id) ON UPDATE CASCADE ON DELETE RESTRICT;

UPDATE public.intake_logs il
SET status_fk = ss.id
FROM public.system_status ss
WHERE ss.domain = 'communication'
  AND ss.status_code = 'pending'
  AND il.status_fk IS NULL;
