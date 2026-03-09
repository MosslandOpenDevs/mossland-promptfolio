import test from 'node:test';
import assert from 'node:assert/strict';

import { getHomeAlerts } from './home-alerts.ts';

test('getHomeAlerts prioritizes missing setup and stale data', () => {
  assert.deepEqual(
    getHomeAlerts({
      agentsCount: 0,
      ticksCount: 0,
      tradesCount: 0,
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
