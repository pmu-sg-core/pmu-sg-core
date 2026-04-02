-- Maps PM tool task statuses to reply templates (superseded by status_reply_templates)
-- Kept for reference — use status_reply_templates for omni-channel deployments
CREATE TABLE IF NOT EXISTS public.pm_status_mapping (
    id SERIAL PRIMARY KEY,
    pm_status TEXT UNIQUE,           -- e.g., 'In Progress', 'Done', 'Declined'
    reply_template TEXT,             -- Default reply for any platform
    is_active BOOLEAN DEFAULT TRUE
);

-- Pre-seed with common PM statuses
INSERT INTO public.pm_status_mapping (pm_status, reply_template) VALUES
('To Do',      'Your request has been logged and is in the queue.'),
('In Progress','A team member is now reviewing your request!'),
('Done',       'Great news! Your request has been completed.'),
('Declined',   'We cannot fulfill this request at this time, but we will keep it on file.');
