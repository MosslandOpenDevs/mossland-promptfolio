export type ReplayAction = 'buy' | 'sell' | 'hold';

export type ReplayTradeInput = {
  id: string;
  tickTs: string;
  side: string;
  mocUnits: number;
  priceUsd: number;
  reason: string;
};

export type ReplayRow = {
  id: string;
  timestamp: string;
  date: string;
  action: ReplayAction;
  priceUsd: number;
  mocUnits: number;
  reason: string;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number | null;
  positionUnits: number;
};

function normalizeAction(side: string): ReplayAction {
  const normalized = side.toLowerCase();
  if (normalized === 'buy') return 'buy';
  if (normalized === 'sell') return 'sell';
  return 'hold';
}

function normalizeNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeNonNegative(value: number): number {
  return Math.max(0, normalizeNumber(value));
}

function normalizeOptionalNumber(value: number | null | undefined): number | null {
  if (value == null) return null;
  return Number.isFinite(value) ? value : null;
}

export function buildReplayTimeline(
  tradesAsc: ReplayTradeInput[],
  latestPriceUsd?: number | null
): ReplayRow[] {
  let positionUnits = 0;
  let averageCostUsd = 0;
  let realizedPnlUsd = 0;

  return tradesAsc.map((trade) => {
    const action = normalizeAction(trade.side);
    const priceUsd = normalizeNumber(trade.priceUsd);
    const mocUnits = normalizeNonNegative(trade.mocUnits);

    if (action === 'buy') {
      const totalCostBefore = positionUnits * averageCostUsd;
      const totalCostAfter = totalCostBefore + mocUnits * priceUsd;
      positionUnits += mocUnits;
      averageCostUsd = positionUnits > 0 ? totalCostAfter / positionUnits : 0;
    }

    if (action === 'sell') {
      const sellUnits = Math.min(mocUnits, positionUnits);
      realizedPnlUsd += (priceUsd - averageCostUsd) * sellUnits;
      positionUnits -= sellUnits;
      if (positionUnits <= 0) {
        positionUnits = 0;
        averageCostUsd = 0;
      }
    }

    const normalizedLatestPriceUsd = normalizeOptionalNumber(latestPriceUsd);
    const unrealizedPnlUsd =
      normalizedLatestPriceUsd == null || positionUnits <= 0
        ? null
        : (normalizedLatestPriceUsd - averageCostUsd) * positionUnits;

    return {
      id: trade.id,
      timestamp: trade.tickTs,
      date: trade.tickTs.slice(0, 10),
      action,
      priceUsd,
      mocUnits,
      reason: trade.reason,
      realizedPnlUsd,
      unrealizedPnlUsd,
      positionUnits,
    };
  });
}
