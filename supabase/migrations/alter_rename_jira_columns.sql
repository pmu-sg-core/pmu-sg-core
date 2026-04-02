-- Rename all legacy jira-specific columns to vendor-agnostic pm_ equivalents

-- 1. active_conversations
ALTER TABLE public.active_conversations
    RENAME COLUMN last_jira_issue_key TO last_pm_issue_key;

-- 2. communication_logs
ALTER TABLE public.communication_logs
    RENAME COLUMN jira_issue_key TO pm_issue_key;

-- 3. whatsapp_logs
ALTER TABLE public.whatsapp_logs
    RENAME COLUMN jira_issue_key TO pm_issue_key;

-- 4. status_reply_templates: rename jira_status → pm_status and platform_type → platform
ALTER TABLE public.status_reply_templates
    RENAME COLUMN jira_status TO pm_status;

ALTER TABLE public.status_reply_templates
    RENAME COLUMN platform_type TO platform;
