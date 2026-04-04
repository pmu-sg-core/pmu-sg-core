-- System adapters: registry of all external tool integrations
-- Phase 1 activates jira only — flip is_active to expand
CREATE TABLE IF NOT EXISTS public.system_adapters (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code          TEXT UNIQUE NOT NULL,
    name          TEXT NOT NULL,
    function_id UUID REFERENCES public.business_functions(id),
    is_active     BOOLEAN DEFAULT false,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.system_adapters (code, name, function_id, is_active)
SELECT t.code, t.name, d.id, t.active
FROM public.business_functions d
JOIN (VALUES
    -- PM Tools
    ('jira',         'Jira',               'pm',      true),
    ('monday',       'Monday.com',          'pm',      false),
    ('asana',        'Asana',               'pm',      false),
    ('trello',       'Trello',              'pm',      false),
    ('clickup',      'ClickUp',             'pm',      false),
    ('notion',       'Notion',              'pm',      false),
    ('ms_planner',   'Microsoft Planner',   'pm',      false),
    ('linear',       'Linear',              'pm',      false),
    ('wrike',        'Wrike',               'pm',      false),
    ('smartsheet',   'Smartsheet',          'pm',      false),
    ('basecamp',     'Basecamp',            'pm',      false),
    ('github',       'GitHub Projects',     'pm',      false),
    -- Sales Tools
    ('salesforce',   'Salesforce',          'sales',   false),
    ('hubspot',      'HubSpot',             'sales',   false),
    -- IT Tools
    ('servicenow',   'ServiceNow',          'it',      false),
    -- HR Tools
    ('workday',      'Workday',             'hr',      false),
    ('bamboohr',     'BambooHR',            'hr',      false),
    -- Finance Tools
    ('xero',         'Xero',                'finance', false),
    ('quickbooks',   'QuickBooks',          'finance', false)
) AS t(code, name, dept_code, active) ON d.code = t.dept_code
ON CONFLICT (code) DO NOTHING;
