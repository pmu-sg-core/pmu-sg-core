-- Refactored AI Audit Trail for any platform (replaces whatsapp_logs FK with communication_logs)
CREATE TABLE IF NOT EXISTS public.ai_audit_trail (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    comm_log_id UUID REFERENCES public.communication_logs(id), -- Points to the Unified table
    input_text TEXT,
    ai_classification TEXT,  -- 'BUG', 'FEATURE', 'ENQUIRY'
    ai_summary_title TEXT,   -- The 5-word title for Jira
    confidence_score FLOAT,
    processing_time_ms INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
