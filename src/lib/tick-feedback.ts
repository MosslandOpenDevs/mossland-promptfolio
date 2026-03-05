export function buildTickSuccessMessage(mocUsd: number): string {
  if (!Number.isFinite(mocUsd) || mocUsd <= 0) {
    return 'Tick executed successfully.';
  }

  return `Tick executed. MOC: $${mocUsd.toFixed(6)}`;
}

export function isTickErrorRetryable(params: {
  status: number;
  bodyText: string;
  contentType?: string | null;
}): boolean {
  const { status, bodyText, contentType } = params;

  if ([429, 502, 503, 504].includes(status)) {
    return true;
  }

  const raw = bodyText.trim().toLowerCase();
  if (!raw) {
    return false;
  }

  if (raw.includes('price fetch failed') || raw.includes('malformed price response') || raw.includes('database is locked')) {
    return true;
  }

  const looksJson = (contentType ?? '').toLowerCase().includes('application/json');
  if (looksJson) {
    try {
      const parsed = JSON.parse(bodyText.trim()) as { error?: unknown; message?: unknown };
      const text = typeof parsed.error === 'string' ? parsed.error : typeof parsed.message === 'string' ? parsed.message : '';
      const normalized = text.toLowerCase();
      return normalized.includes('price fetch failed') || normalized.includes('malformed price response') || normalized.includes('database is locked');
    } catch {
      return false;
    }
  }

  return false;
}

export function getTickRetryDelayMs(params: {
  status: number;
  bodyText: string;
  contentType?: string | null;
}): number | null {
  if (!isTickErrorRetryable(params)) {
    return null;
  }

  if (params.status === 429) {
    return 3000;
  }

  if ([502, 503, 504].includes(params.status)) {
    return 5000;
  }

  return 2000;
}

export function formatRetryDelayLabel(delayMs: number): string {
  if (delayMs >= 3600000) {
    return `${Math.round(delayMs / 3600000)}h`;
  }

  if (delayMs >= 60000) {
    return `${Math.round(delayMs / 60000)}m`;
  }

  if (delayMs >= 1000) {
    return `${Math.round(delayMs / 1000)}s`;
  }

  return `${delayMs}ms`;
}

export function resolveRetryDelayMs(params: {
  baselineDelayMs: number;
  retryAfterHeader?: string | null;
  strategy?: 'max' | 'header' | 'baseline';
}): number {
  const { baselineDelayMs, retryAfterHeader, strategy = 'max' } = params;
  const retryAfterMs = parseRetryAfterMs(retryAfterHeader);

  if (strategy === 'header') {
    return retryAfterMs ?? baselineDelayMs;
  }

  if (strategy === 'baseline') {
    return baselineDelayMs;
  }

  return retryAfterMs !== null ? Math.max(baselineDelayMs, retryAfterMs) : baselineDelayMs;
}

export function applyRetryJitterMs(params: {
  delayMs: number;
  jitterRatio?: number;
  seed?: number;
}): number {
  const { delayMs, jitterRatio = 0, seed = 0.5 } = params;

  if (!Number.isFinite(delayMs) || delayMs <= 0) {
    return 0;
  }

  const normalizedRatio = Math.min(Math.max(jitterRatio, 0), 0.5);
  if (normalizedRatio === 0) {
    return Math.round(delayMs);
  }

  const normalizedSeed = Number.isFinite(seed) ? Math.min(Math.max(seed, 0), 1) : 0.5;
  const jitterRange = delayMs * normalizedRatio;
  const jitterOffset = (normalizedSeed - 0.5) * 2 * jitterRange;

  return Math.max(0, Math.round(delayMs + jitterOffset));
}

export function buildTickRetryHint(
  params: {
    status: number;
    bodyText: string;
    contentType?: string | null;
  },
  retryAfterHeader?: string | null,
  strategy: 'max' | 'header' | 'baseline' = 'max',
  jitterRatio = 0,
): string | null {
  const retryDelayMs = getTickRetryDelayMs(params);
  if (retryDelayMs === null) {
    return null;
  }

  const effectiveDelayMs = resolveRetryDelayMs({
    baselineDelayMs: retryDelayMs,
    retryAfterHeader,
    strategy,
  });

  const jitteredDelayMs = applyRetryJitterMs({
    delayMs: effectiveDelayMs,
    jitterRatio,
    seed: params.status / 1000,
  });

  return `Suggested retry delay: ${formatRetryDelayLabel(jitteredDelayMs)}`;
}

