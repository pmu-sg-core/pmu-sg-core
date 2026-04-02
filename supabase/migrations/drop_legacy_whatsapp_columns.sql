-- Drop legacy WhatsApp-specific columns from intake_logs (formerly whatsapp_logs)
-- Run this AFTER alter_rename_whatsapp_tables.sql and alter_rename_jira_columns.sql

-- Drop wa_id if it still exists (should have been renamed to platform_message_id)
ALTER TABLE public.intake_logs DROP COLUMN IF EXISTS wa_id;

-- Drop sender_number if it still exists (should have been renamed to sender_id)
ALTER TABLE public.intake_logs DROP COLUMN IF EXISTS sender_number;

-- Drop jira_issue_key if it still exists (should have been renamed to pm_issue_key)
ALTER TABLE public.intake_logs DROP COLUMN IF EXISTS jira_issue_key;
