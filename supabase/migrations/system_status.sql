-- Master lifecycle status reference table
CREATE TABLE IF NOT EXISTS public.system_status (
    id          SERIAL PRIMARY KEY,
    domain      TEXT NOT NULL,
    status_code TEXT NOT NULL,
    label       TEXT NOT NULL,
    description TEXT,
    is_terminal BOOLEAN DEFAULT FALSE,
    sort_order  INT     DEFAULT 0,
    UNIQUE (domain, status_code)
);

-- ── Agent ────────────────────────────────────────────────────────────────────
INSERT INTO public.system_status (domain, status_code, label, description, is_terminal, sort_order) VALUES
('agent', 'idle',           'Idle',           'Agent is online and waiting for work',              FALSE, 1),
('agent', 'processing',     'Processing',     'Agent is actively handling a request',              FALSE, 2),
('agent', 'waiting_reply',  'Waiting Reply',  'Agent sent a response and is awaiting user reply',  FALSE, 3),
('agent', 'error',          'Error',          'Agent encountered an unrecoverable error',          TRUE,  4)
ON CONFLICT (domain, status_code) DO NOTHING;

-- ── Conversation ─────────────────────────────────────────────────────────────
INSERT INTO public.system_status (domain, status_code, label, description, is_terminal, sort_order) VALUES
('conversation', 'active',      'Active',      'Conversation is ongoing',                          FALSE, 1),
('conversation', 'escalated',   'Escalated',   'Handed off to a human coordinator',                FALSE, 2),
('conversation', 'closed',      'Closed',      'Conversation resolved and closed',                 TRUE,  3),
('conversation', 'blacklisted', 'Blacklisted', 'Sender is blocked from further interactions',      TRUE,  4)
ON CONFLICT (domain, status_code) DO NOTHING;

-- ── Communication (per message) ───────────────────────────────────────────────
INSERT INTO public.system_status (domain, status_code, label, description, is_terminal, sort_order) VALUES
('communication', 'pending',   'Pending',   'Message received, not yet processed',   FALSE, 1),
('communication', 'delivered', 'Delivered', 'Reply successfully sent to sender',      FALSE, 2),
('communication', 'read',      'Read',      'Sender has read the reply',              FALSE, 3),
('communication', 'failed',    'Failed',    'Delivery or processing failed',          TRUE,  4)
ON CONFLICT (domain, status_code) DO NOTHING;

-- ── Subscription ─────────────────────────────────────────────────────────────
INSERT INTO public.system_status (domain, status_code, label, description, is_terminal, sort_order) VALUES
('subscription', 'trialing',   'Trialing',   'Within pilot or free trial period',     FALSE, 1),
('subscription', 'active',     'Active',     'Paid and in good standing',             FALSE, 2),
('subscription', 'suspended',  'Suspended',  'Payment lapsed, access restricted',     FALSE, 3),
('subscription', 'cancelled',  'Cancelled',  'Subscription terminated',               TRUE,  4)
ON CONFLICT (domain, status_code) DO NOTHING;

-- ── PM Issue ─────────────────────────────────────────────────────────────────
INSERT INTO public.system_status (domain, status_code, label, description, is_terminal, sort_order) VALUES
('pm_issue', 'to_do',       'To Do',       'Issue logged, not yet started',          FALSE, 1),
('pm_issue', 'in_progress', 'In Progress', 'Issue is actively being worked on',      FALSE, 2),
('pm_issue', 'done',        'Done',        'Issue resolved successfully',             TRUE,  3),
('pm_issue', 'declined',    'Declined',    'Issue rejected or out of scope',          TRUE,  4)
ON CONFLICT (domain, status_code) DO NOTHING;
