"use client";

import { useState, useTransition } from "react";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { Input } from "@/app/components/ui/input";
import { Select } from "@/app/components/ui/select";
import { Toggle } from "@/app/components/ui/toggle";
import { Btn } from "@/app/components/ui/btn";
import { updateSessionAuthAction } from "./actions";
import type { SecuritySettings } from "@/app/lib/config/security";

const encryptionOptions = [
  { value: "aes256", label: "AES-256" },
  { value: "aes128", label: "AES-128" },
];

export function SessionAuthForm({
  settings,
  backupEncryptionKeySet,
}: {
  settings: SecuritySettings;
  /** Whether BACKUP_ENCRYPTION_KEY exists on the server — never the key itself. */
  backupEncryptionKeySet: boolean;
}) {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(settings.twoFactorEnabled);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const sessionTimeoutMinutes = Number(formData.get("sessionTimeoutMinutes"));
    const encryptionStandard = String(formData.get("encryptionStandard")) as "aes256" | "aes128";
    const maxFailedLoginAttempts = Number(formData.get("maxFailedLoginAttempts"));
    const lockoutDurationMinutes = Number(formData.get("lockoutDurationMinutes"));
    startTransition(async () => {
      const result = await updateSessionAuthAction({
        sessionTimeoutMinutes,
        encryptionStandard,
        maxFailedLoginAttempts,
        lockoutDurationMinutes,
        twoFactorEnabled,
      });
      setError(result.error);
    });
  }

  return (
    <SectionCard>
      <SectionTitle>Session &amp; Authentication</SectionTitle>
      <form action={handleSubmit} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1">
          <Input
            label="Session Timeout (minutes)"
            name="sessionTimeoutMinutes"
            type="number"
            defaultValue={String(settings.sessionTimeoutMinutes)}
            required
          />
          <div className="text-[11px] text-[#6B7A99]">
            Default: 15 minutes. Inactive sessions are automatically terminated.
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] text-[#1A2033]">Two-Factor Authentication (2FA)</div>
            <div className="text-[11px] text-[#6B7A99]">
              Require a one-time code from an authenticator app on every login. Users without a
              registered device set one up at their next sign-in.
            </div>
          </div>
          <Toggle checked={twoFactorEnabled} onChange={() => setTwoFactorEnabled((prev) => !prev)} />
        </div>

        <div className="flex flex-col gap-1">
          <Select
            label="Encryption Standard"
            name="encryptionStandard"
            defaultValue={settings.encryptionStandard}
            options={encryptionOptions}
            required
          />
          <div className="text-[11px] text-[#6B7A99]">
            Cipher used to encrypt database backup files at rest. Applies to new backups only —
            existing archives keep the standard they were written with.
          </div>
          {!backupEncryptionKeySet && (
            <div className="px-3 py-2 mt-1 bg-amber-50 rounded-md text-[11px] text-amber-800 border border-amber-200">
              Backups are being written unencrypted: BACKUP_ENCRYPTION_KEY is not set on the server.
              Until it is, this setting has no effect.
            </div>
          )}
        </div>

        <Input
          label="Max Failed Login Attempts"
          name="maxFailedLoginAttempts"
          type="number"
          defaultValue={String(settings.maxFailedLoginAttempts)}
          required
        />

        <div className="flex flex-col gap-1">
          <Input
            label="Lockout Duration (minutes)"
            name="lockoutDurationMinutes"
            type="number"
            defaultValue={String(settings.lockoutDurationMinutes)}
            required
          />
          <div className="text-[11px] text-[#6B7A99]">
            How long an account stays locked after exceeding the max failed attempts.
          </div>
        </div>

        {error && (
          <div className="px-3 py-2 bg-red-100 rounded-md text-xs text-red-800 border border-red-200">{error}</div>
        )}
        <div>
          <Btn type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save Security Settings"}
          </Btn>
        </div>
      </form>
    </SectionCard>
  );
}
