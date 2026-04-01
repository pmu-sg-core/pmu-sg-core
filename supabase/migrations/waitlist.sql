-- Waitlist table for pmu.sg landing page signups
create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  first_name  text,
  last_name   text,
  reason      text,
  source      text not null default 'landing_page',
  created_at  timestamptz not null default now()
);

-- Only the service role can insert/read (called from backend API route)
alter table public.waitlist enable row level security;

create policy "Service role full access"
  on public.waitlist
  for all
  using (auth.role() = 'service_role');
