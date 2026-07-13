// Framework-free primitives for protecting write endpoints. Kept free of any
// `next/*` import so they can be unit-tested with the Node test runner.

function envPositiveInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

// Per-IP, per-route write budget (fixed window). Override via env for ops.
export const DEFAULT_WRITE_LIMIT = envPositiveInt('WRITE_RATE_LIMIT', 30);
export const DEFAULT_WRITE_WINDOW_MS = envPositiveInt('WRITE_RATE_WINDOW_MS', 60_000);

export type RateLimitResult = { ok: boolean; retryAfterMs: number; remaining: number };

type Bucket = { count: number; resetAt: number };

// Fixed-window counter with an injectable clock so window math is testable.
// In-memory and per-process: sufficient for a single-instance deployment;
// a shared store would be needed to rate-limit across multiple instances.
export function createRateLimiter() {
  const store = new Map<string, Bucket>();

  return {
    check(key: string, limit: number, windowMs: number, now: number): RateLimitResult {
      const bucket = store.get(key);
      if (!bucket || now >= bucket.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return { ok: true, retryAfterMs: 0, remaining: Math.max(0, limit - 1) };
      }
      if (bucket.count >= limit) {
        return { ok: false, retryAfterMs: Math.max(0, bucket.resetAt - now), remaining: 0 };
      }
      bucket.count += 1;
      return { ok: true, retryAfterMs: 0, remaining: Math.max(0, limit - bucket.count) };
    },
    reset(): void {
      store.clear();
    },
  };
}

// Best-effort client IP from common proxy headers; falls back to a shared
// bucket when none are present (e.g. direct, non-proxied requests).
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || 'unknown';
}

// CSRF guard for state-changing requests. Browsers always send `Origin` on
// cross-origin POSTs, so a mismatched Origin is rejected. An absent Origin
// (non-browser clients: monitors, curl) is allowed — it is not a CSRF vector.
export function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get('origin');
  if (!origin) return true;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }

  const expected = headers.get('x-forwarded-host') || headers.get('host');
  return !!expected && originHost === expected;
}
