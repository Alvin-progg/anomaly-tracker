import { redirect } from "next/navigation";
import { verifySession } from "@/app/lib/auth/dal";
import { getAccessToken } from "@/app/lib/auth/session";
import { Header } from "@/app/components/layout/header";
import { DEFAULT_BACKUP_SETTINGS, getBackupSettings, listBackups } from "@/app/lib/backup/backups";
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

  return (
    <>
      <Header
        title="Backup & Recovery"
        subtitle="Scheduled backups and data restore operations"
        username={session.email}
      />
      <main className="flex-1 p-7 flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-5">
          <BackupStatusCard settings={settings} lastSuccessful={lastSuccessful} />
          <RestorePanel backups={backups} />
        </div>
        <BackupHistoryTable backups={backups} />
      </main>
    </>
  );
}
