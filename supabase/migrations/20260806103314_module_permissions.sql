-- Real RBAC enforcement for Budget Personnel. Personnel-only by design — there is
-- deliberately no `role` column: System Administrator access is hardcoded always-on in
-- application code (app/lib/permissions/permissions.ts), never represented as a row here,
-- so there is no code path that can ever disable it, by human error or otherwise.
--
-- SELECT is public (not admin-gated) because app/lib/auth/actions.ts's loginAction must
-- check the `login` flag before a session/JWT exists — no bearer token available at that
-- point. The data is non-sensitive feature flags, not a secret, so this is an acceptable
-- trade. Only UPDATE is admin-gated, via the JWT role claim (same pattern as audit_log and
-- user_sessions from the earlier dashboard migration).

create table public.module_permissions (
  module text primary key,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.module_permissions enable row level security;

create policy "anyone can read module permissions" on public.module_permissions
  for select using (true);

create policy "admins can update module permissions" on public.module_permissions
  for update using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select on public.module_permissions to anon, authenticated;
grant update on public.module_permissions to authenticated;

insert into public.module_permissions (module, enabled) values
  ('login', true),
  ('dashboard', true),
  ('raao_records', true),
  ('budget_monitoring', true),
  ('ai_alerts', true),
  ('document_creation', true),
  ('reports', true),
  ('archives', true)
on conflict (module) do nothing;
