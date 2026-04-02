-- Unified Command Center view across all platforms
CREATE OR REPLACE VIEW public.vw_communication_audit AS
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
    log.status AS delivery_status
FROM public.communication_logs log
LEFT JOIN public.waitlist l ON log.sender_id = l.phone OR log.sender_id = l.email
LEFT JOIN public.ai_audit_trail audit ON log.id = audit.comm_log_id
ORDER BY log.created_at DESC;
