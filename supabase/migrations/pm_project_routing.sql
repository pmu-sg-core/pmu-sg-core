-- PM project routing: maps intent categories to PM tool projects
-- Consolidated from: jira_project_routing.sql, alter_rename_jira_columns.sql
CREATE TABLE IF NOT EXISTS public.pm_project_routing (
    id              SERIAL PRIMARY KEY,
    category_name   TEXT UNIQUE,        -- e.g., 'pm.task_request', 'sme_ops'
    pm_tool         TEXT,               -- 'jira', 'monday', 'asana', 'trello', 'clickup'
    pm_project_key  TEXT,               -- e.g., 'PMU', 'PMU_SME'
    priority_level  TEXT DEFAULT 'Medium',
    is_active       BOOLEAN DEFAULT TRUE
);

-- Seed with current PM routing strategy
INSERT INTO public.pm_project_routing (category_name, pm_tool, pm_project_key, priority_level) VALUES
    ('pm.task_request',  'jira', 'PMU',      'Medium'),
    ('sme_ops',          'jira', 'PMU_SME',  'High'),
    ('startup_scale',    'jira', 'PMU_STRT', 'Medium'),
    ('ai_gov',           'jira', 'PMU_GOV',  'High'),
    ('research',         'jira', 'PMU_RES',  'Low')
ON CONFLICT (category_name) DO NOTHING;
