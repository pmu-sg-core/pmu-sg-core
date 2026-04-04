-- Channels: interaction layer (WhatsApp, Teams, Slack, etc.)
-- Phase 1 activates whatsapp + teams only
DROP TABLE IF EXISTS public.channels CASCADE;

CREATE TABLE public.channels (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                  TEXT UNIQUE NOT NULL,
    name                  TEXT NOT NULL,
    channel_type          TEXT NOT NULL CHECK (channel_type IN (
                              'messaging', 'workspace', 'email', 'voice', 'web'
                          )),
    max_message_chars     INT,
    supports_rich_content BOOLEAN DEFAULT false,
    supports_attachments  BOOLEAN DEFAULT false,
    supports_group        BOOLEAN DEFAULT false,
    is_active             BOOLEAN DEFAULT false,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.channels (code, name, channel_type, max_message_chars, supports_rich_content, supports_attachments, supports_group, is_active) VALUES
    ('whatsapp', 'WhatsApp',        'messaging', 1600,  false, true,  true,  true),
    ('teams',    'Microsoft Teams', 'workspace', 28000, true,  true,  true,  true),
    ('slack',    'Slack',           'workspace', 40000, true,  true,  true,  false),
    ('telegram', 'Telegram',        'messaging', 4096,  false, true,  true,  false),
    ('sms',      'SMS',             'messaging', 160,   false, false, false, false),
    ('email',    'Email',           'email',     NULL,  true,  true,  false, false),
    ('webchat',  'Web Chat',        'web',       NULL,  true,  false, false, false),
    ('voice',    'Voice',           'voice',     NULL,  false, false, false, false)
ON CONFLICT (code) DO NOTHING;
