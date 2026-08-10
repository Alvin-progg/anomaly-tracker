-- Backup & Recovery: history of pg_dump artifacts plus the schedule/retention values the Backup
-- Status card displays. Read by app/lib/backup/backups.ts (bearer token, admin session) and
-- written by app/lib/backup/pg.ts (service role, because the cron-driven app/api/backup/run route
-- has no user JWT at all).
--
-- WHY A SEPARATE SCHEMA. These two tables are the only thing in the database that must survive a
-- restore, so they cannot live in `public`. app/lib/backup/pg.ts dumps with
-- `pg_dump --clean -n public -n auth -n storage`, and pg_dump emits a literal
-- `DROP SCHEMA IF EXISTS public;` for an explicitly selected schema (verified against
-- postgres:17.6 — `--exclude-table` does not save them, the whole schema goes). Restoring an old
-- dump would therefore erase the record of every backup taken since, including the safety dump
-- the restore itself had just created. `raao_ops` is never named in the dump, so it survives.
--
-- Exposing it through PostgREST needs `raao_ops` added to `schemas` under `[api]` in
-- supabase/config.toml, and requires `supabase stop && supabase start` to take effect. With more
-- than one schema exposed, PostgREST reaches a non-default one via the `Accept-Profile` (read) /
-- `Content-Profile` (write) headers — see app/lib/backup/backups.ts.
--
-- RLS follows audit_log's admin-gated shape, NOT the public-read shape of system_config.sql /
-- security_settings.sql. Those tables are read before a session exists (loginAction, the layout
-- idle timeout); these are not, and they expose the server's storage path and dump topology, so
-- there is no reason to let `anon` see them.
--
-- service_role bypasses RLS *policy checks*, but that is separate from the base-table GRANT —
-- Postgres still requires an explicit grant, the same trap already documented for login_attempts
-- in 20260806130000_security_settings.sql. Same reason for the audit_log grant at the bottom of
-- this file: 20260806090520_dashboard_tracking.sql granted insert to `authenticated` only, so an
-- automated backup's audit row would fail silently without it.

create schema if not exists raao_ops;

grant usage on schema raao_ops to authenticated, service_role;

-- Nothing in raao_ops may depend on an object inside a dumped schema, or the point of the schema
-- is defeated. In particular the admin check below inlines what auth.jwt() does rather than
-- calling it: pg_restore --clean has to DROP FUNCTION auth.jwt() before recreating it, and a
-- policy here referencing it is not in the dump and so cannot be dropped first — the restore then
-- fails with `cannot drop function auth.jwt() because other objects depend on it`. Everything
-- else in this repo should keep using auth.jwt(); this file is the exception, for that reason.
create function raao_ops.is_admin() returns boolean
  language sql stable
  as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb -> 'app_metadata' ->> 'role' = 'admin'
  $$;

grant execute on function raao_ops.is_admin() to authenticated, service_role;

create table raao_ops.backup_settings (
  id smallint primary key default 1 check (id = 1),
  schedule_label text not null default 'Daily at 2:00 AM',
  schedule_cron text not null default '0 2 * * *',
  retention_days integer not null default 30 check (retention_days between 1 and 3650),
  storage_path text not null default '/backups/raao',
  updated_at timestamptz not null default now()
);

alter table raao_ops.backup_settings enable row level security;

create policy "admins can view backup settings" on raao_ops.backup_settings
  for select using (raao_ops.is_admin());

grant select on raao_ops.backup_settings to authenticated;
grant select, insert, update, delete on raao_ops.backup_settings to service_role;

insert into raao_ops.backup_settings (id) values (1)
on conflict (id) do nothing;

-- One row per pg_dump attempt. `status = 'running'` exists because a dump is long enough to need
-- a concurrency guard and because a crashed process should leave a diagnosable row rather than
-- nothing. `type = 'safety'` marks the automatic pre-restore dump taken by restoreBackup() — it
-- is exempt from retention pruning, since it is the only way back from a bad restore.

create table raao_ops.backups (
  id uuid primary key default gen_random_uuid(),
  backup_ref text not null unique,
  file_name text not null,
  size_bytes bigint not null default 0,
  checksum text,
  type text not null check (type in ('manual', 'automated', 'safety')),
  status text not null check (status in ('running', 'success', 'failed')),
  pg_version text,
  error text,
  triggered_by text not null default 'system',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index backups_created_at_idx on raao_ops.backups (created_at desc);

alter table raao_ops.backups enable row level security;

create policy "admins can view backups" on raao_ops.backups
  for select using (raao_ops.is_admin());

grant select on raao_ops.backups to authenticated;
grant select, insert, update, delete on raao_ops.backups to service_role;

-- Lets recordSystemAuditEvent() (app/lib/tracking/tracking.ts) log automated backups and the
-- post-restore entry, neither of which has a user session behind it. This grant lives in `public`
-- and so is itself carried in every dump taken after this migration.
grant insert on public.audit_log to service_role;

-- Automated backups are driven from outside the app — Next.js has no scheduler. On the municipal
-- server, add a crontab line matching backup_settings.schedule_cron:
--   0 2 * * * curl -sf -X POST -H "x-backup-secret: $BACKUP_CRON_SECRET" \
--     http://localhost:3000/api/backup/run
