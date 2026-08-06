-- Security Policies: password policy, session timeout, login lockout, and store-only
-- authentication display settings (2FA/encryption standard have no real backend today — see
-- app/admin/security/ plan notes). SELECT is public (`anon` + `authenticated`), same rationale
-- as module_permissions.sql and system_config.sql: app/lib/auth/actions.ts's loginAction must
-- read max_failed_login_attempts/lockout_duration_minutes/session_timeout_minutes before a
-- session exists, and app/admin/layout.tsx/personnel/layout.tsx read session_timeout_minutes
-- on every request. Writes are admin-only via the JWT `app_metadata.role` claim.

create table public.security_settings (
  id smallint primary key default 1 check (id = 1),
  password_min_length integer not null default 8 check (password_min_length in (8, 10, 12)),
  password_require_uppercase boolean not null default true,
  password_require_numbers boolean not null default true,
  password_require_special boolean not null default true,
  password_prevent_reuse boolean not null default false,
  password_expiry_days integer not null default 90,
  session_timeout_minutes integer not null default 15 check (session_timeout_minutes between 5 and 60),
  two_factor_enabled boolean not null default false,
  encryption_standard text not null default 'aes256' check (encryption_standard in ('aes256', 'aes128')),
  max_failed_login_attempts integer not null default 5,
  lockout_duration_minutes integer not null default 10,
  updated_at timestamptz not null default now()
);

alter table public.security_settings enable row level security;

create policy "anyone can read security settings" on public.security_settings
  for select using (true);

create policy "admins can update security settings" on public.security_settings
  for update using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select on public.security_settings to anon, authenticated;
grant update on public.security_settings to authenticated;

insert into public.security_settings (id) values (1)
on conflict (id) do nothing;

-- Per-account failed-login tracker backing the temporary auto-expiring lockout in loginAction.
-- No RLS policies at all (RLS stays enabled, just policy-less — default-deny for anon/
-- authenticated). This table is only ever touched with SUPABASE_SERVICE_ROLE_KEY
-- (app/lib/auth/login-attempts.ts), the same key app/lib/auth/admin.ts already uses for the
-- GoTrue admin API. service_role bypasses RLS *policy checks*, but bypassing RLS is a separate
-- concern from the base table GRANT — Postgres still requires an explicit grant on the table
-- itself, so service_role needs one here even though no anon/authenticated role does. It must
-- be writable before any session/JWT exists (that's the point) and must never be directly
-- readable or writable by an end-user's own anon/authenticated request.

create table public.login_attempts (
  email text primary key,
  failed_count integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.login_attempts enable row level security;

grant select, insert, update, delete on public.login_attempts to service_role;
