-- Seeds the Phase 1 admin test account directly into GoTrue's schema.
--
-- Runs automatically via the Supabase CLI (wired by [db.seed] sql_paths in config.toml):
-- on `supabase start` against a fresh volume, or on `supabase db reset`. No manual step
-- needed — the CLI runs this after its own migrations have created the `auth` schema.
--
-- Personnel accounts are no longer seeded here — create them through the admin's User
-- Account Management screen (/admin/users) instead, which is the real path now that it
-- exists (app/admin/users/).
--
-- Before trusting the column list below against a GoTrue version other than the one
-- pinned by the current CLI release, verify it against the running container:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c '\d auth.users'
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c '\d auth.identities'
--
-- Change SEED_PASSWORD before using this anywhere beyond local development.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  admin_id uuid := gen_random_uuid();
  seed_password text := 'ChangeMe123!';
BEGIN
  -- GoTrue scans confirmation_token, recovery_token, email_change*, phone_change*, and
  -- reauthentication_token as Go strings (not sql.NullString) on every user lookup, including
  -- the password grant. Leaving them NULL (the column default) makes GoTrue fail with
  -- "converting NULL to string is unsupported" on login, so every one must be seeded as ''.
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) VALUES
    (
      '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
      'admin@raao.local', crypt(seed_password, gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb, '{}'::jsonb,
      now(), now(),
      '', '', '', '', '', '', '', ''
    );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, created_at, updated_at
  ) VALUES
    (
      gen_random_uuid(), admin_id, admin_id::text,
      jsonb_build_object('sub', admin_id::text, 'email', 'admin@raao.local'),
      'email', now(), now()
    );
END $$;
