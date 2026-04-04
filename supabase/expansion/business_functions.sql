-- Business functions: all organisational functions Miyu can serve
-- Phase 1 activates 'pm' only — flip is_active to expand
CREATE TABLE IF NOT EXISTS public.business_functions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code       TEXT UNIQUE NOT NULL,
    name       TEXT NOT NULL,
    is_active  BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.business_functions (code, name, is_active) VALUES
    ('pm',       'Project Management',     true),
    ('finance',  'Finance & Accounting',   false),
    ('hr',       'Human Resources',        false),
    ('marketing','Marketing',              false),
    ('sales',    'Sales',                  false),
    ('ops',      'Operations',             false),
    ('it',       'Information Technology', false),
    ('legal',    'Legal',                  false),
    ('cs',       'Customer Service',       false),
    ('admin',    'Administrative',         false)
ON CONFLICT (code) DO NOTHING;
