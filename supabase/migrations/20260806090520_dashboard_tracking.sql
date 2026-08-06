-- Admin dashboard "real data" support: tracks active login sessions and a
-- lightweight auth audit trail (login/logout events), read via PostgREST with
-- the signed-in user's own JWT so RLS enforces who can see what. Writes happen
-- on login/logout (app/lib/auth/actions.ts, app/lib/auth/session.ts); reads
-- happen from app/admin/dashboard-content.tsx (admin-only).

create table public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  role text not null,
  module text not null default 'Authentication',
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

alter table public.user_sessions enable row level security;
alter table public.audit_log enable row level security;

create policy "admins can view sessions" on public.user_sessions
  for select using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins can view audit log" on public.audit_log
  for select using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "users can insert own session" on public.user_sessions
  for insert with check (auth.uid() = user_id);
create policy "users can insert own audit entries" on public.audit_log
  for insert with check (auth.uid() = user_id);
create policy "users can delete own session" on public.user_sessions
  for delete using (auth.uid() = user_id);

grant select, insert, delete on public.user_sessions to authenticated;
grant select, insert on public.audit_log to authenticated;
