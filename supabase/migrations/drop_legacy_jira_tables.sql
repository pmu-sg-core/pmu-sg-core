-- Drop legacy Jira-specific tables replaced by vendor-agnostic pm_ equivalents
-- Run this AFTER confirming pm_project_routing and pm_status_mapping are created

DROP TABLE IF EXISTS public.jira_project_routing CASCADE;
DROP TABLE IF EXISTS public.jira_status_mapping CASCADE;

-- Drop legacy views replaced by vw_communication_audit and vw_omni_channel_audit
DROP VIEW IF EXISTS public.vw_whatsapp_to_jira_audit CASCADE;
