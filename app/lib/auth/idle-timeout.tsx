"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000;

export function IdleTimeoutProvider({
  idleMinutes,
  children,
}: {
  idleMinutes: number;
  children: React.ReactNode;
}) {
  const activitySinceHeartbeat = useRef(false);
  const router = useRouter();

  useEffect(() => {
    const idleTimeoutMs = idleMinutes * 60 * 1000;
    let idleTimer: ReturnType<typeof setTimeout>;

    const logoutForIdle = async () => {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      router.push("/login?reason=idle");
    };

    const resetIdleTimer = () => {
      activitySinceHeartbeat.current = true;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(logoutForIdle, idleTimeoutMs);
    };

    resetIdleTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetIdleTimer, { passive: true }));

    const heartbeat = setInterval(() => {
      if (!activitySinceHeartbeat.current) return;
      activitySinceHeartbeat.current = false;
      fetch("/api/auth/refresh", { method: "POST" }).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearTimeout(idleTimer);
      clearInterval(heartbeat);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetIdleTimer));
    };
  }, [idleMinutes, router]);

  return <>{children}</>;
}
