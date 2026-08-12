-- Widens anomaly_alerts.status to a third resolution and opens the UPDATE that
-- 20260812140000_raao_records.sql left read-only: alerts arrived from the seed/detection pass
-- with no way to ever move one out of Pending. This is what /personnel/alerts needs.
--
-- All three non-Pending values render as "resolved" in the review UI — the distinction the
-- front-end cares about is Pending vs. not, not which of the three it resolved to.

alter table public.anomaly_alerts
  drop constraint anomaly_alerts_status_check,
  add constraint anomaly_alerts_status_check
    check (status in ('Pending', 'Valid Anomaly', 'False Positive', 'Needs Further Verification'));

create policy "signed-in staff can update anomaly_alerts" on public.anomaly_alerts
for update using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'personnel')
);

grant update on public.anomaly_alerts to authenticated;
