import { NextResponse } from 'next/server';
import {
  createRateLimiter,
  clientIpFromHeaders,
  isSameOrigin,
  DEFAULT_WRITE_LIMIT,
  DEFAULT_WRITE_WINDOW_MS,
} from './rate-limit';

// Single process-wide limiter shared across all write routes.
const limiter = createRateLimiter();

export type WriteGuardOptions = { limit?: number; windowMs?: number };

/**
 * Gate for mutating route handlers. Rejects cross-origin (CSRF) requests and
 * enforces a per-IP, per-route rate limit. Returns a NextResponse to send back
 * when the request is blocked, or `null` when it may proceed.
 */
export function enforceWrite(
  req: Request,
  routeKey: string,
  opts?: WriteGuardOptions
): NextResponse | null {
  if (!isSameOrigin(req.headers)) {
    return NextResponse.json(
      { success: false, error: 'Cross-origin request blocked.' },
      { status: 403 }
    );
  }

  const limit = opts?.limit ?? DEFAULT_WRITE_LIMIT;
  const windowMs = opts?.windowMs ?? DEFAULT_WRITE_WINDOW_MS;
  const key = `${routeKey}:${clientIpFromHeaders(req.headers)}`;
  const result = limiter.check(key, limit, windowMs, Date.now());

  if (!result.ok) {
    const retryAfterSec = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
    return NextResponse.json(
      { success: false, error: 'Rate limited. Slow down and retry shortly.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    );
  }

  return null;
}
