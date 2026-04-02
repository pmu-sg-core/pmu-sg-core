-- Unified Governance Audit Trail View
DROP VIEW IF EXISTS public.vw_governance_audit_trail;
CREATE VIEW public.vw_governance_audit_trail AS
SELECT
    c.created_at AS interaction_time,
    w.company AS client_org,
    COALESCE(w.first_name || ' ' || w.last_name, 'Unidentified User') AS user_identity,
    s.plan_type AS subscription_tier,
    c.platform AS intake_channel,
    c.message_body AS raw_input_text,
    audit.ai_summary_title AS processed_task_title,
    audit.ai_classification AS intent_category,
    c.pm_issue_key AS external_reference_id,
    CASE
        WHEN s.plan_type = 'pilot' THEN (10 - s.pilot_tasks_used)
        ELSE NULL
    END AS pilot_quota_remaining
FROM public.communication_logs c
LEFT JOIN public.waitlist w ON (c.sender_id = w.phone OR c.sender_id = w.email)
LEFT JOIN public.subscriptions s ON w.id = s.waitlist_id
LEFT JOIN public.ai_audit_trail audit ON c.id = audit.comm_log_id
ORDER BY c.created_at DESC;
