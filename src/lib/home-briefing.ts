export function buildHomeBriefing(params: {
  seasonName: string;
  mocUsd: number | null;
  feedState: 'FRESH' | 'STALE' | 'EMPTY';
  freshnessLabel: string;
  cadenceLabel: string;
  regimeLabel: string;
  regimeNote: string;
  pulseLabel: string;
  briefHeadline: string;
  briefDetail: string;
  nextActionTitle: string;
  nextActionCta: string;
  activeDeskCount?: number;
  tradeMixLabel?: string;
  watchlistNames?: string[];
}) {
  const priceLabel = params.mocUsd === null ? '—' : `$${params.mocUsd.toFixed(6)}`;
  const coverageLabel =
    params.activeDeskCount === undefined
      ? null
      : params.activeDeskCount > 0
        ? `${params.activeDeskCount} active desks`
        : 'No active desks';
  const watchlistLabel =
    params.watchlistNames && params.watchlistNames.length > 0
      ? params.watchlistNames.join(', ')
      : 'No desk watchlist yet';

  return [
    `PROMPTFOLIO BRIEF`,
    `Season: ${params.seasonName}`,
    `MOC: ${priceLabel}`,
    `Feed: ${params.feedState} · freshness ${params.freshnessLabel} · cadence ${params.cadenceLabel}`,
    `Regime: ${params.regimeLabel} · ${params.regimeNote}`,
    `Pulse: ${params.pulseLabel}`,
    coverageLabel ? `Coverage: ${coverageLabel}` : null,
    params.tradeMixLabel ? `Trade mix: ${params.tradeMixLabel}` : null,
    `Watchlist: ${watchlistLabel}`,
    `Operator brief: ${params.briefHeadline} — ${params.briefDetail}`,
    `Next action: ${params.nextActionTitle} (${params.nextActionCta})`,
  ]
    .filter(Boolean)
    .join('\n');
}

export type OperatorChecklistItem = {
  id: string;
  status: 'ready' | 'watch' | 'action';
  label: string;
  detail: string;
  href: string;
  cta: string;
};

export type OperatorPriorityItem = {
  id: string;
  tone: 'urgent' | 'ready' | 'watch';
  label: string;
  detail: string;
  href: string;
  cta: string;
};

export function buildOperatorChecklist(params: {
  agentsCount: number;
  ticksCount: number;
  feedState: 'FRESH' | 'STALE' | 'EMPTY';
  activeDeskCount: number;
}): OperatorChecklistItem[] {
  return [
    params.agentsCount > 0
      ? {
          id: 'agent-coverage',
          status: 'ready',
          label: 'Desk coverage',
          detail: `${params.agentsCount} desks online and ready for the next cycle.`,
          href: '/agents',
          cta: 'Review desks',
        }
      : {
          id: 'agent-coverage',
          status: 'action',
          label: 'Desk coverage',
          detail: 'No desks online yet. Create your first agent before trusting any signal.',
          href: '/agents',
          cta: 'Open Agent Lab',
        },
    params.ticksCount > 0 && params.feedState === 'FRESH'
      ? {
          id: 'feed-readiness',
          status: 'ready',
          label: 'Feed readiness',
          detail: 'Fresh tick data is live, so the dashboard is safe for quick operator checks.',
          href: '/season',
          cta: 'Open Season HQ',
        }
      : params.ticksCount > 0
        ? {
            id: 'feed-readiness',
            status: 'action',
            label: 'Feed readiness',
            detail: 'Tick data exists, but the feed is stale. Refresh it before making decisions.',
            href: '/season',
            cta: 'Refresh feed',
          }
        : {
            id: 'feed-readiness',
            status: 'action',
            label: 'Feed readiness',
            detail: 'No ticks recorded yet. Run EXECUTE TICK to unlock live telemetry.',
            href: '/season',
            cta: 'Run first tick',
          },
    params.activeDeskCount >= 2
      ? {
          id: 'signal-diversity',
          status: 'ready',
          label: 'Signal diversity',
          detail: `${params.activeDeskCount} active desks contributed to the recent tape.`,
          href: '/replay',
          cta: 'Inspect replay',
        }
      : params.activeDeskCount === 1
        ? {
            id: 'signal-diversity',
            status: 'watch',
            label: 'Signal diversity',
            detail: 'Only one desk is driving the recent tape. Watch concentration risk.',
            href: '/agents',
            cta: 'Review desk mix',
          }
        : {
            id: 'signal-diversity',
            status: 'watch',
            label: 'Signal diversity',
            detail: 'No desk has produced a live tape yet. One more cycle should clarify coverage.',
            href: '/replay',
            cta: 'Monitor replay',
          },
  ];
}

