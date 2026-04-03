-- Create the Expanded Config Settings Table
CREATE TABLE public.config_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_tier_id uuid UNIQUE NOT NULL REFERENCES public.plan_tiers(id) ON DELETE CASCADE,

  -- Resource Limits
  max_input_chars integer NOT NULL DEFAULT 500,
  max_output_tokens integer NOT NULL DEFAULT 1500,

  -- AI Intelligence
  model_provider text NOT NULL DEFAULT 'anthropic',
  model_name text NOT NULL DEFAULT 'claude-sonnet-4-6',

  -- Personality
  temperature float4 NOT NULL DEFAULT 0.7,
  system_prompt text NOT NULL DEFAULT 'You are Miyu, a helpful AI assistant. Always respond in clear, proper English with complete sentences. Be concise. Never leave a response mid-sentence or incomplete. Do not use bullet points or markdown formatting.',

  -- Capabilities
  can_access_kb boolean NOT NULL DEFAULT false,
  enable_history boolean NOT NULL DEFAULT false,

  -- Operational Meta
  updated_at timestamp with time zone DEFAULT now()
);

-- Seed default config for each plan tier
INSERT INTO public.config_settings (
  plan_tier_id,
  max_input_chars,
  max_output_tokens,
  model_provider,
  model_name,
  temperature,
  system_prompt,
  can_access_kb,
  enable_history
)
SELECT
  pt.id,
  cfg.max_input_chars,
  cfg.max_output_tokens,
  cfg.model_provider,
  cfg.model_name,
  cfg.temperature,
  cfg.system_prompt,
  cfg.can_access_kb,
  cfg.enable_history
FROM public.plan_tiers pt
JOIN (VALUES
  ('pilot',     300,  256,  'anthropic', 'claude-sonnet-4-6', 0.5, 'You are Miyu, a helpful AI assistant. Be concise and professional. Do not use markdown or bullet points.',                                                    false, false),
  ('lite',      500,  512,  'anthropic', 'claude-sonnet-4-6', 0.7, 'You are Miyu, a helpful AI assistant. Always respond in clear, proper English. Be concise and friendly. Do not use markdown or bullet points.',                false, false),
  ('pro',       1000, 1024, 'anthropic', 'claude-sonnet-4-6', 0.7, 'You are Miyu, a professional AI assistant. Provide thorough, well-structured responses in plain English. Do not use markdown or bullet points.',             true,  true),
  ('corporate', 2000, 2048, 'anthropic', 'claude-sonnet-4-6', 0.9, 'You are Miyu, an enterprise-grade AI assistant. Provide detailed, strategic responses in professional English. Do not use markdown or bullet points.',       true,  true)
) AS cfg(plan_type, max_input_chars, max_output_tokens, model_provider, model_name, temperature, system_prompt, can_access_kb, enable_history)
ON pt.plan_type = cfg.plan_type
ON CONFLICT (plan_tier_id) DO NOTHING;

-- Alter script for existing databases
ALTER TABLE public.config_settings
  ADD COLUMN IF NOT EXISTS system_prompt text NOT NULL DEFAULT 'You are Miyu, a helpful AI assistant. Always respond in clear, proper English with complete sentences. Be concise. Never leave a response mid-sentence or incomplete. Do not use bullet points or markdown formatting.',
  ADD COLUMN IF NOT EXISTS can_access_kb boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_history boolean NOT NULL DEFAULT false;

ALTER TABLE public.config_settings
  DROP COLUMN IF EXISTS system_prompt_override;
