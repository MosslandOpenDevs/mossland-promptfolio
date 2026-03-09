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
}) {
  const priceLabel = params.mocUsd === null ? '—' : `$${params.mocUsd.toFixed(6)}`;

  return [
    `PROMPTFOLIO BRIEF`,
    `Season: ${params.seasonName}`,
    `MOC: ${priceLabel}`,
    `Feed: ${params.feedState} · freshness ${params.freshnessLabel} · cadence ${params.cadenceLabel}`,
    `Regime: ${params.regimeLabel} · ${params.regimeNote}`,
    `Pulse: ${params.pulseLabel}`,
    `Operator brief: ${params.briefHeadline} — ${params.briefDetail}`,
    `Next action: ${params.nextActionTitle} (${params.nextActionCta})`,
  ].join('\n');
}
