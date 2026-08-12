-- Rule 5 needs a threshold that doesn't exist yet — every other rule in this migration reuses an
-- already-seeded financial_thresholds row.
insert into public.financial_thresholds (name, module, threshold_type, value)
values ('Approval Threshold', 'obligations', 'amount', '500000')
on conflict do nothing;

-- Rule 2: fires when the just-inserted obligation brings its allotment's total obligated amount
-- to >= the 'Obligation-Allotment Ceiling' threshold (100%). The obligation is already 'certified'
-- in the table by the time this runs (createObligationAction calls it after createObligation
-- succeeds), so the sum below naturally includes it — no self-exclusion like Rule 1's average.
create function public.detect_exceeds_allotment(p_obligation_id uuid)
returns setof public.anomaly_alerts
language plpgsql security invoker as $$
declare
  v_obligation record;
  v_allotment_amount numeric;
  v_obligated_total numeric;
  v_threshold_pct numeric;
  v_pct numeric;
  v_confidence smallint;
  v_severity text;
  v_alert_ref text;
  v_new_row public.anomaly_alerts;
begin
  select o.id, o.ref, o.department_id, o.record_date, o.allotment_id
    into v_obligation from public.obligations o where o.id = p_obligation_id;
  if not found or v_obligation.allotment_id is null then return; end if;

  select amount into v_allotment_amount from public.allotments where id = v_obligation.allotment_id;
  if v_allotment_amount is null or v_allotment_amount = 0 then return; end if;

  select coalesce(sum(amount), 0) into v_obligated_total
    from public.obligations where allotment_id = v_obligation.allotment_id and status <> 'draft';

  select value::numeric into v_threshold_pct from public.financial_thresholds
    where module = 'obligations' and threshold_type = 'percentage' and name = 'Obligation-Allotment Ceiling' limit 1;
  if v_threshold_pct is null then return; end if;

  v_pct := (v_obligated_total / v_allotment_amount) * 100;
  if v_pct < v_threshold_pct then return; end if;

  v_confidence := least(99, greatest(60, round(v_pct)));
  v_severity := case when v_pct >= 100 then 'High' else 'Medium' end;

  select 'AID-' || to_char(v_obligation.record_date, 'YYYY') || '-' ||
    lpad((coalesce(max(substring(alert_ref from '\d+$')::int), 0) + 1)::text, 4, '0')
    into v_alert_ref from public.anomaly_alerts
    where alert_ref like 'AID-' || to_char(v_obligation.record_date, 'YYYY') || '-%';

  insert into public.anomaly_alerts
    (alert_ref, alert_type, record_ref, department_id, description, confidence, severity, status, detected_at)
  values (v_alert_ref, 'Obligation Exceeds Allotment', v_obligation.ref, v_obligation.department_id,
    format('Obligation would bring total obligations to %s%% of the released allotment.', round(v_pct, 1)),
    v_confidence, v_severity, 'Pending', v_obligation.record_date)
  returning * into v_new_row;
  return next v_new_row;
end;
$$;
grant execute on function public.detect_exceeds_allotment(uuid) to authenticated;

