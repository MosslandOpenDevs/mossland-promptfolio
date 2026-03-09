import test from 'node:test';
import assert from 'node:assert/strict';

import { formatDurationShort, getAverageTickIntervalMs, getDirectionStreak, getEquityBand, getFreshnessBudget, parsePositivePrice } from './market-metrics.ts';

test('parsePositivePrice returns null for zero, negatives, and invalid input', () => {
  assert.equal(parsePositivePrice(0), null);
  assert.equal(parsePositivePrice(-1), null);
  assert.equal(parsePositivePrice('abc'), null);
});

test('parsePositivePrice accepts positive numeric strings', () => {
  assert.equal(parsePositivePrice('1.25'), 1.25);
});

test('formatDurationShort returns localized short labels', () => {
  assert.equal(formatDurationShort(30_000, 'en'), '<1 min');
  assert.equal(formatDurationShort(90 * 60 * 1000, 'en'), '1h 30m');
  assert.equal(formatDurationShort(26 * 60 * 60 * 1000, 'ko'), '1일 2시간');
});

test('getAverageTickIntervalMs returns average absolute tick gap', () => {
  const ticks = [
    { ts: '2026-03-08T23:10:00.000Z', moc_usd: 1 },
    { ts: '2026-03-08T23:05:00.000Z', moc_usd: 0.9 },
    { ts: '2026-03-08T23:01:00.000Z', moc_usd: 1.1 },
  ];

  assert.equal(getAverageTickIntervalMs(ticks), 270_000);
});

test('getDirectionStreak detects upward and downward streaks', () => {
  assert.deepEqual(
    getDirectionStreak([
      { moc_usd: 1.3 },
      { moc_usd: 1.2 },
      { moc_usd: 1.1 },
      { moc_usd: 1.0 },
    ]),
    { direction: 'up', streak: 3 }
  );

  assert.deepEqual(
    getDirectionStreak([
      { moc_usd: 0.9 },
      { moc_usd: 1.0 },
      { moc_usd: 1.1 },
      { moc_usd: 1.05 },
    ]),
    { direction: 'down', streak: 2 }
  );
});

test('getFreshnessBudget classifies fresh, warning, stale, and empty states', () => {
  assert.deepEqual(getFreshnessBudget({ latestTickAgeMs: null }), {
    remainingMs: null,
    isStale: false,
    label: 'No tick yet',
    tone: 'empty',
  });

  assert.deepEqual(getFreshnessBudget({ latestTickAgeMs: 5 * 60 * 1000 }), {
    remainingMs: 10 * 60 * 1000,
    isStale: false,
    label: 'Fresh window',
    tone: 'fresh',
  });

  assert.deepEqual(getFreshnessBudget({ latestTickAgeMs: 11 * 60 * 1000 }), {
    remainingMs: 4 * 60 * 1000,
    isStale: false,
    label: 'Expiring soon',
    tone: 'warning',
  });

  assert.deepEqual(getFreshnessBudget({ latestTickAgeMs: 16 * 60 * 1000 }), {
    remainingMs: -1 * 60 * 1000,
    isStale: true,
    label: 'Overdue',
    tone: 'stale',
  });
});

test('getEquityBand labels leader, outperformers, and laggards', () => {
  assert.deepEqual(
    getEquityBand({ equity: 140, averageEquity: 110, leaderEquity: 140, totalDesks: 4 }),
    { label: 'Leader', tone: 'leader' }
  );

  assert.deepEqual(
    getEquityBand({ equity: 118, averageEquity: 100, leaderEquity: 130, totalDesks: 4 }),
    { label: 'Above avg', tone: 'positive' }
  );

  assert.deepEqual(
    getEquityBand({ equity: 94, averageEquity: 100, leaderEquity: 130, totalDesks: 4 }),
    { label: 'Below avg', tone: 'warning' }
  );

  assert.deepEqual(
    getEquityBand({ equity: 102, averageEquity: 100, leaderEquity: 130, totalDesks: 4 }),
    { label: 'On pace', tone: 'neutral' }
  );
});

test('getEquityBand handles solo desk and missing rank state', () => {
  assert.deepEqual(
    getEquityBand({ equity: 120, averageEquity: 120, leaderEquity: 120, totalDesks: 1 }),
    { label: 'Solo desk', tone: 'neutral' }
  );

  assert.deepEqual(
    getEquityBand({ equity: Number.NaN, averageEquity: 120, leaderEquity: 120, totalDesks: 4 }),
    { label: 'Unranked', tone: 'neutral' }
  );
});
