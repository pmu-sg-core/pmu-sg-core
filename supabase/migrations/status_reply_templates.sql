-- Unified Status Mapping for Omni-Channel Replies
CREATE TABLE IF NOT EXISTS public.status_reply_templates (
    id SERIAL PRIMARY KEY,
    platform_type TEXT NOT NULL, -- 'whatsapp', 'telegram', etc.
    jira_status TEXT NOT NULL,   -- 'In Progress', 'Done'
    reply_text TEXT NOT NULL,    -- The actual message sent back to the user
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(platform_type, jira_status) -- One template per status per platform
);

-- Seed with WhatsApp and Telegram defaults
INSERT INTO public.status_reply_templates (platform_type, jira_status, reply_text) VALUES
('whatsapp', 'To Do', 'Got it! Your request is in our queue.'),
('whatsapp', 'In Progress', 'We are currently working on your request.'),
('whatsapp', 'Done', 'Success! Your request has been completed.'),
('whatsapp', 'Declined', 'We are unable to fulfill this request at this time, but we will keep it on file.'),
('telegram', 'To Do', 'Got it! Your request is in our queue.'),
('telegram', 'In Progress', 'We are currently working on your request.'),
('telegram', 'Done', '✅ Your ticket is now closed!'),
('telegram', 'Declined', 'We are unable to fulfill this request at this time, but we will keep it on file.'),
('slack', 'To Do', 'Got it! Your request is in our queue.'),
('slack', 'In Progress', ':hammer_and_wrench: We are currently working on your request.'),
('slack', 'Done', ':white_check_mark: Your request has been completed.'),
('slack', 'Declined', 'We are unable to fulfill this request at this time, but we will keep it on file.');
