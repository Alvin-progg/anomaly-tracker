-- Adds the INSERT policy anomaly_alerts never got (only seed-time superuser writes existed
-- before), and the detection function personnel's own obligation-creation flow calls.

create policy "signed-in staff can insert anomaly_alerts" on public.anomaly_alerts
for insert with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'personnel')
);
grant insert on public.anomaly_alerts to authenticated;

-- Fires when a newly-certified obligation's amount is >=150% above its department's average
-- obligation amount over the trailing 30 days (the existing 'Expenditure Spike Alert' threshold
-- row in financial_thresholds, already seeded at 150 — this reuses it rather than adding new
-- config). security invoker so it runs under the calling personnel/admin's own RLS, same as
-- every other read in this schema. Returns the inserted alert row, or nothing if it didn't fire.
create function public.detect_expenditure_spike(p_obligation_id uuid)
returns setof public.anomaly_alerts
language plpgsql
security invoker
as $$
declare
  v_obligation record;
  v_avg numeric;
  v_threshold_pct numeric;
  v_pct_above numeric;
  v_confidence smallint;
  v_severity text;
  v_alert_ref text;
  v_description text;
  v_new_row public.anomaly_alerts;
begin
  select o.id, o.ref, o.department_id, o.amount, o.record_date
    into v_obligation
    from public.obligations o
    where o.id = p_obligation_id;
  if not found then
    return;
  end if;

  select avg(o.amount) into v_avg
    from public.obligations o
    where o.department_id = v_obligation.department_id
      and o.id <> v_obligation.id
      and o.status <> 'draft'
      and o.record_date >= v_obligation.record_date - interval '30 days'
      and o.record_date < v_obligation.record_date;
  if v_avg is null or v_avg = 0 then
    return; -- no baseline yet for this department, nothing to compare against
  end if;

  select value::numeric into v_threshold_pct
    from public.financial_thresholds
    where module = 'obligations' and threshold_type = 'percentage' and name = 'Expenditure Spike Alert'
    limit 1;
  if v_threshold_pct is null then
    return;
  end if;

  v_pct_above := ((v_obligation.amount - v_avg) / v_avg) * 100;
  if v_pct_above < v_threshold_pct then
    return; -- under threshold, not a spike
  end if;

  v_confidence := least(99, greatest(50, round(50 + v_pct_above / 3)));
  v_severity := case when v_pct_above >= v_threshold_pct * 1.5 then 'High' else 'Medium' end;

  select 'AID-' || to_char(v_obligation.record_date, 'YYYY') || '-' ||
    lpad((coalesce(max(substring(alert_ref from '\d+$')::int), 0) + 1)::text, 4, '0')
    into v_alert_ref
    from public.anomaly_alerts
    where alert_ref like 'AID-' || to_char(v_obligation.record_date, 'YYYY') || '-%';

  v_description := format(
    'Obligation amount ₱%s is %s%% above the 30-day average for this department.',
    to_char(v_obligation.amount, 'FM999,999,999,999.00'), round(v_pct_above)
  );

  insert into public.anomaly_alerts
    (alert_ref, alert_type, record_ref, department_id, description, confidence, severity, status, detected_at)
  values
    (v_alert_ref, 'Expenditure Spike', v_obligation.ref, v_obligation.department_id, v_description,
     v_confidence, v_severity, 'Pending', v_obligation.record_date)
  returning * into v_new_row;

  return next v_new_row;
end;
$$;

grant execute on function public.detect_expenditure_spike(uuid) to authenticated;
