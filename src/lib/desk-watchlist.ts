export type DeskWatchSignal = {
  label: string;
  tone: 'danger' | 'warning' | 'steady';
  note: string;
};

type DeskWatchSignalInput = {
  tradeCount: number;
  hasMemo: boolean;
  latestTickAgeMs: number | null;
  totalDeskCount: number;
};

export function getDeskWatchSignal({ tradeCount, hasMemo, latestTickAgeMs, totalDeskCount }: DeskWatchSignalInput): DeskWatchSignal {
  if (tradeCount === 0) {
    return {
      label: 'WAKE UP',
      tone: 'danger',
      note: 'No trades logged yet. Run a fresh tick before trusting this desk.',
    };
  }

  if (latestTickAgeMs !== null && latestTickAgeMs > 15 * 60 * 1000) {
    return {
      label: 'STALE',
      tone: 'warning',
      note: 'Latest desk signal is older than 15 minutes. Refresh the feed before acting.',
    };
  }

  if (!hasMemo) {
    return {
      label: 'NO MEMO',
      tone: 'warning',
      note: 'Recent activity is missing an operator memo. Audit the replay before reusing the signal.',
    };
  }

  if (totalDeskCount <= 1 || tradeCount >= 3) {
    return {
      label: 'HOT',
      tone: 'steady',
      note: 'This desk has enough recent activity to anchor the next review pass.',
    };
  }

  return {
    label: 'WATCH',
    tone: 'steady',
    note: 'Signal is active but still thin. Pair it with one more desk before rotating exposure.',
  };
}
