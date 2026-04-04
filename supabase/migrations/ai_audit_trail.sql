-- AI audit trail: per-message LLM classification and processing record
-- Consolidated from: whatsapp_logs_audit_trail.sql, ai_audit_trail_add_comm_log_id.sql
DROP TABLE IF EXISTS public.ai_audit_trail CASCADE;

CREATE TABLE public.ai_audit_trail (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    comm_log_id         UUID NOT NULL REFERENCES public.communication_logs(id),
    input_text          TEXT,
    ai_classification   TEXT,
    ai_summary_title    TEXT,
    confidence_score    FLOAT,
    processing_time_ms  INT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
