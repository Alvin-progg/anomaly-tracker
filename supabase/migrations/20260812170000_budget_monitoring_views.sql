-- Budget Monitoring Overview needs fund-grain allotment/obligation alongside appropriation.
-- Additive columns on the existing view — getFundDistribution (dashboard donut chart) only
-- selects `appropriated`, so this doesn't disturb that consumer.
create or replace view public.budget_by_fund
with (security_invoker = on) as
select
  f.id as fund_id,
  f.name as fund,
  f.short_code,
  coalesce(sum(a.amount) filter (where a.status <> 'draft'), 0) as appropriated,
  coalesce((select sum(al.amount) from public.allotments al
            where al.fund_id = f.id and al.status <> 'draft'
              and al.fiscal_year_id = (select id from public.fiscal_years where status = 'active')), 0) as allotted,
  coalesce((select sum(o.amount) from public.obligations o
            where o.fund_id = f.id and o.status <> 'draft'
              and o.fiscal_year_id = (select id from public.fiscal_years where status = 'active')), 0) as obligated
from public.fund_classifications f
left join public.appropriations a
  on a.fund_id = f.id
  and a.fiscal_year_id = (select id from public.fiscal_years where status = 'active')
where f.active
group by f.id, f.name, f.short_code;
