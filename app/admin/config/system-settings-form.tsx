"use client";

import { useState, useTransition } from "react";
import { SectionCard, SectionTitle } from "@/app/components/ui/section-card";
import { Input } from "@/app/components/ui/input";
import { Select } from "@/app/components/ui/select";
import { Toggle } from "@/app/components/ui/toggle";
import { Btn } from "@/app/components/ui/btn";
import { updateGeneralSettingsAction, updateNotificationSettingAction } from "./actions";
import type { SystemSettings } from "@/app/lib/config/settings";

const dateFormatOptions = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
];

const NOTIFICATION_ROWS: { field: keyof SystemSettings; label: string }[] = [
  { field: "notifyEmailAlerts", label: "Email alerts for anomalies" },
  { field: "notifyInApp", label: "In-app notifications" },
  { field: "notifyDailySummary", label: "Daily budget summary emails" },
  { field: "notifyAiConfidence", label: "AI confidence alerts below 60%" },
];

export function SystemSettingsForm({ settings }: { settings: SystemSettings }) {
  const [saveError, setSaveError] = useState<string | undefined>();
  const [savePending, startSaveTransition] = useTransition();

  const [notifications, setNotifications] = useState(settings);
  const [pendingField, setPendingField] = useState<keyof SystemSettings | null>(null);
  const [notifyError, setNotifyError] = useState<string | undefined>();
  const [, startNotifyTransition] = useTransition();

  function handleSave(formData: FormData) {
    startSaveTransition(async () => {
      const result = await updateGeneralSettingsAction({}, formData);
      setSaveError(result.error);
    });
  }

  function toggleNotification(field: keyof SystemSettings) {
    const next = !notifications[field];
    setPendingField(field);
    setNotifyError(undefined);
    startNotifyTransition(async () => {
      const result = await updateNotificationSettingAction(field, next as boolean);
      if (result.error) {
        setNotifyError(result.error);
      } else {
        setNotifications((prev) => ({ ...prev, [field]: next }));
      }
      setPendingField(null);
    });
  }

  return (
    <div className="grid grid-cols-2 gap-5">
      <SectionCard>
        <SectionTitle>General Settings</SectionTitle>
        <form action={handleSave} className="flex flex-col gap-3.5">
          <Input label="System Name" name="systemName" defaultValue={settings.systemName} required />
          <Input label="Municipal Office" name="municipalOffice" defaultValue={settings.municipalOffice} required />
          <Select label="Date Format" name="dateFormat" defaultValue={settings.dateFormat} options={dateFormatOptions} required />
          {saveError && (
            <div className="px-3 py-2 bg-red-100 rounded-md text-xs text-red-800 border border-red-200">{saveError}</div>
          )}
          <div>
            <Btn type="submit" disabled={savePending}>
              {savePending ? "Saving…" : "Save General Settings"}
            </Btn>
          </div>
        </form>
      </SectionCard>

      <SectionCard>
        <SectionTitle>Notification Settings</SectionTitle>
        {notifyError && (
          <div className="mb-3 px-3 py-2 bg-red-100 rounded-md text-xs text-red-800 border border-red-200">{notifyError}</div>
        )}
        <div className="flex flex-col gap-3">
          {NOTIFICATION_ROWS.map((row) => (
            <div key={row.field} className="flex items-center justify-between">
              <span className="text-[13px] text-[#1A2033]">{row.label}</span>
              <Toggle
                checked={notifications[row.field] as boolean}
                disabled={pendingField === row.field}
                onChange={() => toggleNotification(row.field)}
              />
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
