-- User roles table — links Supabase Auth users to app roles
CREATE TABLE public.user_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user', -- 'admin', 'user'
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Only service role can read/write this table
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
