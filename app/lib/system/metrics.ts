import "server-only";
import * as si from "systeminformation";

export interface SystemMetrics {
  cpuPct: string;
  cpuSub: string;
  memPct: string;
  memSub: string;
  uptimeLabel: string;
  uptimeSub: string;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return `${days}d ${hours}h`;
}

function formatGb(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(1);
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  const [load, mem] = await Promise.all([si.currentLoad(), si.mem()]);
  const time = si.time();

  const cpuPct = Math.round(load.currentLoad);
  const memPct = Math.round((mem.active / mem.total) * 100);
  const avgLoad = Number.isFinite(load.avgLoad) ? load.avgLoad.toFixed(1) : null;

  return {
    cpuPct: `${cpuPct}%`,
    cpuSub: avgLoad ? `${load.cpus.length}-core, avg load ${avgLoad}` : `${load.cpus.length}-core`,
    memPct: `${memPct}%`,
    memSub: `${formatGb(mem.active)} GB / ${formatGb(mem.total)} GB`,
    uptimeLabel: formatUptime(time.uptime),
    uptimeSub: `Last restart: ${new Date(Date.now() - time.uptime * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
  };
}
