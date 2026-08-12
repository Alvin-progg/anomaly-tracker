-- The RAAO ledger the Budget Personnel modules read: departments plus the four record types the
-- Registry of Appropriations, Allotments and Obligations is made of, and the AI anomaly alerts
-- raised against them. Until now `public` held only auth/config tables, so the personnel dashboard
-- had nothing to show.
--
-- SHAPE. Every record row carries fiscal_year_id + fund_id (the tables seeded in
-- 20260806120000_system_config.sql) and a department, so the dashboard's three cuts — by fund, by
-- department, by fiscal year — are all plain GROUP BYs rather than three different denormalised
-- copies. The chain is appropriation -> allotment -> obligation -> liquidation, each pointing at
-- its parent, which is what lets "obligations exceed allotment" be a query rather than a guess.
--
-- AMOUNTS are numeric(14,2), never float: these are pesos and they get summed.
--
-- RLS. Both roles read (unlike the admin-only audit_log): the whole point of these tables is the
-- personnel portal. Nothing here is writable through the Data API yet — the create/certify/post
-- flows land with the RAAO Records module, and until then a missing INSERT policy is the honest
-- state rather than an open door.
--
-- The aggregate views at the bottom exist because PostgREST cannot GROUP BY. They are
-- `security_invoker` so the caller's RLS still applies — a view without it would run as its owner
-- and quietly bypass the policies above it.

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create type public.record_status as enum ('draft', 'pending', 'certified', 'posted');

create table public.appropriations (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  fiscal_year_id uuid not null references public.fiscal_years (id),
  fund_id uuid not null references public.fund_classifications (id),
  department_id uuid not null references public.departments (id),
  description text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  status public.record_status not null default 'draft',
  record_date date not null,
  created_at timestamptz not null default now()
);

create table public.allotments (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  appropriation_id uuid references public.appropriations (id) on delete set null,
  fiscal_year_id uuid not null references public.fiscal_years (id),
  fund_id uuid not null references public.fund_classifications (id),
  department_id uuid not null references public.departments (id),
  description text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  status public.record_status not null default 'draft',
  record_date date not null,
  created_at timestamptz not null default now()
);

create table public.obligations (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  allotment_id uuid references public.allotments (id) on delete set null,
  fiscal_year_id uuid not null references public.fiscal_years (id),
  fund_id uuid not null references public.fund_classifications (id),
  department_id uuid not null references public.departments (id),
  description text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  status public.record_status not null default 'draft',
  record_date date not null,
  created_at timestamptz not null default now()
);

create table public.liquidations (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  obligation_id uuid not null references public.obligations (id) on delete cascade,
  description text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  status public.record_status not null default 'draft',
  record_date date not null,
  created_at timestamptz not null default now()
);

-- Raised by the anomaly detection pass, reviewed by personnel on /personnel/alerts. `record_ref`
-- is the human reference of the flagged record (text, not an FK) because an alert can point at any
-- of the four record types — and must survive the record being superseded.
create table public.anomaly_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_ref text not null unique,
  alert_type text not null,
  record_ref text not null,
  department_id uuid references public.departments (id),
  description text not null,
  confidence smallint not null check (confidence between 0 and 100),
  severity text not null check (severity in ('Low', 'Medium', 'High')),
  status text not null default 'Pending' check (status in ('Pending', 'Valid Anomaly', 'False Positive')),
  detected_at date not null,
  created_at timestamptz not null default now()
);

create index appropriations_fy_idx on public.appropriations (fiscal_year_id);
create index allotments_fy_idx on public.allotments (fiscal_year_id);
create index obligations_fy_idx on public.obligations (fiscal_year_id);
create index anomaly_alerts_recent_idx on public.anomaly_alerts (status, detected_at desc);

alter table public.departments enable row level security;
alter table public.appropriations enable row level security;
alter table public.allotments enable row level security;
alter table public.obligations enable row level security;
alter table public.liquidations enable row level security;
alter table public.anomaly_alerts enable row level security;

do $$
declare
  target text;
begin
  foreach target in array array[
    'departments', 'appropriations', 'allotments', 'obligations', 'liquidations', 'anomaly_alerts'
  ] loop
    execute format(
      'create policy "signed-in staff can read %1$s" on public.%1$I for select using ('
      || '(auth.jwt() -> ''app_metadata'' ->> ''role'') in (''admin'', ''personnel''))',
      target
    );
    execute format('grant select on public.%I to authenticated', target);
  end loop;
end $$;

-- ── Aggregates ───────────────────────────────────────────────────────────────
-- Scoped to the one fiscal year marked `active` in public.fiscal_years, so closing a year moves
-- the dashboard on its own. `draft` records are excluded everywhere: an unsubmitted line is not
-- money that has moved.

create view public.budget_summary
with (security_invoker = on) as
select
  fy.label as fiscal_year,
  coalesce((select sum(a.amount) from public.appropriations a
            where a.fiscal_year_id = fy.id and a.status <> 'draft'), 0) as total_appropriations,
  coalesce((select sum(al.amount) from public.allotments al
            where al.fiscal_year_id = fy.id and al.status <> 'draft'), 0) as total_allotments,
  coalesce((select sum(o.amount) from public.obligations o
            where o.fiscal_year_id = fy.id and o.status <> 'draft'), 0) as total_obligations
from public.fiscal_years fy
where fy.status = 'active';

create view public.budget_by_department
with (security_invoker = on) as
select
  d.id as department_id,
  d.name as department,
  d.short_code,
  coalesce(sum(a.amount) filter (where a.status <> 'draft'), 0) as appropriated,
  coalesce((select sum(o.amount) from public.obligations o
            where o.department_id = d.id and o.status <> 'draft'
              and o.fiscal_year_id = (select id from public.fiscal_years where status = 'active')), 0) as obligated
from public.departments d
left join public.appropriations a
  on a.department_id = d.id
  and a.fiscal_year_id = (select id from public.fiscal_years where status = 'active')
where d.active
group by d.id, d.name, d.short_code;

create view public.budget_by_fund
with (security_invoker = on) as
select
  f.id as fund_id,
  f.name as fund,
  f.short_code,
  coalesce(sum(a.amount) filter (where a.status <> 'draft'), 0) as appropriated
from public.fund_classifications f
left join public.appropriations a
  on a.fund_id = f.id
  and a.fiscal_year_id = (select id from public.fiscal_years where status = 'active')
where f.active
group by f.id, f.name, f.short_code;

grant select on public.budget_summary, public.budget_by_department, public.budget_by_fund to authenticated;
