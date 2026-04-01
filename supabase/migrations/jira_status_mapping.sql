-- Maps Jira status changes to custom WhatsApp replies
CREATE TABLE IF NOT EXISTS public.jira_status_mapping (
    id SERIAL PRIMARY KEY,
    jira_status TEXT UNIQUE, -- e.g., 'In Progress', 'Done', 'Declined'
    whatsapp_reply_template TEXT, -- e.g., 'Hi! We are currently working on your request.'
    is_active BOOLEAN DEFAULT TRUE
);

-- Pre-seed with common Jira statuses
INSERT INTO public.jira_status_mapping (jira_status, whatsapp_reply_template) VALUES
('To Do', 'Your request has been logged and is in the queue.'),
('In Progress', 'A team member is now reviewing your request!'),
('Done', 'Great news! Your request has been completed.'),
('Declined', 'We cannot fulfill this request at this time, but we will keep it on file.');
