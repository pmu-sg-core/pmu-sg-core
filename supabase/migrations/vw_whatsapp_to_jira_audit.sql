-- Create a view for a unified 'Command Center' display
CREATE OR REPLACE VIEW public.vw_whatsapp_to_jira_audit AS
SELECT
    log.created_at,
    l.first_name || ' ' || l.last_name AS user_full_name,
    l.company,
    log.message_body AS raw_message,
    audit.ai_summary AS ai_generated_title,
    audit.ai_classification AS category,
    log.jira_issue_key,
    log.status AS delivery_status
FROM public.whatsapp_logs log
LEFT JOIN public.waitlist l ON log.sender_number = l.email  -- join on email until phone column is added
LEFT JOIN public.whatsapp_logs_audit_trail audit ON log.id = audit.whatsapp_log_id
ORDER BY log.created_at DESC;
