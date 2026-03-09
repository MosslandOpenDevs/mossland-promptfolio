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
