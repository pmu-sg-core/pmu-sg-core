-- ============================================================
-- Schema Consolidation: retire legacy Phase 1 tables
-- Replace: organizations + profiles → subscriber
-- Replace: actor_bsuid → sender_id (consistent with intake_logs/comm_logs)
-- Extend:  subscriber with uen, sector, sector_tags
--
-- Run order: this file only (self-contained)
-- ============================================================


-- ── 1. Drop unused legacy tables ─────────────────────────────────────────────
-- agent_memory: vector store never wired to app code; FKs to deprecated tables
-- pending_queue: task queue never wired to app code; FK to organizations

DROP VIEW  IF EXISTS public.active_pipeline_status CASCADE;
DROP TABLE IF EXISTS public.agent_memory            CASCADE;
DROP TABLE IF EXISTS public.pending_queue           CASCADE;


-- ── 2. Audit Vault — rename actor_bsuid → sender_id ─────────────────────────
-- actor_bsuid was the BSUID from profiles; in practice it stored the sender's
-- phone number / Teams ID (same as intake_logs.sender_id). Align the naming.

ALTER TABLE public.audit_vault
    RENAME COLUMN actor_bsuid TO sender_id;

-- Rebuild hash trigger to reference new column name
CREATE OR REPLACE FUNCTION generate_audit_hash()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hash_signature := encode(digest(
    NEW.sender_id ||
    NEW.reasoning_trace::text ||
    NEW.created_at::text,
    'sha256'
  ), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ── 3. Rebuild vw_ontology_dashboard views ───────────────────────────────────
-- vw_ontology_pipeline and vw_ai_model_health joined on actor_bsuid → sender_id

CREATE OR REPLACE VIEW public.vw_ontology_pipeline AS
SELECT
    il.id                                   AS intake_id,
    il.sender_id,
    COALESCE(sub.teams_user_id, sub.whatsapp_number)
                                            AS actor_identifier,
    cl.platform,
    sub.plan_type,
    il.message_body,
    il.created_at                           AS received_at,
    aat.ai_classification,
    aat.ai_summary_title,
    aat.confidence_score,
    aat.processing_time_ms,
    il.pm_issue_key,
    pr.pm_tool,
    pr.pm_project_key,
    cl.status_fk                            AS comm_status_fk,
    ss_comm.status_code                     AS comm_status,
    av.action_taken,
    av.model_version,
    ac.status_fk                            AS conv_status_fk,
    ss_conv.status_code                     AS conv_status,
    ac.last_interaction_at,
    CASE
        WHEN sub.plan_type = 'pilot' THEN (10 - sub.pilot_tasks_used)
        ELSE NULL
    END                                     AS pilot_quota_remaining,
    (SELECT COUNT(*) FROM public.communication_attachments a
     WHERE a.comm_log_id = cl.id)           AS attachment_count
FROM public.intake_logs il
LEFT JOIN public.communication_logs cl
       ON cl.intake_log_id = il.id
LEFT JOIN public.ai_audit_trail aat
       ON aat.comm_log_id = cl.id
LEFT JOIN public.subscriptions sub
       ON sub.whatsapp_number = il.sender_id
       OR sub.teams_user_id   = il.sender_id
LEFT JOIN public.pm_project_routing pr
       ON pr.category_name = aat.ai_classification
      AND pr.is_active = true
LEFT JOIN public.audit_vault av
       ON av.sender_id = il.sender_id          -- was: actor_bsuid
LEFT JOIN public.system_status ss_comm
       ON ss_comm.id = cl.status_fk
LEFT JOIN public.active_conversations ac
       ON ac.sender_id = il.sender_id
      AND ac.channel   = cl.platform
LEFT JOIN public.system_status ss_conv
       ON ss_conv.id = ac.status_fk;


CREATE OR REPLACE VIEW public.vw_ai_model_health AS
SELECT
    av.model_version,
    DATE_TRUNC('day', av.created_at)                    AS day,
    COUNT(av.id)                                         AS decisions_made,
    ROUND(AVG(aat.confidence_score)::NUMERIC, 3)         AS avg_confidence,
    ROUND(AVG(aat.processing_time_ms)::NUMERIC, 0)       AS avg_latency_ms,
    COUNT(*) FILTER (WHERE aat.confidence_score < 0.5)   AS low_confidence_count,
    COUNT(*) FILTER (WHERE aat.ai_classification = 'pm.out_of_scope')
                                                         AS out_of_scope_count
FROM public.audit_vault av
LEFT JOIN public.communication_logs cl
       ON cl.sender_id = av.sender_id          -- was: actor_bsuid
LEFT JOIN public.ai_audit_trail aat
       ON aat.comm_log_id = cl.id
WHERE av.model_version IS NOT NULL
GROUP BY av.model_version, DATE_TRUNC('day', av.created_at)
ORDER BY day DESC, decisions_made DESC;


-- ── 4. Drop profiles then organizations ──────────────────────────────────────
-- subscriber (type='individual')  replaces profiles
-- subscriber (type='organisation') replaces organizations

DROP TABLE IF EXISTS public.profiles      CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;

-- Remove the now-dangling subscriber_id FK that pointed to organizations
-- (subscriber_id on subscriptions is the canonical link — kept as-is)


-- ── 5. Extend subscriber — sector, UEN, with UEN mandatory for organisations ─

ALTER TABLE public.subscriber
    ADD COLUMN IF NOT EXISTS uen         TEXT,
    ADD COLUMN IF NOT EXISTS sector      TEXT,        -- e.g. 'construction', 'finance', 'retail'
    ADD COLUMN IF NOT EXISTS sector_tags TEXT[];      -- e.g. '{bca,epss,bizsafe}'

ALTER TABLE public.subscriber
    DROP CONSTRAINT IF EXISTS chk_subscriber_uen;

ALTER TABLE public.subscriber
    ADD CONSTRAINT chk_subscriber_uen
        CHECK (subscriber_type = 'individual' OR uen IS NOT NULL);