export function buildOperatorPriorityQueue(params: {
  agentsCount: number;
  ticksCount: number;
  feedState: 'FRESH' | 'STALE' | 'EMPTY';
  activeDeskCount: number;
  directionStreak: number;
  streakDirection: 'up' | 'down' | null;
  buyCount: number;
  sellCount: number;
}): OperatorPriorityItem[] {
  const items: OperatorPriorityItem[] = [];

  if (params.agentsCount === 0) {
    items.push({
      id: 'bootstrap-desk',
      tone: 'urgent',
      label: 'Spin up the first desk',
      detail: 'No agents are online yet, so every downstream signal is blocked.',
      href: '/agents',
      cta: 'Open Agent Lab',
    });
  }

  if (params.ticksCount === 0) {
    items.push({
      id: 'run-first-tick',
      tone: 'urgent',
      label: 'Generate the first market tick',
      detail: 'Run one tick to unlock replay, leaderboard, and operator telemetry.',
      href: '/season',
      cta: 'Run first tick',
    });
  } else if (params.feedState === 'STALE') {
    items.push({
      id: 'refresh-feed',
      tone: 'urgent',
      label: 'Refresh the feed',
      detail: 'Current tape is stale. Pull a fresh tick before making desk decisions.',
      href: '/season',
      cta: 'Refresh feed',
    });
  }

  if (params.activeDeskCount <= 1 && params.ticksCount > 0) {
    items.push({
      id: 'broaden-coverage',
      tone: params.activeDeskCount === 0 ? 'urgent' : 'watch',
      label: 'Broaden desk coverage',
      detail:
        params.activeDeskCount === 0
          ? 'Ticks are landing without live desk participation. Check prompts before the next cycle.'
          : 'Recent tape is concentrated in one desk. Add coverage before trusting momentum.',
      href: '/agents',
      cta: 'Review desk mix',
    });
  }

  if (params.directionStreak >= 3 && params.streakDirection === 'up') {
    items.push({
      id: 'press-uptrend',
      tone: 'ready',
      label: 'Press the leaders',
      detail: `Momentum is up for ${params.directionStreak} ticks. Review top desks before the next rebalance.`,
      href: '/leaderboard',
      cta: 'Review leaders',
    });
  } else if (params.directionStreak >= 3 && params.streakDirection === 'down') {
    items.push({
      id: 'audit-drawdown',
      tone: 'watch',
      label: 'Audit defensive posture',
      detail: `Momentum is down for ${params.directionStreak} ticks. Inspect replay for risk-off clustering.`,
      href: '/replay',
      cta: 'Inspect replay',
    });
  }

  if (Math.abs(params.buyCount - params.sellCount) >= 3) {
    items.push({
      id: 'check-flow-imbalance',
      tone: 'watch',
      label: 'Check flow imbalance',
      detail:
        params.buyCount > params.sellCount
          ? 'BUY flow is dominating the recent tape. Confirm the move is not just one desk chasing.'
          : 'SELL flow is dominating the recent tape. Make sure the desk is not over-hedging.',
      href: '/replay',
      cta: 'Open replay tape',
    });
  }

  if (items.length === 0) {
    items.push({
      id: 'monitor-quiet-board',
      tone: 'ready',
      label: 'Board is steady',
      detail: 'No urgent operator tasks right now. Monitor replay or leaderboard for the next edge.',
      href: '/replay',
      cta: 'Monitor replay',
    });
  }

  return items.slice(0, 3);
}
