"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type HealthState = {
  ok?: boolean;
  status?: string;
};

const CHECK_INTERVAL_MS = 30_000;

export default function HealthBadge() {
  const [loading, setLoading] = useState(true);
  const [healthy, setHealthy] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string>("");
  const [checkedAtEpoch, setCheckedAtEpoch] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("");
  const [buttonLabel, setButtonLabel] = useState<string>("Refresh");
  const [nowEpoch, setNowEpoch] = useState<number>(() => Date.now());

  const loadHealth = useCallback(async (manual = false) => {
    if (manual) {
      setButtonLabel("Refreshing");
    }
    const now = new Date();

    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const body = (await response.json()) as HealthState;
      const nextHealthy = Boolean(response.ok && body.ok);

      setHealthy(nextHealthy);
      setStatus(response.ok ? (body.status ?? "ok") : "unreachable");
    } catch {
      setHealthy(false);
      setStatus("unreachable");
    } finally {
      const epoch = now.getTime();
      setCheckedAt(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setCheckedAtEpoch(epoch);
      setLoading(false);
      setButtonLabel("Refresh");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await loadHealth();
      if (cancelled) {
        return;
      }
    };

    void run();
    const timer = window.setInterval(run, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [loadHealth]);

  useEffect(() => {
    if (!checkedAtEpoch) {
      return;
    }

    const timer = window.setInterval(() => {
      setNowEpoch(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [checkedAtEpoch]);

  const ageText = useMemo(() => {
    if (!checkedAtEpoch) {
      return "";
    }

    const age = Math.max(0, Math.floor((nowEpoch - checkedAtEpoch) / 1000));
    if (!Number.isFinite(age)) {
      return "";
    }

    return age <= 60 ? `${age}s ago` : `${Math.floor(age / 60)}m ago`;
  }, [checkedAtEpoch, nowEpoch]);

  const text = useMemo(() => {
    if (loading) {
      return "checking health";
    }

    const base = status.length > 0 ? status : "unknown";
    if (!checkedAt.length) {
      return base;
    }

    return `${base} · ${checkedAt} (${ageText || "just now"})`;
  }, [ageText, checkedAt, loading, status]);

  const title = status.length > 0 ? `health status: ${status}` : "health status";
  const classes = loading
    ? "pf-muted"
    : healthy
      ? "text-emerald-300"
      : "text-rose-300";

  return (
    <span
      aria-live="polite"
      aria-label={title}
      title={title}
      role="status"
      className={`ml-1 ${classes}`}
    >
      {text}
      <button
        type="button"
        className="pf-btn pf-btn--primary ml-2"
        onClick={() => {
          if (loading) {
            return;
          }
          void loadHealth(true);
        }}
        disabled={loading}
        aria-label="Refresh health status"
      >
        {buttonLabel}
      </button>
    </span>
  );
}
