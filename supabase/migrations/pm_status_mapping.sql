-- PM status mapping: maps PM tool statuses to reply templates
-- Consolidated from: jira_status_mapping.sql, alter_rename_jira_columns.sql
-- Note: superseded by status_reply_templates for omni-channel deployments
DROP TABLE IF EXISTS public.pm_status_mapping CASCADE;

CREATE TABLE public.pm_status_mapping (
    id              SERIAL PRIMARY KEY,
    pm_status       TEXT UNIQUE NOT NULL,
    reply_template  TEXT,
    is_active       BOOLEAN DEFAULT TRUE
);

INSERT INTO public.pm_status_mapping (pm_status, reply_template) VALUES
    ('To Do',       'Your request has been logged and is in the queue.'),
    ('In Progress', 'A team member is now reviewing your request!'),
    ('Done',        'Great news! Your request has been completed.'),
    ('Declined',    'We cannot fulfill this request at this time, but we will keep it on file.')
ON CONFLICT (pm_status) DO NOTHING;
