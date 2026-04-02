-- Maps intake category to PM tool project keys (Jira, Monday.com, Asana, Trello)
CREATE TABLE IF NOT EXISTS public.pm_project_routing (
    id SERIAL PRIMARY KEY,
    category_name TEXT UNIQUE,   -- e.g., 'sme_ops', 'startup_scale', 'research'
    pm_tool TEXT,                -- e.g., 'jira', 'monday', 'asana', 'trello'
    pm_project_key TEXT,         -- e.g., 'PMU_SME', 'STRT', 'RES'
    priority_level TEXT DEFAULT 'Medium',
    is_active BOOLEAN DEFAULT TRUE
);

-- Pre-seed with current strategy
INSERT INTO public.pm_project_routing (category_name, pm_tool, pm_project_key, priority_level) VALUES
('sme_ops',       'jira', 'PMU_SME',  'High'),
('startup_scale', 'jira', 'PMU_STRT', 'Medium'),
('ai_gov',        'jira', 'PMU_GOV',  'High'),
('research',      'jira', 'PMU_RES',  'Low');
