-- Records which cipher each dump was written with — the enforcement half of
-- `security_settings.encryption_standard`, which /admin/security stored and nothing read.
-- app/lib/backup/crypto.ts now encrypts the pg_dump artifact at rest with AES-GCM, keyed off the
-- BACKUP_ENCRYPTION_KEY environment variable.
--
-- WHY PER-ROW AND NOT JUST THE SETTING. The setting says what the *next* backup will use. This
-- column says what a *given file* actually is, which is what restore and download have to know:
-- dumps taken before this migration are plaintext ('none'), and flipping the setting from AES-256
-- to AES-128 must not make yesterday's archive unreadable. The file itself carries the same
-- information in its header (magic "RAAOBK1" + algo id), so this column is for the UI and for
-- diagnosis, not for deciding how to decrypt.
--
-- The key is *not* recorded anywhere and there is only ever one: rotating BACKUP_ENCRYPTION_KEY
-- makes every existing encrypted dump permanently unrestorable.

alter table raao_ops.backups
  add column encryption text not null default 'none'
    check (encryption in ('none', 'aes-128-gcm', 'aes-256-gcm'));
