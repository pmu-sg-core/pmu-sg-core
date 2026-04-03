-- Add prompt versioning to config_settings
ALTER TABLE public.config_settings
  ADD COLUMN IF NOT EXISTS prompt_id text NOT NULL DEFAULT 'v1.0';

-- Update existing rows to reflect current version
UPDATE public.config_settings SET prompt_id = 'v1.0' WHERE prompt_id IS NULL;
