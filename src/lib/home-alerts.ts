export type HomeAlertTone = 'danger' | 'warning' | 'success' | 'neutral';

export type HomeAlert = {
  id: string;
  tone: HomeAlertTone;
  label: string;
  message: string;
  href: string;
  cta: string;
};

export type HomeBrief = {
  headline: string;
  detail: string;
  tone: HomeAlertTone;
  href: string;
  cta: string;
  secondaryCtas: Array<{
    id: string;
    href: string;
    cta: string;
  }>;
};

export function getHomeAlerts(params: {
  agentsCount: number;
  ticksCount: number;
  tradesCount: number;
  activeDeskCount: number;
  latestTickAgeMs: number | null;
  averageTickIntervalMs?: number | null;
  directionStreak: number;
  streakDirection: 'up' | 'down' | null;
  buyCount: number;
  sellCount: number;
}): HomeAlert[] {
  const alerts: HomeAlert[] = [];

  if (params.agentsCount === 0) {
    alerts.push({
      id: 'agents-missing',
      tone: 'danger',
      label: 'setup',
      message: 'No agents online yet. Create at least one desk before the next tick.',
      href: '/agents',
      cta: 'Open Agent Lab',
    });
  }

  if (params.ticksCount === 0) {
    alerts.push({
      id: 'ticks-missing',
      tone: 'warning',
      label: 'data',
      message: 'No market ticks recorded. Run EXECUTE TICK to unlock live telemetry.',
      href: '/season',
      cta: 'Open Season HQ',
    });
  } else if (params.latestTickAgeMs !== null && params.latestTickAgeMs > 15 * 60 * 1000) {
    alerts.push({
      id: 'feed-stale',
      tone: 'warning',
      label: 'stale',
      message: 'Feed is older than 15 minutes. Refresh before trusting the leaderboard.',
      href: '/season',
      cta: 'Refresh feed',
    });
  } else if (params.latestTickAgeMs !== null) {
    alerts.push({
      id: 'feed-fresh',
      tone: 'success',
      label: 'fresh',
      message: 'Feed is fresh enough for quick operator checks.',
      href: '/leaderboard',
      cta: 'Review leaderboard',
    });
  }

  if (params.tradesCount === 0 && params.ticksCount > 0) {
    alerts.push({
      id: 'no-trades',
      tone: 'warning',
      label: 'activity',
      message: 'Ticks exist but no trades landed yet. Inspect prompts or wait for another cycle.',
      href: '/replay',
      cta: 'Inspect replay',
    });
  } else if (params.tradesCount >= 4 && params.activeDeskCount <= 1) {
    alerts.push({
      id: 'desk-concentration',
      tone: 'warning',
      label: 'coverage',
      message: 'Recent tape is coming from a single desk. Broaden agent participation before trusting the signal.',
      href: '/agents',
      cta: 'Review desk mix',
    });
  } else if (
    params.agentsCount >= 3 &&
    params.tradesCount >= 4 &&
    params.activeDeskCount > 1 &&
    params.activeDeskCount / params.agentsCount < 0.5
  ) {
    alerts.push({
      id: 'desk-coverage-thin',
      tone: 'warning',
      label: 'coverage',
      message: 'Less than half of the desk roster is active in the recent tape. Add one more desk before acting on the signal.',
      href: '/agents',
      cta: 'Broaden desk coverage',
    });
  }

  if (
    params.ticksCount >= 3 &&
    params.averageTickIntervalMs !== null &&
    params.averageTickIntervalMs !== undefined &&
    params.averageTickIntervalMs > 10 * 60 * 1000
  ) {
    alerts.push({
      id: 'cadence-slow',
      tone: 'warning',
      label: 'cadence',
      message: 'Average tick cadence has slowed beyond 10 minutes. Check automation before the feed goes stale.',
      href: '/season',
      cta: 'Inspect season cadence',
    });
  }

  if (params.directionStreak >= 3 && params.streakDirection) {
    alerts.push({
      id: 'momentum',
      tone: params.streakDirection === 'up' ? 'success' : 'warning',
      label: params.streakDirection === 'up' ? 'uptrend' : 'drawdown',
      message:
        params.streakDirection === 'up'
          ? `Price momentum is stacking up for ${params.directionStreak} ticks.`
          : `Price momentum is sliding down for ${params.directionStreak} ticks.`,
      href: '/leaderboard',
      cta: 'Review leaders',
    });
  }

  const imbalance = Math.abs(params.buyCount - params.sellCount);
  if (imbalance >= 3) {
    alerts.push({
      id: 'desk-imbalance',
      tone: 'neutral',
      label: 'flow',
      message:
        params.buyCount > params.sellCount
          ? 'Recent desks are leaning BUY-heavy. Double-check concentration risk.'
          : 'Recent desks are leaning SELL-heavy. Watch for over-defensive positioning.',
      href: '/replay',
      cta: 'Open replay tape',
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: 'system-ready',
      tone: 'neutral',
      label: 'steady',
      message: 'No urgent signals right now. Monitor replay or leaderboard for the next edge.',
      href: '/replay',
      cta: 'Monitor replay',
    });
  }

  return alerts.slice(0, 3);
}

export function getHomeBrief(alerts: HomeAlert[]): HomeBrief {
  const primary = alerts[0];
  const secondaryCtas = alerts.slice(1, 3).map((alert) => ({
    id: alert.id,
    href: alert.href,
    cta: alert.cta,
  }));

  if (!primary) {
    return {
      headline: 'Operator board is quiet.',
      detail: 'No active alerts yet. Run another cycle or inspect the replay for fresh signals.',
      tone: 'neutral',
      href: '/replay',
      cta: 'Monitor replay',
      secondaryCtas: [],
    };
  }

  const headlineByTone: Record<HomeAlertTone, string> = {
    danger: `Immediate action: ${primary.label}`,
    warning: `Watch now: ${primary.label}`,
    success: `Opportunity: ${primary.label}`,
    neutral: `Operator brief: ${primary.label}`,
  };

  return {
    headline: headlineByTone[primary.tone],
    detail: primary.message,
    tone: primary.tone,
    href: primary.href,
    cta: primary.cta,
    secondaryCtas,
  };
}
