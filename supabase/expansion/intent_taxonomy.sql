-- Intent taxonomy: namespaced intent codes per business function
-- Phase 1 seeds pm.* only — add rows to expand
CREATE TABLE IF NOT EXISTS public.intent_taxonomy (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    function_id UUID NOT NULL REFERENCES public.business_functions(id),
    code          TEXT UNIQUE NOT NULL,   -- e.g. 'pm.task_request', 'hr.leave_request'
    label         TEXT NOT NULL,
    is_active     BOOLEAN DEFAULT false,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Seed PM intents (Phase 1)
INSERT INTO public.intent_taxonomy (function_id, code, label, is_active)
SELECT d.id, t.code, t.label, true
FROM public.business_functions d
JOIN (VALUES
    ('pm', 'pm.task_request',    'Task Request'),
    ('pm', 'pm.status_update',   'Status Update'),
    ('pm', 'pm.general_inquiry', 'General Inquiry'),
    ('pm', 'pm.out_of_scope',    'Out of Scope')
) AS t(dept_code, code, label) ON d.code = t.dept_code
ON CONFLICT (code) DO NOTHING;

-- Future business function intents (inactive — activate per phase)
INSERT INTO public.intent_taxonomy (function_id, code, label, is_active)
SELECT d.id, t.code, t.label, false
FROM public.business_functions d
JOIN (VALUES
    ('finance', 'finance.budget_request',   'Budget Request'),
    ('finance', 'finance.expense_approval', 'Expense Approval'),
    ('finance', 'finance.invoice_query',    'Invoice Query'),
    ('hr',      'hr.leave_request',         'Leave Request'),
    ('hr',      'hr.onboarding_task',       'Onboarding Task'),
    ('hr',      'hr.performance_review',    'Performance Review'),
    ('sales',   'sales.lead_update',        'Lead Update'),
    ('sales',   'sales.proposal_request',   'Proposal Request'),
    ('it',      'it.support_ticket',        'Support Ticket'),
    ('it',      'it.change_request',        'Change Request'),
    ('legal',   'legal.contract_review',    'Contract Review'),
    ('legal',   'legal.compliance_query',   'Compliance Query'),
    ('cs',      'cs.inquiry',               'Customer Inquiry'),
    ('cs',      'cs.complaint',             'Customer Complaint'),
    ('ops',     'ops.incident_report',      'Incident Report'),
    ('ops',     'ops.process_request',      'Process Request'),
    ('admin',   'admin.meeting_request',    'Meeting Request'),
    ('admin',   'admin.logistics',          'Logistics Request')
) AS t(dept_code, code, label) ON d.code = t.dept_code
ON CONFLICT (code) DO NOTHING;
