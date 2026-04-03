ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS teams_user_id text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_sub_teams_user_id ON public.subscriptions(teams_user_id);
