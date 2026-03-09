export type MarketTickLike = {
  ts?: string | null;
  moc_usd?: number | string | null;
};

export function parsePositivePrice(value: number | string | null | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function formatDurationShort(ms: number | null, locale: 'en' | 'ko'): string {
  if (!ms || !Number.isFinite(ms) || ms < 0) {
    return '—';
  }

  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) {
    return locale === 'ko' ? '1분 미만' : '<1 min';
  }

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (days > 0) parts.push(locale === 'ko' ? `${days}일` : `${days}d`);
  if (hours > 0) parts.push(locale === 'ko' ? `${hours}시간` : `${hours}h`);
  if (minutes > 0 && parts.length < 2) parts.push(locale === 'ko' ? `${minutes}분` : `${minutes}m`);

  return parts.join(' ');
}

export function getAverageTickIntervalMs(ticks: MarketTickLike[]): number | null {
  const parsedTickTimes = ticks
    .map((tick) => Date.parse(String(tick.ts ?? '')))
    .filter((value) => Number.isFinite(value));

  if (parsedTickTimes.length < 2) {
    return null;
  }

  return (
    parsedTickTimes
      .slice(0, -1)
      .reduce((sum, value, index) => sum + Math.abs(value - parsedTickTimes[index + 1]!), 0) /
    (parsedTickTimes.length - 1)
  );
}

export function getDirectionStreak(ticks: MarketTickLike[]): { direction: 'up' | 'down' | null; streak: number } {
  if (ticks.length < 2) {
    return { direction: null, streak: 0 };
  }

  let streak = 0;
  let direction: 'up' | 'down' | null = null;

  for (let index = 0; index < ticks.length - 1; index += 1) {
    const current = parsePositivePrice(ticks[index]?.moc_usd) ?? 0;
    const previous = parsePositivePrice(ticks[index + 1]?.moc_usd) ?? 0;
    const delta = current - previous;

    if (delta === 0) break;

    const nextDirection = delta > 0 ? 'up' : 'down';
    if (!direction) {
      direction = nextDirection;
      streak = 1;
      continue;
    }

    if (direction !== nextDirection) break;
    streak += 1;
  }

  return { direction, streak: direction ? streak : 0 };
}

export function getLatestTickAgeMs(ticks: MarketTickLike[]): number | null {
  const latestTs = ticks[0]?.ts ? Date.parse(String(ticks[0].ts)) : NaN;
  if (!Number.isFinite(latestTs)) {
    return null;
  }

  return Date.now() - latestTs;
}

export function getFreshnessBudget(params: {
  latestTickAgeMs: number | null;
  staleAfterMs?: number;
}): {
  remainingMs: number | null;
  isStale: boolean;
  label: string;
  tone: 'fresh' | 'warning' | 'stale' | 'empty';
} {
  const { latestTickAgeMs, staleAfterMs = 15 * 60 * 1000 } = params;

  if (latestTickAgeMs === null || !Number.isFinite(latestTickAgeMs)) {
    return {
      remainingMs: null,
      isStale: false,
      label: 'No tick yet',
      tone: 'empty',
    };
  }

  const remainingMs = staleAfterMs - latestTickAgeMs;
  if (remainingMs <= 0) {
    return {
      remainingMs,
      isStale: true,
      label: 'Overdue',
      tone: 'stale',
    };
  }

  if (remainingMs <= 5 * 60 * 1000) {
    return {
      remainingMs,
      isStale: false,
      label: 'Expiring soon',
      tone: 'warning',
    };
  }

  return {
    remainingMs,
    isStale: false,
    label: 'Fresh window',
    tone: 'fresh',
  };
}

export function getEquityBand(params: {
  equity: number;
  averageEquity: number | null;
  leaderEquity: number | null;
  totalDesks: number;
}): { label: string; tone: 'leader' | 'positive' | 'neutral' | 'warning' } {
  const { equity, averageEquity, leaderEquity, totalDesks } = params;

  if (!Number.isFinite(equity) || totalDesks <= 0) {
    return { label: 'Unranked', tone: 'neutral' };
  }

  if (totalDesks === 1) {
    return { label: 'Solo desk', tone: 'neutral' };
  }

  if (leaderEquity !== null && Math.abs(leaderEquity - equity) < 0.005) {
    return { label: 'Leader', tone: 'leader' };
  }

  if (averageEquity === null) {
    return { label: 'Tracking', tone: 'neutral' };
  }

  const deltaFromAverage = equity - averageEquity;
  const baseline = Math.max(Math.abs(averageEquity), 1);
  const relativeDelta = deltaFromAverage / baseline;

  if (relativeDelta >= 0.05) {
    return { label: 'Above avg', tone: 'positive' };
  }

  if (relativeDelta <= -0.05) {
    return { label: 'Below avg', tone: 'warning' };
  }

  return { label: 'On pace', tone: 'neutral' };
}
