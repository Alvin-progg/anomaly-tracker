-- Password age tracking — the enforcement half of `security_settings.password_expiry_days`, which
-- until now was stored by /admin/security and read by nothing. Written by
-- app/lib/auth/password-state.ts at every point a password is set (admin create, admin reset, the
-- user's own change on /change-password) and read by loginAction + verifySession.
--
-- WHY A TABLE AT ALL. GoTrue has no "password last changed" column. auth.users.updated_at is the
-- nearest thing, but it moves on any user edit — a role change or a ban would silently reset the
-- expiry clock — so it cannot be the source of truth. Only the backfill below uses it, as the best
-- available guess for accounts that predate this table.
--
-- WHY `public`, NOT `raao_ops`. The opposite reasoning to 20260810120000_backup_recovery.sql: this
-- data describes the accounts in `auth`, so it must travel *with* them in a dump and be replaced
-- along with them by a restore. A row here without its auth.users row would be meaningless.
--
-- RLS follows the login_attempts shape from 20260806130000_security_settings.sql:49-58 — enabled
-- with no policies (default-deny for anon/authenticated) plus a service_role grant, because the
-- base-table GRANT is a separate concern from bypassing RLS policy checks. This is read during
-- login, before any user JWT exists, and no client ever needs to see it.

create table public.user_password_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  password_changed_at timestamptz not null default now(),
  -- Set for a password somebody else chose (admin create / admin reset): force a change at the
  -- next login regardless of age.
  must_change boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_password_state enable row level security;

grant select, insert, update, delete on public.user_password_state to service_role;

insert into public.user_password_state (user_id, password_changed_at)
select id, coalesce(updated_at, created_at) from auth.users
on conflict (user_id) do nothing;
