-- Create the Master Lookup Table for Tier Names
CREATE TABLE public.plan_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_type text UNIQUE NOT NULL, -- 'pilot', 'lite', etc.
  created_at timestamptz DEFAULT now()
);

-- Seed it with your specific tiers
INSERT INTO public.plan_tiers (plan_type)
VALUES ('pilot'), ('lite'), ('pro'), ('corporate');
