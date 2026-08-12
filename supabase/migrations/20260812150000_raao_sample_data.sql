-- Worked FY 2024 sample ledger for the Budget Personnel dashboard, matching the figures in
-- front-end-ref (₱22.45M appropriated, ₱18.20M released, ₱14.38M obligated, ₱3.82M remaining).
-- Unlike the mock, these add up: the per-department and per-fund breakdowns both total the
-- headline appropriation, and no department is obligated beyond its release.
--
-- This is DEMO DATA. It sits in its own migration so a real deployment can drop this one file
-- (and truncate the six tables) without touching the schema in 20260812140000_raao_records.sql.
-- Reference data that is not demo — funds, fiscal years — stays in the system_config migration.

insert into public.departments (name, short_code) values
  ('Municipal Engineering Office', 'MEO'),
  ('Municipal Health Office', 'MHO'),
  ('Municipal Agriculture Office', 'MAO'),
  ('Municipal Social Welfare Office', 'MSWO'),
  ('Mayor''s Office', 'OMM'),
  ('Municipal Civil Registry', 'MCR')
on conflict (short_code) do nothing;

-- Appropriations — ₱22,450,000 total. By fund: GF 12.45M, SEF 4.20M, DF 5.80M.
insert into public.appropriations (ref, fiscal_year_id, fund_id, department_id, description, amount, status, record_date)
select v.ref, fy.id, f.id, d.id, v.description, v.amount, v.status::public.record_status, v.record_date::date
from (values
  ('APP-2024-GF-0021', 'GF',  'MEO',  'MOOE – Municipal Engineering Office',       3800000, 'posted',    '2024-01-15'),
  ('APP-2024-DF-0005', 'DF',  'MEO',  'Infrastructure – Road Improvement Program', 3000000, 'posted',    '2024-02-01'),
  ('APP-2024-GF-0022', 'GF',  'MHO',  'MOOE – Municipal Health Office',            3600000, 'posted',    '2024-01-15'),
  ('APP-2024-SEF-0008','SEF', 'MHO',  'Health Education & School Clinics',         1000000, 'posted',    '2024-02-01'),
  ('APP-2024-GF-0023', 'GF',  'MAO',  'MOOE – Municipal Agriculture Office',       1150000, 'posted',    '2024-01-18'),
  ('APP-2024-DF-0006', 'DF',  'MAO',  'Farm-to-Market Road Development',           2000000, 'posted',    '2024-02-05'),
  ('APP-2024-GF-0024', 'GF',  'MSWO', 'MOOE – Social Welfare Programs',            1900000, 'posted',    '2024-01-18'),
  ('APP-2024-SEF-0009','SEF', 'MSWO', 'Day Care & Feeding Program',                1000000, 'posted',    '2024-02-05'),
  ('APP-2024-GF-0025', 'GF',  'OMM',  'PS – Salaries Regular Employees',           1000000, 'posted',    '2024-01-10'),
  ('APP-2024-SEF-0010','SEF', 'OMM',  'Scholarship Grants – Municipal Program',    1200000, 'certified', '2024-02-10'),
  ('APP-2024-DF-0007', 'DF',  'OMM',  'Local Development Projects – Barangay',      800000, 'posted',    '2024-02-10'),
  ('APP-2024-GF-0026', 'GF',  'MCR',  'MOOE – Civil Registry Operations',          1000000, 'posted',    '2024-01-20'),
  ('APP-2024-SEF-0011','SEF', 'MCR',  'School Records Digitisation',               1000000, 'pending',   '2024-03-01')
) as v(ref, fund, dept, description, amount, status, record_date)
join public.fund_classifications f on f.short_code = v.fund
join public.departments d on d.short_code = v.dept
cross join (select id from public.fiscal_years where status = 'active') fy;