const MAX_RETRY_AFTER_MS = 10 * 60 * 1000;

export function parseRetryAfterMs(retryAfterHeader: string | null | undefined, maxDelayMs = MAX_RETRY_AFTER_MS): number | null {
  if (!retryAfterHeader) {
    return null;
  }

  const normalized = retryAfterHeader.trim();
  if (!normalized) {
    return null;
  }

  const clampDelay = (value: number): number => {
    const cappedMax = Number.isFinite(maxDelayMs) && maxDelayMs >= 0 ? maxDelayMs : MAX_RETRY_AFTER_MS;
    return Math.min(Math.max(0, value), cappedMax);
  };

  const seconds = Number(normalized);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return clampDelay(Math.round(seconds * 1000));
  }

  const retryAtMs = Date.parse(normalized);
  if (Number.isFinite(retryAtMs)) {
    const delayMs = retryAtMs - Date.now();
    return clampDelay(delayMs > 0 ? delayMs : 0);
  }

  return null;
}

export function buildNetworkRetryHint(): string {
  return `Suggested retry delay: ${formatRetryDelayLabel(2000)}`;
}

export function buildTickErrorCode(params: {
  status: number;
  bodyText: string;
  contentType?: string | null;
}): string {
  const { status, bodyText, contentType } = params;
  const raw = bodyText.trim();

  if (status === 429) return 'rate_limited';
  if (status === 502 || status === 503 || status === 504) return 'service_unavailable';
  if (status === 401 || status === 403) return 'unauthorized';
  if (!raw) return 'http_error';

  const looksJson = (contentType ?? '').toLowerCase().includes('application/json');
  if (looksJson) {
    try {
      const parsed = JSON.parse(raw) as { error?: unknown; message?: unknown };
      const text = typeof parsed.error === 'string' ? parsed.error : typeof parsed.message === 'string' ? parsed.message : '';
      const normalized = text.toLowerCase();
      if (normalized.includes('price fetch failed')) return 'price_fetch_failed';
      if (normalized.includes('malformed price response')) return 'malformed_price_response';
      if (normalized.includes('database is locked')) return 'database_locked';
    } catch {
      return 'http_error';
    }
  }

  const lowered = raw.toLowerCase();
  if (lowered.includes('price fetch failed')) return 'price_fetch_failed';
  if (lowered.includes('malformed price response')) return 'malformed_price_response';
  if (lowered.includes('database is locked')) return 'database_locked';

  return 'http_error';
}

export function buildTickErrorMessage(params: {
  status: number;
  bodyText: string;
  contentType?: string | null;
}): string {
  const { status, bodyText, contentType } = params;

  if (status === 429) {
    return 'Rate limited by price feed. Retry in a few seconds.';
  }

  if (status === 502 || status === 503 || status === 504) {
    return 'Price service is temporarily unavailable. Please retry shortly.';
  }

  if (status === 401 || status === 403) {
    return 'Tick execution is currently unauthorized. Please refresh and try again.';
  }

  const raw = bodyText.trim();
  if (!raw) {
    return `Tick failed (HTTP ${status}).`;
  }

  const looksJson = (contentType ?? '').toLowerCase().includes('application/json');
  if (looksJson) {
    try {
      const parsed = JSON.parse(raw) as { error?: unknown; message?: unknown };
      const text = typeof parsed.error === 'string' ? parsed.error : typeof parsed.message === 'string' ? parsed.message : '';
      if (text.trim()) {
        if (text.includes('Price fetch failed')) {
          return 'Unable to fetch MOC price right now. Please retry.';
        }
        if (text.includes('Malformed price response')) {
          return 'Price feed returned an invalid payload. Please retry.';
        }
        if (text.toLowerCase().includes('database is locked')) {
          return 'Another tick is still being processed. Please retry in a few seconds.';
        }
        return text.trim();
      }
    } catch {
      // Fall through to generic mapping.
    }
  }

  if (raw.includes('Price fetch failed')) {
    return 'Unable to fetch MOC price right now. Please retry.';
  }
  if (raw.includes('Malformed price response')) {
    return 'Price feed returned an invalid payload. Please retry.';
  }
  if (raw.toLowerCase().includes('database is locked')) {
    return 'Another tick is still being processed. Please retry in a few seconds.';
  }

  return `Tick failed (HTTP ${status}).`;
}
