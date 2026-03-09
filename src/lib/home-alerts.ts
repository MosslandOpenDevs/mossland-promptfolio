export type HomeAlertTone = 'danger' | 'warning' | 'success' | 'neutral';

export type HomeAlert = {
  id: string;
  tone: HomeAlertTone;
  label: string;
  message: string;
};

export function getHomeAlerts(params: {
  agentsCount: number;
  ticksCount: number;
  tradesCount: number;
  latestTickAgeMs: number | null;
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
    });
  }

  if (params.ticksCount === 0) {
    alerts.push({
      id: 'ticks-missing',
      tone: 'warning',
      label: 'data',
      message: 'No market ticks recorded. Run EXECUTE TICK to unlock live telemetry.',
    });
  } else if (params.latestTickAgeMs !== null && params.latestTickAgeMs > 15 * 60 * 1000) {
    alerts.push({
      id: 'feed-stale',
      tone: 'warning',
      label: 'stale',
      message: 'Feed is older than 15 minutes. Refresh before trusting the leaderboard.',
    });
  } else if (params.latestTickAgeMs !== null) {
    alerts.push({
      id: 'feed-fresh',
      tone: 'success',
      label: 'fresh',
      message: 'Feed is fresh enough for quick operator checks.',
    });
  }

  if (params.tradesCount === 0 && params.ticksCount > 0) {
    alerts.push({
      id: 'no-trades',
      tone: 'warning',
      label: 'activity',
      message: 'Ticks exist but no trades landed yet. Inspect prompts or wait for another cycle.',
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
    });
  }

  return alerts.slice(0, 3);
}
