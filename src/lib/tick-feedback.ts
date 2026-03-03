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

export function buildTickRetryHint(params: {
  status: number;
  bodyText: string;
  contentType?: string | null;
}): string | null {
  const retryDelayMs = getTickRetryDelayMs(params);
  if (retryDelayMs === null) {
    return null;
  }

  return `Suggested retry delay: ${Math.round(retryDelayMs / 1000)}s`;
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
