ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_sub_whatsapp_number ON public.subscriptions(whatsapp_number);
