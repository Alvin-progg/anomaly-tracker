import type { BackupCipher } from "@/app/lib/backup/crypto";

/**
 * Display helpers shared by the three Backup & Recovery components. Kept local to the route the
 * same way app/admin/audit/audit-log-table.tsx keeps its own formatTimestamp.
 */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 2)} ${units[unit]}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatTimestamp(iso: string): string {
  return `${formatDate(iso)} ${formatTime(iso)}`;
}

export function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** How a stored dump's cipher reads in the UI — matches the labels on the Security Policies page. */
export function formatEncryption(cipher: BackupCipher): string {
  if (cipher === "aes-256-gcm") return "AES-256";
  if (cipher === "aes-128-gcm") return "AES-128";
  return "None";
}
