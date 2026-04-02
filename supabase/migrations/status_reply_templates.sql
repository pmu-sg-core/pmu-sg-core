-- Unified Status Mapping for Omni-Channel Replies
CREATE TABLE IF NOT EXISTS public.status_reply_templates (
    id SERIAL PRIMARY KEY,
    platform TEXT NOT NULL,          -- 'whatsapp', 'telegram', 'slack', 'signal', 'teams'
    pm_status TEXT NOT NULL,         -- 'To Do', 'In Progress', 'Done', 'Declined'
    reply_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(platform, pm_status)      -- One template per status per platform
);

-- Seed with defaults across platforms
INSERT INTO public.status_reply_templates (platform, pm_status, reply_text) VALUES
('whatsapp', 'To Do',       'Got it! Your request is in our queue.'),
('whatsapp', 'In Progress', 'We are currently working on your request.'),
('whatsapp', 'Done',        'Success! Your request has been completed.'),
('whatsapp', 'Declined',    'We are unable to fulfill this request at this time, but we will keep it on file.'),
('telegram', 'To Do',       'Got it! Your request is in our queue.'),
('telegram', 'In Progress', 'We are currently working on your request.'),
('telegram', 'Done',        '✅ Your ticket is now closed!'),
('telegram', 'Declined',    'We are unable to fulfill this request at this time, but we will keep it on file.'),
('slack',    'To Do',       'Got it! Your request is in our queue.'),
('slack',    'In Progress', ':hammer_and_wrench: We are currently working on your request.'),
('slack',    'Done',        ':white_check_mark: Your request has been completed.'),
('slack',    'Declined',    'We are unable to fulfill this request at this time, but we will keep it on file.'),
('teams',    'To Do',       'Got it! Your request has been logged and is in our queue.'),
('teams',    'In Progress', 'Your request is currently being worked on. We will update you shortly.'),
('teams',    'Done',        '✅ Your request has been completed successfully.'),
('teams',    'Declined',    'We are unable to fulfill this request at this time, but we will keep it on file.'),
('signal',   'To Do',       'Got it! Your request is in our queue.'),
('signal',   'In Progress', 'We are currently working on your request.'),
('signal',   'Done',        'Your request has been completed successfully.'),
('signal',   'Declined',    'We are unable to fulfill this request at this time, but we will keep it on file.')
ON CONFLICT (platform, pm_status) DO NOTHING;

-- Rename legacy constraint if it still carries the old jira column name
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'status_reply_templates_platform_type_jira_status_key'
    ) THEN
        ALTER TABLE public.status_reply_templates
            RENAME CONSTRAINT status_reply_templates_platform_type_jira_status_key
            TO status_reply_templates_platform_pm_status_key;
    END IF;
END $$;
