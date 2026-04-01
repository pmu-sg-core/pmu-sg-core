-- Add identity columns to waitlist for omni-channel linking
ALTER TABLE public.waitlist
ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.waitlist
ADD COLUMN IF NOT EXISTS telegram_handle TEXT;

-- Index for fast cross-platform identity lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_identity
ON public.waitlist (phone, email);
