import test from 'node:test';
import assert from 'node:assert/strict';

import { getHomeAlerts, getHomeBrief } from './home-alerts.ts';

test('getHomeAlerts prioritizes missing setup and stale data', () => {
  assert.deepEqual(
    getHomeAlerts({
      agentsCount: 0,
      ticksCount: 0,
      tradesCount: 0,
      activeDeskCount: 0,
      latestTickAgeMs: null,
      averageTickIntervalMs: null,
      directionStreak: 0,
      streakDirection: null,
      buyCount: 0,
      sellCount: 0,
    }).map((alert) => alert.id),
    ['agents-missing', 'ticks-missing']
  );
});

test('getHomeAlerts includes momentum and flow imbalance after freshness', () => {
  const alerts = getHomeAlerts({
    agentsCount: 4,
    ticksCount: 8,
    tradesCount: 8,
    activeDeskCount: 4,
    latestTickAgeMs: 5 * 60 * 1000,
    averageTickIntervalMs: 4 * 60 * 1000,
    directionStreak: 4,
    streakDirection: 'up',
    buyCount: 6,
    sellCount: 2,
  });

  assert.deepEqual(
    alerts.map((alert) => alert.id),
    ['feed-fresh', 'momentum', 'desk-imbalance']
  );
  assert.deepEqual(
    alerts.map((alert) => ({ id: alert.id, href: alert.href, cta: alert.cta })),
    [
      { id: 'feed-fresh', href: '/leaderboard', cta: 'Review leaderboard' },
      { id: 'momentum', href: '/leaderboard', cta: 'Review leaders' },
      { id: 'desk-imbalance', href: '/replay', cta: 'Open replay tape' },
    ]
  );
});

test('getHomeAlerts caps output to top three signals', () => {
  assert.equal(
    getHomeAlerts({
      agentsCount: 1,
      ticksCount: 5,
      tradesCount: 0,
      activeDeskCount: 0,
      latestTickAgeMs: 20 * 60 * 1000,
      averageTickIntervalMs: 12 * 60 * 1000,
      directionStreak: 3,
      streakDirection: 'down',
      buyCount: 0,
      sellCount: 4,
    }).length,
    3
  );
});

test('getHomeAlerts returns a steady fallback when no urgent signals exist', () => {
  assert.deepEqual(
    getHomeAlerts({
      agentsCount: 3,
      ticksCount: 6,
      tradesCount: 4,
      activeDeskCount: 3,
      latestTickAgeMs: null,
      averageTickIntervalMs: 5 * 60 * 1000,
      directionStreak: 0,
      streakDirection: null,
      buyCount: 2,
      sellCount: 2,
    }).map((alert) => ({ id: alert.id, cta: alert.cta })),
    [{ id: 'system-ready', cta: 'Monitor replay' }]
  );
});

test('getHomeAlerts surfaces slow cadence before the feed is stale', () => {
  assert.deepEqual(
    getHomeAlerts({
      agentsCount: 3,
      ticksCount: 6,
      tradesCount: 4,
      activeDeskCount: 2,
      latestTickAgeMs: 7 * 60 * 1000,
      averageTickIntervalMs: 12 * 60 * 1000,
      directionStreak: 0,
      streakDirection: null,
      buyCount: 2,
      sellCount: 2,
    }).map((alert) => ({ id: alert.id, cta: alert.cta })),
    [
      { id: 'feed-fresh', cta: 'Review leaderboard' },
      { id: 'cadence-slow', cta: 'Inspect season cadence' },
    ]
  );
});

test('getHomeAlerts flags when a single desk dominates recent tape', () => {
  assert.deepEqual(
    getHomeAlerts({
      agentsCount: 4,
      ticksCount: 7,
      tradesCount: 5,
      activeDeskCount: 1,
      latestTickAgeMs: 4 * 60 * 1000,
      averageTickIntervalMs: 4 * 60 * 1000,
      directionStreak: 0,
      streakDirection: null,
      buyCount: 3,
      sellCount: 2,
    }).map((alert) => ({ id: alert.id, cta: alert.cta })),
    [
      { id: 'feed-fresh', cta: 'Review leaderboard' },
      { id: 'desk-concentration', cta: 'Review desk mix' },
    ]
  );
});

test('getHomeBrief promotes the top alert and keeps follow-up actions', () => {
  const brief = getHomeBrief([
    {
      id: 'feed-stale',
      tone: 'warning',
      label: 'stale',
      message: 'Feed is older than 15 minutes. Refresh before trusting the leaderboard.',
      href: '/season',
      cta: 'Refresh feed',
    },
    {
      id: 'desk-concentration',
      tone: 'warning',
      label: 'coverage',
      message: 'Recent tape is coming from a single desk.',
      href: '/agents',
      cta: 'Review desk mix',
    },
  ]);

  assert.deepEqual(brief, {
    headline: 'Watch now: stale',
    detail: 'Feed is older than 15 minutes. Refresh before trusting the leaderboard.',
    tone: 'warning',
    href: '/season',
    cta: 'Refresh feed',
    secondaryCtas: [{ id: 'desk-concentration', href: '/agents', cta: 'Review desk mix' }],
  });
});

test('getHomeBrief falls back to a quiet board state', () => {
  assert.deepEqual(getHomeBrief([]), {
    headline: 'Operator board is quiet.',
    detail: 'No active alerts yet. Run another cycle or inspect the replay for fresh signals.',
    tone: 'neutral',
    href: '/replay',
    cta: 'Monitor replay',
    secondaryCtas: [],
  });
});
