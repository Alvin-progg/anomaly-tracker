"use client";

import { useState, useTransition } from "react";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { Input } from "@/app/components/ui/input";
import { Select } from "@/app/components/ui/select";
import { Toggle } from "@/app/components/ui/toggle";
import { Btn } from "@/app/components/ui/btn";
import { updatePasswordPolicyAction } from "./actions";
import type { SecuritySettings } from "@/app/lib/config/security";

const minLengthOptions = [
  { value: "8", label: "8 characters" },
  { value: "10", label: "10 characters" },
  { value: "12", label: "12 characters" },
];

type ToggleKey = "passwordRequireUppercase" | "passwordRequireNumbers" | "passwordRequireSpecial" | "passwordPreventReuse";

const TOGGLE_ROWS: { key: ToggleKey; label: string }[] = [
  { key: "passwordRequireUppercase", label: "Require uppercase letters" },
  { key: "passwordRequireNumbers", label: "Require numbers" },
  { key: "passwordRequireSpecial", label: "Require special characters" },
  { key: "passwordPreventReuse", label: "Prevent last 5 password reuse" },
];

export function PasswordPolicyForm({ settings }: { settings: SecuritySettings }) {
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    passwordRequireUppercase: settings.passwordRequireUppercase,
    passwordRequireNumbers: settings.passwordRequireNumbers,
    passwordRequireSpecial: settings.passwordRequireSpecial,
    passwordPreventReuse: settings.passwordPreventReuse,
  });
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const passwordMinLength = Number(formData.get("passwordMinLength"));
    const passwordExpiryDays = Number(formData.get("passwordExpiryDays"));
    startTransition(async () => {
      const result = await updatePasswordPolicyAction({ passwordMinLength, passwordExpiryDays, ...toggles });
      setError(result.error);
    });
  }

  return (
    <SectionCard>
      <SectionTitle>Password Policy</SectionTitle>
      <form action={handleSubmit} className="flex flex-col gap-3.5">
        <Select
          label="Minimum Length"
          name="passwordMinLength"
          defaultValue={String(settings.passwordMinLength)}
          options={minLengthOptions}
          required
        />
        <div className="flex flex-col gap-3">
          {TOGGLE_ROWS.map((row) => (
            <div key={row.key} className="flex items-center justify-between">
              <span className="text-[13px] text-[#1A2033]">{row.label}</span>
              <Toggle
                checked={toggles[row.key]}
                onChange={() => setToggles((prev) => ({ ...prev, [row.key]: !prev[row.key] }))}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <Input
            label="Password Expiry (days)"
            name="passwordExpiryDays"
            type="number"
            defaultValue={String(settings.passwordExpiryDays)}
            required
          />
          <div className="text-[11px] text-[#6B7A99]">
            Once a password is this old, the account must set a new one before it can use the system
            again. Administrator-issued passwords always require a change at first login.
          </div>
        </div>
        {error && (
          <div className="px-3 py-2 bg-red-100 rounded-md text-xs text-red-800 border border-red-200">{error}</div>
        )}
        <div>
          <Btn type="submit" disabled={pending}>
            {pending ? "Saving…" : "Update Password Policy"}
          </Btn>
        </div>
      </form>
    </SectionCard>
  );
}
