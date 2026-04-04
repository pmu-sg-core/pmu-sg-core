-- ============================================================
-- Debug: Message Flow View
-- One row per message — full pipeline in a single query
-- Usage: SELECT * FROM vw_debug_msg_flow ORDER BY received_at DESC LIMIT 20;
-- ============================================================

CREATE OR REPLACE VIEW public.vw_debug_msg_flow AS
SELECT
    -- ── Intake ──────────────────────────────────────────────
    il.id                                       AS intake_id,
    il.sender_id,
    il.message_body                             AS inbound_text,
    il.created_at                               AS received_at,

    -- ── Outbound Reply ───────────────────────────────────────
    cl.id                                       AS comm_log_id,
    cl.platform,
    cl.message_body                             AS reply_text,
    ss_comm.status_code                         AS delivery_status,

    -- ── AI Decision ──────────────────────────────────────────
    aat.ai_classification                       AS classification,
    aat.ai_summary_title                        AS summary,
    aat.confidence_score                        AS confidence,
    aat.processing_time_ms                      AS latency_ms,

    -- ── PM Routing ───────────────────────────────────────────
    il.pm_issue_key,
    pr.pm_tool,
    pr.pm_project_key,

    -- ── Subscription ─────────────────────────────────────────
    sub.plan_type,
    sub.pilot_tasks_used,

    -- ── Audit Vault ──────────────────────────────────────────
    av.action_taken,
    av.model_version,
    av.hash_signature                           AS audit_hash,

    -- ── Conversation State ───────────────────────────────────
    ss_conv.status_code                         AS conversation_status,
    ac.last_interaction_at

FROM public.intake_logs il

LEFT JOIN public.communication_logs cl
       ON cl.intake_log_id = il.id

LEFT JOIN public.ai_audit_trail aat
       ON aat.comm_log_id = cl.id

LEFT JOIN public.system_status ss_comm
       ON ss_comm.id = cl.status_fk

LEFT JOIN public.pm_project_routing pr
       ON pr.category_name = aat.ai_classification
      AND pr.is_active = true

LEFT JOIN public.subscriptions sub
       ON sub.whatsapp_number = il.sender_id
       OR sub.teams_user_id   = il.sender_id

LEFT JOIN public.audit_vault av
       ON av.actor_bsuid = il.sender_id

LEFT JOIN public.active_conversations ac
       ON ac.sender_id = il.sender_id
      AND ac.channel   = cl.platform

LEFT JOIN public.system_status ss_conv
       ON ss_conv.id = ac.status_fk;


-- ── Quick debug queries ───────────────────────────────────────────────────────

-- Last 20 messages end-to-end
-- SELECT * FROM vw_debug_msg_flow ORDER BY received_at DESC LIMIT 20;

-- Messages with no AI classification (pipeline gap)
-- SELECT intake_id, sender_id, inbound_text, received_at
-- FROM vw_debug_msg_flow
-- WHERE classification IS NULL
-- ORDER BY received_at DESC;

-- Messages with no reply logged (delivery gap)
-- SELECT intake_id, sender_id, inbound_text, received_at
-- FROM vw_debug_msg_flow
-- WHERE comm_log_id IS NULL
-- ORDER BY received_at DESC;

-- Messages routed to PM tool
-- SELECT intake_id, sender_id, classification, pm_issue_key, pm_tool, pm_project_key
-- FROM vw_debug_msg_flow
-- WHERE pm_issue_key IS NOT NULL
-- ORDER BY received_at DESC;

-- Low confidence classifications (possible misrouting)
-- SELECT intake_id, sender_id, inbound_text, classification, confidence, latency_ms
-- FROM vw_debug_msg_flow
-- WHERE confidence < 0.5
-- ORDER BY confidence ASC;

-- ── Onboarding: add new user subscription (run once per new user) ─────────────
/*
INSERT INTO public.subscriptions (teams_user_id, plan_type)
VALUES ('<teams_user_id>', 'pilot')
ON CONFLICT (teams_user_id) DO NOTHING;

INSERT INTO public.subscriptions (whatsapp_number, plan_type)
VALUES ('<whatsapp_number>', 'pilot')
ON CONFLICT (whatsapp_number) DO NOTHING;
*/
