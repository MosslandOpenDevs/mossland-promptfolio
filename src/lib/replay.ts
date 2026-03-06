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

export function buildReplayTimeline(
  tradesAsc: ReplayTradeInput[],
  latestPriceUsd?: number | null
): ReplayRow[] {
  let positionUnits = 0;
  let averageCostUsd = 0;
  let realizedPnlUsd = 0;

  return tradesAsc.map((trade) => {
    const action = normalizeAction(trade.side);

    if (action === 'buy') {
      const purchaseUnits = Math.max(0, trade.mocUnits);
      const totalCostBefore = positionUnits * averageCostUsd;
      const totalCostAfter = totalCostBefore + purchaseUnits * trade.priceUsd;
      positionUnits += purchaseUnits;
      averageCostUsd = positionUnits > 0 ? totalCostAfter / positionUnits : 0;
    }

    if (action === 'sell') {
      const sellUnits = Math.max(0, Math.min(trade.mocUnits, positionUnits));
      realizedPnlUsd += (trade.priceUsd - averageCostUsd) * sellUnits;
      positionUnits -= sellUnits;
      if (positionUnits <= 0) {
        positionUnits = 0;
        averageCostUsd = 0;
      }
    }

    const unrealizedPnlUsd =
      latestPriceUsd == null || positionUnits <= 0 ? null : (latestPriceUsd - averageCostUsd) * positionUnits;

    return {
      id: trade.id,
      timestamp: trade.tickTs,
      date: trade.tickTs.slice(0, 10),
      action,
      priceUsd: trade.priceUsd,
      mocUnits: trade.mocUnits,
      reason: trade.reason,
      realizedPnlUsd,
      unrealizedPnlUsd,
      positionUnits,
    };
  });
}
