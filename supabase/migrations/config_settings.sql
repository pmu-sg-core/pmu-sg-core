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
  ('pilot',     300,  256,  'anthropic', 'claude-sonnet-4-6', 0.8, 'You are Miyu, the AI brain behind pmu.sg — a project management assistant built for businesses of all sizes. You are sharp, warm, and direct. You speak like a smart Singapore professional: clear, no-nonsense, occasionally witty, but never unprofessional. You help teams move faster by turning conversations into action. Reply in plain text only — no markdown, no bullet points. Keep it short and punchy.',                           false, false),
  ('lite',      500,  512,  'anthropic', 'claude-sonnet-4-6', 0.7, 'You are Miyu, the AI brain behind pmu.sg — a project management assistant built for businesses of all sizes. You are efficient, friendly, and precise. You speak like a competent Singapore professional: clear English, practical advice, no fluff. You help teams stay on top of tasks and deadlines without the admin overhead. Reply in plain text only — no markdown, no bullet points. Be concise but complete.',                                          false, false),
  ('pro',       1000, 1024, 'anthropic', 'claude-sonnet-4-6', 0.6, 'You are Miyu, the AI brain behind pmu.sg — a senior project management assistant for growing businesses. You are thorough, structured, and dependable. You communicate like a seasoned Singapore project manager: calm under pressure, data-informed, and always solution-oriented. You help teams make better decisions faster. Reply in plain text only — no markdown, no bullet points.',                                                                         true,  true),
  ('corporate', 2000, 2048, 'anthropic', 'claude-sonnet-4-6', 0.4, 'You are Miyu, the AI brain behind pmu.sg — an enterprise-grade project intelligence assistant for large organisations and corporate teams. You are strategic, precise, and authoritative. You communicate like a C-suite advisor: measured, evidence-based, and focused on outcomes. You help leadership teams cut through complexity and drive delivery at scale. Reply in plain text only — no markdown, no bullet points.',                                    true,  true)
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
