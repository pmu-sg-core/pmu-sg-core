CREATE OR REPLACE VIEW public.vw_omni_channel_audit AS
SELECT
    c.created_at,
    c.platform,
    COALESCE(w.first_name || ' ' || w.last_name, 'Unknown User') AS user_name,
    COALESCE(w.company, 'Individual/Guest') AS company_name,
    c.message_body AS raw_input,
    audit.ai_summary_title AS ai_interpreted_title,
    audit.ai_classification AS category,
    c.jira_issue_key,
    c.status AS processing_status,
    (SELECT count(*) FROM public.communication_attachments a WHERE a.comm_log_id = c.id) AS attachment_count
FROM public.communication_logs c
LEFT JOIN public.waitlist w ON (c.sender_id = w.phone OR c.sender_id = w.email)
LEFT JOIN public.ai_audit_trail audit ON c.id = audit.comm_log_id
ORDER BY c.created_at DESC;
