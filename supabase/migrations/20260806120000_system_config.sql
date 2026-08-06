-- System Configuration: general settings, fiscal years, financial thresholds, fund
-- classifications. Same RLS shape as module_permissions.sql: SELECT is public (`anon` +
-- `authenticated`) — the app/lib/config/* read functions fetch with only the anon apikey, no
-- bearer token, same as app/lib/permissions/permissions.ts, and this is non-sensitive config
-- data (personnel-facing modules will read it too: document creation's fund dropdown,
-- monitoring's threshold display, records' active fiscal year). Writes are admin-only via the
-- JWT `app_metadata.role` claim, same as audit_log/user_sessions/module_permissions.

create table public.system_settings (
  id smallint primary key default 1 check (id = 1),
  system_name text not null,
  municipal_office text not null,
  date_format text not null default 'MM/DD/YYYY' check (date_format in ('MM/DD/YYYY', 'DD/MM/YYYY')),
  notify_email_alerts boolean not null default true,
  notify_in_app boolean not null default true,
  notify_daily_summary boolean not null default false,
  notify_ai_confidence boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.system_settings enable row level security;

create policy "anyone can read system settings" on public.system_settings
  for select using (true);

create policy "admins can update system settings" on public.system_settings
  for update using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select on public.system_settings to anon, authenticated;
grant update on public.system_settings to authenticated;

insert into public.system_settings (id, system_name, municipal_office, date_format, notify_email_alerts, notify_in_app, notify_daily_summary, notify_ai_confidence)
values (1, 'RAAO Monitor', 'Municipal Budget Office – San Pascual', 'MM/DD/YYYY', true, true, false, true)
on conflict (id) do nothing;

-- Fiscal years: at most one `active` row, enforced by a partial unique index rather than a
-- trigger — activateFiscalYear() (app/lib/config/fiscal-years.ts) closes the current active
-- row before activating the target one, sequentially (two PATCHes, not a transaction; this is
-- an admin-only, low-frequency write path so the brief window between them is an accepted
-- trade-off, not a real race condition in practice).

create table public.fiscal_years (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  start_date date not null,
  end_date date not null,
  status text not null default 'closed' check (status in ('active', 'closed')),
  created_at timestamptz not null default now()
);

create unique index fiscal_years_one_active on public.fiscal_years (status) where status = 'active';

alter table public.fiscal_years enable row level security;

create policy "anyone can read fiscal years" on public.fiscal_years
  for select using (true);

create policy "admins can insert fiscal years" on public.fiscal_years
  for insert with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admins can update fiscal years" on public.fiscal_years
  for update using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select on public.fiscal_years to anon, authenticated;
grant insert, update on public.fiscal_years to authenticated;

insert into public.fiscal_years (label, start_date, end_date, status) values
  ('FY 2024', '2024-01-01', '2024-12-31', 'active'),
  ('FY 2023', '2023-01-01', '2023-12-31', 'closed'),
  ('FY 2022', '2022-01-01', '2022-12-31', 'closed')
on conflict (label) do nothing;

create table public.financial_thresholds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  module text not null check (module in ('obligations', 'allotments', 'liquidations', 'all_modules')),
  threshold_type text not null check (threshold_type in ('percentage', 'days', 'amount', 'flag')),
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.financial_thresholds enable row level security;

create policy "anyone can read financial thresholds" on public.financial_thresholds
  for select using (true);

create policy "admins can insert financial thresholds" on public.financial_thresholds
  for insert with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admins can update financial thresholds" on public.financial_thresholds
  for update using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select on public.financial_thresholds to anon, authenticated;
grant insert, update on public.financial_thresholds to authenticated;

insert into public.financial_thresholds (name, module, threshold_type, value) values
  ('Expenditure Spike Alert', 'obligations', 'percentage', '150'),
  ('Obligation-Allotment Ceiling', 'obligations', 'percentage', '100'),
  ('Delayed Liquidation', 'liquidations', 'days', '30'),
  ('Duplicate Entry Detection', 'all_modules', 'flag', 'Enabled'),
  ('Remaining Balance Warning', 'allotments', 'percentage', '10')
on conflict do nothing;

-- Fund classification is a fixed taxonomy in the front-end reference (hardcoded dropdown
-- across Personnel forms), promoted to an admin-managed table here so it has one source of
-- truth. `active` is a soft-delete flag (same convention as module_permissions.enabled and
-- users.banned) rather than a hard delete, since existing RAAO records may already reference a
-- fund by name.

create table public.fund_classifications (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.fund_classifications enable row level security;

create policy "anyone can read fund classifications" on public.fund_classifications
  for select using (true);

create policy "admins can insert fund classifications" on public.fund_classifications
  for insert with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admins can update fund classifications" on public.fund_classifications
  for update using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select on public.fund_classifications to anon, authenticated;
grant insert, update on public.fund_classifications to authenticated;

insert into public.fund_classifications (name, short_code, active) values
  ('General Fund', 'GF', true),
  ('Special Education Fund (SEF)', 'SEF', true),
  ('20% Development Fund', 'DF', true)
on conflict (name) do nothing;
