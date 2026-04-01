-- Surfaces messages from senders not yet in the waitlist
CREATE OR REPLACE VIEW public.vw_unmatched_leads AS
SELECT
    l.sender_id,
    l.platform,
    l.message_body,
    l.created_at
FROM public.communication_logs l
LEFT JOIN public.waitlist w ON l.sender_id = w.phone OR l.sender_id = w.email
WHERE w.id IS NULL;
