-- Rename whatsapp_logs to intake_logs (platform-agnostic)
ALTER TABLE public.whatsapp_logs RENAME TO intake_logs;

-- Rename index
ALTER INDEX public.idx_whatsapp_sender RENAME TO idx_intake_logs_sender;

-- Drop the old wa_id column (WhatsApp-specific) and replace with platform_message_id
ALTER TABLE public.intake_logs RENAME COLUMN wa_id TO platform_message_id;

-- Rename sender_number to sender_id (platform-agnostic)
ALTER TABLE public.intake_logs RENAME COLUMN sender_number TO sender_id;

-- Drop legacy views that reference old whatsapp table names
DROP VIEW IF EXISTS public.vw_whatsapp_to_jira_audit CASCADE;
