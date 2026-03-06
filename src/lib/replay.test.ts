import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReplayTimeline } from './replay.ts';

test('buildReplayTimeline computes realized and unrealized pnl across buy/sell flow', () => {
  const rows = buildReplayTimeline(
    [
      { id: 't1', tickTs: '2026-03-01T00:00:00.000Z', side: 'BUY', mocUnits: 10, priceUsd: 2, reason: 'entry' },
      { id: 't2', tickTs: '2026-03-02T00:00:00.000Z', side: 'BUY', mocUnits: 10, priceUsd: 4, reason: 'add' },
      { id: 't3', tickTs: '2026-03-03T00:00:00.000Z', side: 'SELL', mocUnits: 5, priceUsd: 5, reason: 'trim' },
    ],
    6
  );

  assert.equal(rows.length, 3);
  assert.equal(rows[0].realizedPnlUsd, 0);
  assert.equal(rows[1].realizedPnlUsd, 0);
  assert.equal(rows[2].realizedPnlUsd, 10);
  assert.equal(rows[2].positionUnits, 15);
  assert.equal(rows[2].unrealizedPnlUsd, 45);
});

test('buildReplayTimeline resets average cost after full close', () => {
  const rows = buildReplayTimeline(
    [
      { id: 't1', tickTs: '2026-03-01T00:00:00.000Z', side: 'BUY', mocUnits: 4, priceUsd: 3, reason: 'entry' },
      { id: 't2', tickTs: '2026-03-02T00:00:00.000Z', side: 'SELL', mocUnits: 4, priceUsd: 5, reason: 'exit' },
      { id: 't3', tickTs: '2026-03-03T00:00:00.000Z', side: 'BUY', mocUnits: 2, priceUsd: 8, reason: 'reentry' },
    ],
    10
  );

  assert.equal(rows[1].realizedPnlUsd, 8);
  assert.equal(rows[2].positionUnits, 2);
  assert.equal(rows[2].unrealizedPnlUsd, 4);
});

test('buildReplayTimeline keeps position unchanged on hold', () => {
  const rows = buildReplayTimeline(
    [
      { id: 't1', tickTs: '2026-03-01T00:00:00.000Z', side: 'BUY', mocUnits: 1, priceUsd: 2, reason: 'entry' },
      { id: 't2', tickTs: '2026-03-02T00:00:00.000Z', side: 'HOLD', mocUnits: 0, priceUsd: 3, reason: 'wait' },
    ],
    null
  );

  assert.equal(rows[1].action, 'hold');
  assert.equal(rows[1].positionUnits, 1);
  assert.equal(rows[1].unrealizedPnlUsd, null);
});

test('buildReplayTimeline normalizes invalid numeric values safely', () => {
  const rows = buildReplayTimeline(
    [
      { id: 't1', tickTs: '2026-03-01T00:00:00.000Z', side: 'BUY', mocUnits: Number.NaN, priceUsd: Number.NaN, reason: 'bad-entry' },
      { id: 't2', tickTs: '2026-03-02T00:00:00.000Z', side: 'SELL', mocUnits: -3, priceUsd: Number.POSITIVE_INFINITY, reason: 'bad-exit' },
    ],
    Number.NaN
  );

  assert.equal(rows[0].mocUnits, 0);
  assert.equal(rows[0].priceUsd, 0);
  assert.equal(rows[1].mocUnits, 0);
  assert.equal(rows[1].priceUsd, 0);
  assert.equal(rows[1].positionUnits, 0);
  assert.equal(rows[1].realizedPnlUsd, 0);
  assert.equal(rows[1].unrealizedPnlUsd, null);
});