-- Allotments released — ₱18,200,000 (81.1% of appropriations).
insert into public.allotments (ref, fiscal_year_id, fund_id, department_id, description, amount, status, record_date)
select v.ref, fy.id, f.id, d.id, v.description, v.amount, v.status::public.record_status, v.record_date::date
from (values
  ('ALT-2024-0441', 'GF',  'MEO',  'Q1–Q3 Release – Municipal Engineering',   3100000, 'posted',    '2024-07-01'),
  ('ALT-2024-0444', 'DF',  'MEO',  'Q1–Q3 Release – Road Improvement',        2500000, 'certified', '2024-07-05'),
  ('ALT-2024-0442', 'GF',  'MHO',  'Q1–Q3 Release – Municipal Health',        2900000, 'posted',    '2024-07-01'),
  ('ALT-2024-0443', 'SEF', 'MHO',  'Q1–Q3 Release – School Clinics',           800000, 'posted',    '2024-07-01'),
  ('ALT-2024-0446', 'GF',  'MAO',  'Q1–Q3 Release – Municipal Agriculture',    900000, 'posted',    '2024-07-02'),
  ('ALT-2024-0447', 'DF',  'MAO',  'Q1–Q3 Release – Farm-to-Market Roads',    1500000, 'posted',    '2024-07-02'),
  ('ALT-2024-0448', 'GF',  'MSWO', 'Q1–Q3 Release – Social Welfare',          1600000, 'posted',    '2024-07-03'),
  ('ALT-2024-0449', 'SEF', 'MSWO', 'Q1–Q3 Release – Day Care & Feeding',       800000, 'posted',    '2024-07-03'),
  ('ALT-2024-0450', 'GF',  'OMM',  'Q1–Q3 Release – Mayor''s Office',          850000, 'posted',    '2024-07-04'),
  ('ALT-2024-0451', 'SEF', 'OMM',  'Q1–Q3 Release – Scholarship Grants',      1000000, 'posted',    '2024-07-04'),
  ('ALT-2024-0452', 'DF',  'OMM',  'Q1–Q3 Release – Barangay Projects',        650000, 'posted',    '2024-07-04'),
  ('ALT-2024-0453', 'GF',  'MCR',  'Q1–Q3 Release – Civil Registry',           800000, 'posted',    '2024-07-05'),
  ('ALT-2024-0454', 'SEF', 'MCR',  'Q1–Q3 Release – Records Digitisation',     800000, 'pending',   '2024-07-29')
) as v(ref, fund, dept, description, amount, status, record_date)
join public.fund_classifications f on f.short_code = v.fund
join public.departments d on d.short_code = v.dept
cross join (select id from public.fiscal_years where status = 'active') fy;

-- Obligations — ₱14,380,000 (79.0% of allotments); ₱3,820,000 remains unobligated.
insert into public.obligations (ref, fiscal_year_id, fund_id, department_id, description, amount, status, record_date)
select v.ref, fy.id, f.id, d.id, v.description, v.amount, v.status::public.record_status, v.record_date::date
from (values
  ('ORS-2024-0890', 'GF',  'MEO',  'Road Materials & Aggregates – MEO',          2660000, 'certified', '2024-07-29'),
  ('ORS-2024-0879', 'DF',  'MEO',  'Labor Cost – Barangay Access Road',          2100000, 'pending',   '2024-07-28'),
  ('ORS-2024-0891', 'GF',  'MHO',  'Medicines & Medical Supplies – MHO',         2520000, 'pending',   '2024-07-30'),
  ('ORS-2024-0865', 'SEF', 'MHO',  'School Clinic Supplies',                      700000, 'posted',    '2024-06-18'),
  ('ORS-2024-0855', 'GF',  'MAO',  'Seedlings & Fertiliser Distribution',         690000, 'posted',    '2024-06-10'),
  ('ORS-2024-0856', 'DF',  'MAO',  'Farm-to-Market Road – Phase 1',              1200000, 'posted',    '2024-06-12'),
  ('ORS-2024-0870', 'GF',  'MSWO', 'Relief Goods & Emergency Assistance',        1330000, 'posted',    '2024-07-08'),
  ('ORS-2024-0871', 'SEF', 'MSWO', 'Day Care Feeding Program – Q2',               700000, 'posted',    '2024-07-08'),
  ('ORS-2024-0845', 'GF',  'OMM',  'Office Supplies & Utilities – Mayor''s Office', 700000, 'posted',  '2024-07-15'),
  ('ORS-2024-0846', 'SEF', 'OMM',  'Scholarship Disbursement – 1st Semester',     550000, 'posted',    '2024-07-16'),
  ('ORS-2024-0847', 'DF',  'OMM',  'Barangay Multi-Purpose Hall – Materials',     400000, 'posted',    '2024-07-16'),
  ('ORS-2024-0860', 'GF',  'MCR',  'Civil Registry Forms & Printing',             430000, 'posted',    '2024-07-20'),
  ('ORS-2024-0861', 'SEF', 'MCR',  'Computer Equipment – Records Digitisation',   400000, 'posted',    '2024-07-20')
) as v(ref, fund, dept, description, amount, status, record_date)
join public.fund_classifications f on f.short_code = v.fund
join public.departments d on d.short_code = v.dept
cross join (select id from public.fiscal_years where status = 'active') fy;

