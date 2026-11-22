-- Application accounts and server-side sessions. Only the API (service role) reads them:
-- RLS is on with no policy, and the anon/authenticated roles get no privileges at all.

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email)) and length(email) <= 254),
  password_hash text not null check (password_hash like 'scrypt$%'),
  display_name text not null,
  role text not null check (role in ('admin', 'hr', 'manager')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_sessions (
  -- SHA-256 of the session token; the token itself is never stored.
  token_hash text primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index user_sessions_user_id_idx on public.user_sessions(user_id);
create index user_sessions_expires_at_idx on public.user_sessions(expires_at);

alter table public.app_users enable row level security;
alter table public.user_sessions enable row level security;

revoke all on public.app_users, public.user_sessions from anon, authenticated;