-- Rule 3: same department + payee + amount + description, record_date within 7 days either
-- direction (the seeded sample's own wording — "same payee, amount and description within 7
-- days"). Skips entirely if the 'Duplicate Entry Detection' flag is off.
create function public.detect_duplicate_obligation(p_obligation_id uuid)
returns setof public.anomaly_alerts
language plpgsql security invoker as $$
declare
  v_obligation record;
  v_flag text;
  v_duplicate_ref text;
  v_alert_ref text;
  v_new_row public.anomaly_alerts;
begin
  select o.id, o.ref, o.department_id, o.amount, o.payee, o.description, o.record_date
    into v_obligation from public.obligations o where o.id = p_obligation_id;
  if not found then return; end if;

  select value into v_flag from public.financial_thresholds
    where module = 'all_modules' and threshold_type = 'flag' and name = 'Duplicate Entry Detection' limit 1;
  if v_flag is distinct from 'Enabled' then return; end if;

  select o.ref into v_duplicate_ref from public.obligations o
    where o.id <> v_obligation.id and o.status <> 'draft'
      and o.department_id = v_obligation.department_id
      and o.amount = v_obligation.amount
      and lower(o.payee) = lower(v_obligation.payee)
      and lower(o.description) = lower(v_obligation.description)
      and o.record_date between v_obligation.record_date - interval '7 days' and v_obligation.record_date + interval '7 days'
    order by o.record_date desc limit 1;
  if v_duplicate_ref is null then return; end if;

  select 'AID-' || to_char(v_obligation.record_date, 'YYYY') || '-' ||
    lpad((coalesce(max(substring(alert_ref from '\d+$')::int), 0) + 1)::text, 4, '0')
    into v_alert_ref from public.anomaly_alerts
    where alert_ref like 'AID-' || to_char(v_obligation.record_date, 'YYYY') || '-%';

  insert into public.anomaly_alerts
    (alert_ref, alert_type, record_ref, department_id, description, confidence, severity, status, detected_at)
  values (v_alert_ref, 'Duplicate Entry Detected', v_obligation.ref, v_obligation.department_id,
    format('Possible duplicate of %s. Same payee, amount and description within 7 days.', v_duplicate_ref),
    90, 'High', 'Pending', v_obligation.record_date)
  returning * into v_new_row;
  return next v_new_row;
end;
$$;
grant execute on function public.detect_duplicate_obligation(uuid) to authenticated;

-- Rule 5: an obligation sitting at 90-99.99% of the approval threshold, with >=2 other obligations
-- in the same department in the same range over the trailing 30 days (this one plus 2 prior = 3+).
create function public.detect_structuring(p_obligation_id uuid)
returns setof public.anomaly_alerts
language plpgsql security invoker as $$
declare
  v_obligation record;
  v_threshold numeric;
  v_near_count int;
  v_alert_ref text;
  v_new_row public.anomaly_alerts;
begin
  select o.id, o.ref, o.department_id, o.amount, o.record_date
    into v_obligation from public.obligations o where o.id = p_obligation_id;
  if not found then return; end if;

  select value::numeric into v_threshold from public.financial_thresholds
    where module = 'obligations' and threshold_type = 'amount' and name = 'Approval Threshold' limit 1;
  if v_threshold is null then return; end if;
  if v_obligation.amount < v_threshold * 0.9 or v_obligation.amount >= v_threshold then return; end if;

  select count(*) into v_near_count from public.obligations
    where department_id = v_obligation.department_id and id <> v_obligation.id and status <> 'draft'
      and amount >= v_threshold * 0.9 and amount < v_threshold
      and record_date between v_obligation.record_date - interval '30 days' and v_obligation.record_date;
  if v_near_count < 2 then return; end if;

  select 'AID-' || to_char(v_obligation.record_date, 'YYYY') || '-' ||
    lpad((coalesce(max(substring(alert_ref from '\d+$')::int), 0) + 1)::text, 4, '0')
    into v_alert_ref from public.anomaly_alerts
    where alert_ref like 'AID-' || to_char(v_obligation.record_date, 'YYYY') || '-%';

  insert into public.anomaly_alerts
    (alert_ref, alert_type, record_ref, department_id, description, confidence, severity, status, detected_at)
  values (v_alert_ref, 'Structuring', v_obligation.ref, v_obligation.department_id,
    format('%s obligations just below the ₱%s approval threshold within 30 days for this department.',
      v_near_count + 1, to_char(v_threshold, 'FM999,999,999,999.00')),
    80, 'Medium', 'Pending', v_obligation.record_date)
  returning * into v_new_row;
  return next v_new_row;
end;
$$;
grant execute on function public.detect_structuring(uuid) to authenticated;

-- Rule 6: fires if the obligation still has no attachment_path once createObligationAction's
-- upload branch has run (checking the persisted column, not a request-time flag, is the single
-- source of truth — covers "no file chosen" and "upload failed" identically).
create function public.detect_missing_attachment(p_obligation_id uuid)
returns setof public.anomaly_alerts
language plpgsql security invoker as $$
declare
  v_obligation record;
  v_alert_ref text;
  v_new_row public.anomaly_alerts;
begin
  select o.id, o.ref, o.department_id, o.record_date, o.attachment_path
    into v_obligation from public.obligations o where o.id = p_obligation_id;
  if not found or v_obligation.attachment_path is not null then return; end if;

  select 'AID-' || to_char(v_obligation.record_date, 'YYYY') || '-' ||
    lpad((coalesce(max(substring(alert_ref from '\d+$')::int), 0) + 1)::text, 4, '0')
    into v_alert_ref from public.anomaly_alerts
    where alert_ref like 'AID-' || to_char(v_obligation.record_date, 'YYYY') || '-%';

  insert into public.anomaly_alerts
    (alert_ref, alert_type, record_ref, department_id, description, confidence, severity, status, detected_at)
  values (v_alert_ref, 'Missing Supporting Document', v_obligation.ref, v_obligation.department_id,
    'No supporting document (PO, invoice, or delivery receipt) attached to this obligation.',
    70, 'Low', 'Pending', v_obligation.record_date)
  returning * into v_new_row;
  return next v_new_row;
end;
$$;
grant execute on function public.detect_missing_attachment(uuid) to authenticated;

-- Rule 4: NOT insert-time — scans every non-draft, not-fully-liquidated obligation older than the
-- 'Delayed Liquidation' threshold (30 days), skipping any obligation already flagged (the `not
-- exists` guard), since this runs repeatedly on a schedule rather than once per obligation.
create function public.detect_delayed_liquidations()
returns setof public.anomaly_alerts
language plpgsql security invoker as $$
declare
  v_threshold_days int;
  v_row record;
  v_days_outstanding int;
  v_confidence smallint;
  v_severity text;
  v_alert_ref text;
  v_new_row public.anomaly_alerts;
begin
  select value::int into v_threshold_days from public.financial_thresholds
    where module = 'liquidations' and threshold_type = 'days' and name = 'Delayed Liquidation' limit 1;
  if v_threshold_days is null then return; end if;

  for v_row in
    select o.id, o.ref, o.department_id, o.amount, o.record_date,
      coalesce((select sum(l.amount) from public.liquidations l
                where l.obligation_id = o.id and l.status <> 'draft'), 0) as liquidated
    from public.obligations o
    where o.status <> 'draft'
      and current_date - o.record_date > v_threshold_days
      and not exists (
        select 1 from public.anomaly_alerts a
        where a.record_ref = o.ref and a.alert_type = 'Delayed Liquidation'
      )
  loop
    continue when v_row.liquidated >= v_row.amount; -- fully liquidated, nothing to flag

    v_days_outstanding := current_date - v_row.record_date;
    v_confidence := least(99, greatest(70, 70 + (v_days_outstanding - v_threshold_days)));
    v_severity := case when v_days_outstanding > v_threshold_days * 1.5 then 'High' else 'Medium' end;

    select 'AID-' || to_char(current_date, 'YYYY') || '-' ||
      lpad((coalesce(max(substring(alert_ref from '\d+$')::int), 0) + 1)::text, 4, '0')
      into v_alert_ref from public.anomaly_alerts
      where alert_ref like 'AID-' || to_char(current_date, 'YYYY') || '-%';

    insert into public.anomaly_alerts
      (alert_ref, alert_type, record_ref, department_id, description, confidence, severity, status, detected_at)
    values (v_alert_ref, 'Delayed Liquidation', v_row.ref, v_row.department_id,
      format('Obligated %s days ago with no liquidation recorded. Threshold is %s days.', v_days_outstanding, v_threshold_days),
      v_confidence, v_severity, 'Pending', current_date)
    returning * into v_new_row;
    return next v_new_row;
  end loop;
  return;
end;
$$;
grant execute on function public.detect_delayed_liquidations() to service_role;

-- service_role bypasses RLS at the policy-check level, but that's separate from ordinary
-- object-level GRANTs — a security invoker function called through service_role's PostgREST
-- session still needs its own SELECT/INSERT privileges, same as any other role.
grant select on public.financial_thresholds, public.obligations, public.liquidations to service_role;
grant select, insert on public.anomaly_alerts to service_role;