insert into public.liquidations (ref, obligation_id, description, amount, status, record_date)
select v.ref, o.id, v.description, v.amount, v.status::public.record_status, v.record_date::date
from (values
  ('LIQ-2024-0321', 'ORS-2024-0890', 'Liquidation of road materials delivery – MEO',  420000, 'posted',    '2024-07-29'),
  ('LIQ-2024-0318', 'ORS-2024-0865', 'Liquidation of school clinic supplies',         285000, 'posted',    '2024-07-25'),
  ('LIQ-2024-0305', 'ORS-2024-0856', 'Partial liquidation – Road Project Phase 1',   1800000, 'certified', '2024-07-18'),
  ('LIQ-2024-0290', 'ORS-2024-0861', 'Liquidation – computer equipment delivery',     128000, 'posted',    '2024-07-10')
) as v(ref, obligation_ref, description, amount, status, record_date)
join public.obligations o on o.ref = v.obligation_ref;

insert into public.anomaly_alerts (alert_ref, alert_type, record_ref, department_id, description, confidence, severity, status, detected_at)
select v.alert_ref, v.alert_type, v.record_ref, d.id, v.description, v.confidence, v.severity, v.status, v.detected_at::date
from (values
  ('AID-2024-0041', 'Expenditure Spike', 'ORS-2024-0891', 'MHO',
   'Obligation amount ₱2,520,000 is 162% above the 30-day average for this department.', 87, 'High', 'Pending', '2024-07-30'),
  ('AID-2024-0040', 'Duplicate Entry Detected', 'ORS-2024-0890', 'MEO',
   'Possible duplicate of ORS-2024-0882. Same payee, amount and description within 7 days.', 92, 'High', 'Pending', '2024-07-29'),
  ('AID-2024-0039', 'Obligation Exceeds Allotment', 'ORS-2024-0879', 'MEO',
   'Obligation would bring total obligations to 98.4% of the released allotment.', 99, 'High', 'Pending', '2024-07-28'),
  ('AID-2024-0038', 'Delayed Liquidation', 'ORS-2024-0845', 'OMM',
   'Obligated 35 days ago with no liquidation recorded. Threshold is 30 days.', 95, 'Medium', 'Pending', '2024-07-27'),
  ('AID-2024-0037', 'Expenditure Spike', 'ORS-2024-0860', 'MCR',
   'Sudden 140% increase in office supplies obligations vs. the previous quarter.', 74, 'Medium', 'Valid Anomaly', '2024-07-25')
) as v(alert_ref, alert_type, record_ref, dept, description, confidence, severity, status, detected_at)
join public.departments d on d.short_code = v.dept;
