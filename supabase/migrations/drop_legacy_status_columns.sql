-- Drop legacy free-text status columns after status_fk backfill is confirmed
-- Run this AFTER alter_add_system_status_fks.sql
-- Views are recreated below to reference system_status.label instead

-- ── Drop dependent views first ────────────────────────────────────────────────
DROP VIEW IF EXISTS public.vw_communication_audit;
DROP VIEW IF EXISTS public.vw_omni_channel_audit;
DROP VIEW IF EXISTS public.vw_governance_audit_trail;

-- ── Drop legacy text status columns ──────────────────────────────────────────
ALTER TABLE public.communication_logs      DROP COLUMN IF EXISTS status;
ALTER TABLE public.active_conversations    DROP COLUMN IF EXISTS conversation_state;
ALTER TABLE public.subscriptions           DROP COLUMN IF EXISTS status;

-- ── Recreate vw_communication_audit via system_status join ───────────────────
CREATE VIEW public.vw_communication_audit AS
SELECT
    log.created_at,
    log.platform,
    l.first_name || ' ' || l.last_name AS user_full_name,
    l.company,
    log.message_body AS raw_message,
    audit.ai_summary_title AS ai_generated_title,
    audit.ai_classification AS category,
    audit.confidence_score,
    audit.processing_time_ms,
    log.pm_issue_key,
    ss.label AS delivery_status
FROM public.communication_logs log
LEFT JOIN public.waitlist l ON log.sender_id = l.phone OR log.sender_id = l.email
LEFT JOIN public.ai_audit_trail audit ON log.id = audit.comm_log_id
LEFT JOIN public.system_status ss ON log.status_fk = ss.id
ORDER BY log.created_at DESC;

-- ── Recreate vw_omni_channel_audit via system_status join ────────────────────
CREATE VIEW public.vw_omni_channel_audit AS
SELECT
    c.created_at,
    c.platform,
    COALESCE(w.first_name || ' ' || w.last_name, 'Unknown User') AS user_name,
    COALESCE(w.company, 'Individual/Guest') AS company_name,
    c.message_body AS raw_input,
    audit.ai_summary_title AS ai_interpreted_title,
    audit.ai_classification AS category,
    c.pm_issue_key,
    ss.label AS processing_status,
    (SELECT count(*) FROM public.communication_attachments a WHERE a.comm_log_id = c.id) AS attachment_count
FROM public.communication_logs c
LEFT JOIN public.waitlist w ON (c.sender_id = w.phone OR c.sender_id = w.email)
LEFT JOIN public.ai_audit_trail audit ON c.id = audit.comm_log_id
LEFT JOIN public.system_status ss ON c.status_fk = ss.id
ORDER BY c.created_at DESC;

-- ── Recreate vw_governance_audit_trail via system_status join ────────────────
CREATE VIEW public.vw_governance_audit_trail AS
SELECT
    c.created_at AS interaction_time,
    w.company AS client_org,
    COALESCE(w.first_name || ' ' || w.last_name, 'Unidentified User') AS user_identity,
    sub.plan_type AS subscription_tier,
    sub_ss.label AS subscription_status,
    c.platform AS intake_channel,
    c.message_body AS raw_input_text,
    audit.ai_summary_title AS processed_task_title,
    audit.ai_classification AS intent_category,
    c.pm_issue_key AS external_reference_id,
    CASE
        WHEN sub.plan_type = 'pilot' THEN (10 - sub.pilot_tasks_used)
        ELSE NULL
    END AS pilot_quota_remaining
FROM public.communication_logs c
LEFT JOIN public.waitlist w ON (c.sender_id = w.phone OR c.sender_id = w.email)
LEFT JOIN public.subscriptions sub ON w.id = sub.waitlist_id
LEFT JOIN public.system_status sub_ss ON sub.status_fk = sub_ss.id
LEFT JOIN public.ai_audit_trail audit ON c.id = audit.comm_log_id
ORDER BY c.created_at DESC;
