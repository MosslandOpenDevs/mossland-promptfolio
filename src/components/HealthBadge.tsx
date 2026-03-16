"use client";

import { useEffect, useMemo, useState } from "react";

type HealthState = {
  ok?: boolean;
  status?: string;
};

const CHECK_INTERVAL_MS = 30_000;

export default function HealthBadge() {
  const [loading, setLoading] = useState(true);
  const [healthy, setHealthy] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const loadHealth = async () => {
      const now = new Date();
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const body = (await response.json()) as HealthState;
        if (cancelled) {
          return;
        }

        const nextHealthy = Boolean(response.ok && body.ok);
        setHealthy(nextHealthy);
        setStatus(response.ok ? (body.status ?? "ok") : "unhealthy");
      } catch {
        if (cancelled) {
          return;
        }

        setHealthy(false);
        setStatus("unreachable");
      } finally {
        if (cancelled) {
          return;
        }

        setCheckedAt(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        setLoading(false);
      }
    };

    void loadHealth();
    const timer = window.setInterval(() => {
      void loadHealth();
    }, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const text = useMemo(() => {
    if (loading) {
      return "checking health";
    }

    if (checkedAt.length > 0) {
      return `${status} · ${checkedAt}`;
    }

    return status;
  }, [loading, checkedAt, status]);

  const title = status.length > 0 ? `health status: ${status}` : "health status";
  const classes = loading
    ? "pf-muted"
    : healthy
      ? "text-emerald-300"
      : "text-rose-300";

  return (
    <span aria-live="polite" aria-label={title} title={title} className={`ml-1 ${classes}`}>
      {text}
    </span>
  );
}
