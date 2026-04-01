-- Stores the 'thinking' process of the AI before it hits Jira
CREATE TABLE IF NOT EXISTS public.ai_audit_trail (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    whatsapp_log_id UUID REFERENCES public.whatsapp_logs(id),
    input_text TEXT,
    ai_classification TEXT, -- e.g., 'BUG', 'FEATURE'
    ai_summary TEXT,        -- The title it generated for Jira
    confidence_score FLOAT, -- How sure the AI was
    created_at TIMESTAMPTZ DEFAULT NOW()
);
