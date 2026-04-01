-- Maps 'Reason' or 'Category' to specific Jira Project Keys
CREATE TABLE IF NOT EXISTS public.jira_project_routing (
    id SERIAL PRIMARY KEY,
    category_name TEXT UNIQUE, -- e.g., 'sme_ops', 'startup_scale', 'research'
    jira_project_key TEXT,     -- e.g., 'SME', 'STRT', 'RES'
    priority_level TEXT DEFAULT 'Medium',
    is_active BOOLEAN DEFAULT TRUE
);

-- Pre-seed with your current strategy
INSERT INTO public.jira_project_routing (category_name, jira_project_key, priority_level) VALUES
('sme_ops', 'PMU_SME', 'High'),
('startup_scale', 'PMU_STRT', 'Medium'),
('ai_gov', 'PMU_GOV', 'High'),
('research', 'PMU_RES', 'Low');
