import { redirect } from "next/navigation";
import { verifySession } from "@/app/lib/auth/dal";
import { getAccessToken } from "@/app/lib/auth/session";
import { Header } from "@/app/components/layout/header";
import { DEFAULT_BACKUP_SETTINGS, getBackupSettings, listBackups } from "@/app/lib/backup/backups";
import { activeCipher } from "@/app/lib/backup/crypto";
import { getSecuritySettings } from "@/app/lib/config/security";
import { formatEncryption } from "./format";
import { BackupStatusCard } from "./backup-status-card";
import { RestorePanel } from "./restore-panel";
import { BackupHistoryTable } from "./backup-history-table";

const HISTORY_LIMIT = 50;

export default async function AdminBackupPage() {
  const session = await verifySession();
  if (session.role !== "admin") {
    redirect("/personnel");
  }

  const accessToken = await getAccessToken();
  const [settings, backups] = accessToken
    ? await Promise.all([getBackupSettings(accessToken), listBackups(accessToken, HISTORY_LIMIT)])
    : [DEFAULT_BACKUP_SETTINGS, []];

  const lastSuccessful = backups.find((b) => b.status === "success") ?? null;

  // "None" here means BACKUP_ENCRYPTION_KEY is unset, whatever the Encryption Standard setting
  // says — /admin/security spells that out.
  const cipher = activeCipher((await getSecuritySettings()).encryptionStandard);
  const encryptionLabel = cipher === "none" ? "None (key not set)" : formatEncryption(cipher);

  return (
    <>
      <Header
        title="Backup & Recovery"
        subtitle="Scheduled backups and data restore operations"
        username={session.email}
      />
      <main className="flex-1 p-7 flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-5">
          <BackupStatusCard
            settings={settings}
            lastSuccessful={lastSuccessful}
            encryptionLabel={encryptionLabel}
          />
          <RestorePanel backups={backups} />
        </div>
        <BackupHistoryTable backups={backups} />
      </main>
    </>
  );
}
