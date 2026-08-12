-- The "RAAO Records module" that 20260812140000_raao_records.sql's header comment predicted: the
-- create/certify/post flows, so a missing INSERT policy is no longer the honest state.
--
-- INSERT/UPDATE, same shape as that migration's existing SELECT loop (admin+personnel via the
-- app_metadata.role JWT claim). No DELETE — the module only ever offers view/edit.
do $$
declare
  target text;
begin
  foreach target in array array['appropriations', 'allotments', 'obligations', 'liquidations'] loop
    execute format(
      'create policy "signed-in staff can insert %1$s" on public.%1$I for insert with check ('
      || '(auth.jwt() -> ''app_metadata'' ->> ''role'') in (''admin'', ''personnel''))',
      target
    );
    execute format(
      'create policy "signed-in staff can update %1$s" on public.%1$I for update using ('
      || '(auth.jwt() -> ''app_metadata'' ->> ''role'') in (''admin'', ''personnel''))',
      target
    );
    execute format('grant insert, update on public.%I to authenticated', target);
  end loop;
end $$;

-- Obligations-only fields: the ORS tab captures who is being paid and lets a supporting document
-- ride along. `attachment_path` is a Storage object path (bucket below), never a bare filename —
-- resolved back to a signed download through the app server, never trusted from the client.
alter table public.obligations
  add column payee text,
  add column attachment_path text;

-- Private bucket for ORS supporting documents. Created here via SQL, not supabase/config.toml's
-- declarative bucket block, so it is versioned the same way every other piece of schema in this
-- repo is — one CLI-managed source of truth (`supabase db reset` / `migration up`) rather than two.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('raao-attachments', 'raao-attachments', false, 10485760,
        array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "raao staff can upload attachments" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'raao-attachments'
  and (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'personnel')
);

create policy "raao staff can read attachments" on storage.objects
for select to authenticated
using (
  bucket_id = 'raao-attachments'
  and (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'personnel')
);
