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
      directionStreak: 0,
      streakDirection: null,
      buyCount: 0,
      sellCount: 0,
    }).map((alert) => alert.id),
    ['agents-missing', 'ticks-missing']
  );
});

test('getHomeAlerts includes momentum and flow imbalance after freshness', () => {
  assert.deepEqual(
    getHomeAlerts({
      agentsCount: 4,
      ticksCount: 8,
      tradesCount: 8,
      latestTickAgeMs: 5 * 60 * 1000,
      directionStreak: 4,
      streakDirection: 'up',
      buyCount: 6,
      sellCount: 2,
    }).map((alert) => alert.id),
    ['feed-fresh', 'momentum', 'desk-imbalance']
  );
});

test('getHomeAlerts caps output to top three signals', () => {
  assert.equal(
    getHomeAlerts({
      agentsCount: 1,
      ticksCount: 5,
      tradesCount: 0,
      latestTickAgeMs: 20 * 60 * 1000,
      directionStreak: 3,
      streakDirection: 'down',
      buyCount: 0,
      sellCount: 4,
    }).length,
    3
  );
});
