-- ============================================================
-- PMU Ontology Dashboard View
-- Joins the full actor → message → AI → PM → subscription chain
-- Powers the admin dashboard with one query per time slice
-- ============================================================

-- ── 1. Message Pipeline View ─────────────────────────────────────────────────
-- One row per inbound message with full lifecycle context
CREATE OR REPLACE VIEW public.vw_ontology_pipeline AS
SELECT
    -- Identity
    il.id                                   AS intake_id,
    il.sender_id,
    COALESCE(sub.teams_user_id, sub.whatsapp_number)
                                            AS actor_identifier,
    cl.platform,
    sub.plan_type,

    -- Message
    il.message_body,
    il.created_at                           AS received_at,

    -- AI Classification
    aat.ai_classification,
    aat.ai_summary_title,
    aat.confidence_score,
    aat.processing_time_ms,

    -- PM Routing
    il.pm_issue_key,
    pr.pm_tool,
    pr.pm_project_key,

    -- Outcome
    cl.status_fk                            AS comm_status_fk,
    ss_comm.status_code                     AS comm_status,
    av.action_taken,
    av.model_version,

    -- Conversation State
    ac.status_fk                            AS conv_status_fk,
    ss_conv.status_code                     AS conv_status,
    ac.last_interaction_at,

    -- Pilot quota remaining (absorbed from vw_governance_audit_trail)
    CASE
        WHEN sub.plan_type = 'pilot' THEN (10 - sub.pilot_tasks_used)
        ELSE NULL
    END                                     AS pilot_quota_remaining,

    -- Attachment count (absorbed from vw_omni_channel_audit)
    (SELECT COUNT(*) FROM public.communication_attachments a
     WHERE a.comm_log_id = cl.id)           AS attachment_count

FROM public.intake_logs il

-- Outbound comm record — 1:1 via intake_log_id (no fan-out)
LEFT JOIN public.communication_logs cl
       ON cl.intake_log_id = il.id

-- AI decision for this comm record
LEFT JOIN public.ai_audit_trail aat
       ON aat.comm_log_id = cl.id

-- Subscription (match whatsapp number OR teams user id)
LEFT JOIN public.subscriptions sub
       ON sub.whatsapp_number = il.sender_id
       OR sub.teams_user_id   = il.sender_id

-- PM routing rule that handled this classification
LEFT JOIN public.pm_project_routing pr
       ON pr.category_name = aat.ai_classification
      AND pr.is_active = true

-- Immutable audit record
LEFT JOIN public.audit_vault av
       ON av.actor_bsuid = il.sender_id

-- Communication delivery status label
LEFT JOIN public.system_status ss_comm
       ON ss_comm.id = cl.status_fk

-- Conversation lifecycle state (match sender + channel derived from comm log platform)
LEFT JOIN public.active_conversations ac
       ON ac.sender_id = il.sender_id
      AND ac.channel   = cl.platform

LEFT JOIN public.system_status ss_conv
       ON ss_conv.id = ac.status_fk;


-- ── 2. Actor Activity Summary ─────────────────────────────────────────────────
-- One row per sender: message count, last seen, plan, dominant intent
CREATE OR REPLACE VIEW public.vw_actor_activity AS
SELECT
    il.sender_id,
    COALESCE(sub.teams_user_id, sub.whatsapp_number)    AS actor_identifier,
    sub.plan_type,
    COUNT(il.id)                                         AS total_messages,
    COUNT(il.pm_issue_key) FILTER (WHERE il.pm_issue_key IS NOT NULL)
                                                         AS tickets_created,
    ROUND(AVG(aat.confidence_score)::NUMERIC, 2)         AS avg_confidence,
    ROUND(AVG(aat.processing_time_ms)::NUMERIC, 0)       AS avg_processing_ms,
    MAX(il.created_at)                                   AS last_seen_at,
    -- Most frequent AI intent
    MODE() WITHIN GROUP (ORDER BY aat.ai_classification) AS dominant_intent,
    -- Channel breakdown
    COUNT(cl.id) FILTER (WHERE cl.platform = 'whatsapp') AS whatsapp_count,
    COUNT(cl.id) FILTER (WHERE cl.platform = 'teams')    AS teams_count
