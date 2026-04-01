-- Migrate ai_audit_trail from whatsapp_log_id to comm_log_id (platform-agnostic)
ALTER TABLE public.ai_audit_trail
ADD COLUMN IF NOT EXISTS comm_log_id UUID REFERENCES public.communication_logs(id);

ALTER TABLE public.ai_audit_trail
ADD COLUMN IF NOT EXISTS ai_summary_title TEXT;

ALTER TABLE public.ai_audit_trail
ADD COLUMN IF NOT EXISTS processing_time_ms INT;
