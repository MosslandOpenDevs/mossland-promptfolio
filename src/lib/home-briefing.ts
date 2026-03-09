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
