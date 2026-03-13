import test from 'node:test';
import assert from 'node:assert/strict';

import { getDeskWatchSignal } from './desk-watchlist.ts';

test('getDeskWatchSignal marks inactive desks as wake-up risk', () => {
  assert.deepEqual(
    getDeskWatchSignal({ tradeCount: 0, hasMemo: false, latestTickAgeMs: null, totalDeskCount: 4 }),
    {
      label: 'WAKE UP',
      tone: 'danger',
      note: 'No trades logged yet. Run a fresh tick before trusting this desk.',
    }
  );
});

test('getDeskWatchSignal flags stale desks before memo quality', () => {
  assert.deepEqual(
    getDeskWatchSignal({ tradeCount: 2, hasMemo: false, latestTickAgeMs: 16 * 60 * 1000, totalDeskCount: 4 }),
    {
      label: 'STALE',
      tone: 'warning',
      note: 'Latest desk signal is older than 15 minutes. Refresh the feed before acting.',
    }
  );
});

test('getDeskWatchSignal warns when memo is missing on an active desk', () => {
  assert.deepEqual(
    getDeskWatchSignal({ tradeCount: 2, hasMemo: false, latestTickAgeMs: 4 * 60 * 1000, totalDeskCount: 4 }),
    {
      label: 'NO MEMO',
      tone: 'warning',
      note: 'Recent activity is missing an operator memo. Audit the replay before reusing the signal.',
    }
  );
});

test('getDeskWatchSignal marks frequently trading desks as hot', () => {
  assert.deepEqual(
    getDeskWatchSignal({ tradeCount: 3, hasMemo: true, latestTickAgeMs: 4 * 60 * 1000, totalDeskCount: 4 }),
    {
      label: 'HOT',
      tone: 'steady',
      note: 'This desk has enough recent activity to anchor the next review pass.',
    }
  );
});

test('getDeskWatchSignal keeps low-volume active desks on watch', () => {
  assert.deepEqual(
    getDeskWatchSignal({ tradeCount: 1, hasMemo: true, latestTickAgeMs: 4 * 60 * 1000, totalDeskCount: 4 }),
    {
      label: 'WATCH',
      tone: 'steady',
      note: 'Signal is active but still thin. Pair it with one more desk before rotating exposure.',
    }
  );
});