FROM public.intake_logs il
LEFT JOIN public.communication_logs cl
       ON cl.intake_log_id = il.id
LEFT JOIN public.ai_audit_trail aat
       ON aat.comm_log_id = cl.id
LEFT JOIN public.subscriptions sub
       ON sub.whatsapp_number = il.sender_id
       OR sub.teams_user_id   = il.sender_id
GROUP BY il.sender_id, sub.plan_type, sub.teams_user_id, sub.whatsapp_number;


-- ── 3. Daily Volume Metrics ───────────────────────────────────────────────────
-- One row per day: message volume, success rate, AI confidence, latency
CREATE OR REPLACE VIEW public.vw_daily_metrics AS
SELECT
    DATE_TRUNC('day', il.created_at)                     AS day,
    COUNT(il.id)                                          AS messages_received,
    COUNT(il.pm_issue_key) FILTER (WHERE il.pm_issue_key IS NOT NULL)
                                                          AS tickets_created,
    COUNT(il.id) FILTER (WHERE ss.status_code = 'failed')
                                                          AS delivery_failures,
    ROUND(AVG(aat.confidence_score)::NUMERIC, 3)          AS avg_confidence,
    ROUND(AVG(aat.processing_time_ms)::NUMERIC, 0)        AS avg_latency_ms,
    MAX(aat.processing_time_ms)                           AS peak_latency_ms,
    -- Platform split
    COUNT(cl.id) FILTER (WHERE cl.platform = 'whatsapp') AS whatsapp_msgs,
    COUNT(cl.id) FILTER (WHERE cl.platform = 'teams')    AS teams_msgs,
    -- Plan tier split
    COUNT(sub.id) FILTER (WHERE sub.plan_type = 'pilot')      AS pilot_users,
    COUNT(sub.id) FILTER (WHERE sub.plan_type = 'lite')       AS lite_users,
    COUNT(sub.id) FILTER (WHERE sub.plan_type = 'pro')        AS pro_users,
    COUNT(sub.id) FILTER (WHERE sub.plan_type = 'corporate')  AS corporate_users
FROM public.intake_logs il
LEFT JOIN public.communication_logs cl
       ON cl.intake_log_id = il.id
LEFT JOIN public.ai_audit_trail aat
       ON aat.comm_log_id = cl.id
LEFT JOIN public.subscriptions sub
       ON sub.whatsapp_number = il.sender_id
       OR sub.teams_user_id   = il.sender_id
LEFT JOIN public.system_status ss
       ON ss.id = cl.status_fk
GROUP BY DATE_TRUNC('day', il.created_at)
ORDER BY day DESC;


-- ── 4. Intent Distribution ────────────────────────────────────────────────────
-- Classification breakdown by business function intent
CREATE OR REPLACE VIEW public.vw_intent_distribution AS
SELECT
    aat.ai_classification                               AS intent,
    sub.plan_type,
    cl.platform,
    COUNT(*)                                            AS message_count,
    ROUND(AVG(aat.confidence_score)::NUMERIC, 3)        AS avg_confidence,
    ROUND(AVG(aat.processing_time_ms)::NUMERIC, 0)      AS avg_latency_ms,
    COUNT(*) FILTER (WHERE il.pm_issue_key IS NOT NULL) AS routed_to_pm
FROM public.ai_audit_trail aat
LEFT JOIN public.communication_logs cl
       ON cl.id = aat.comm_log_id
LEFT JOIN public.intake_logs il
       ON il.sender_id = cl.sender_id
LEFT JOIN public.subscriptions sub
       ON sub.whatsapp_number = cl.sender_id
       OR sub.teams_user_id   = cl.sender_id
WHERE aat.ai_classification IS NOT NULL
GROUP BY aat.ai_classification, sub.plan_type, cl.platform
ORDER BY message_count DESC;


-- ── 5. AI Model Health ────────────────────────────────────────────────────────
-- Per model-version audit trail: reliability, speed, decision confidence
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
       ON cl.sender_id = av.actor_bsuid
LEFT JOIN public.ai_audit_trail aat
       ON aat.comm_log_id = cl.id
WHERE av.model_version IS NOT NULL
GROUP BY av.model_version, DATE_TRUNC('day', av.created_at)
ORDER BY day DESC, decisions_made DESC;
