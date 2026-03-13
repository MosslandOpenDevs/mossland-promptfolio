import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_PINNED_SECTIONS, buildBulkPinnedAnchorIds, buildRouteContextAnchorIds } from './quick-jump.ts';

test('buildBulkPinnedAnchorIds prioritizes the selected filtered item first', () => {
  const result = buildBulkPinnedAnchorIds({
    currentPinnedAnchorIds: ['leaderboard-top', 'desk-watchlist'],
    filteredAnchorIds: ['market-freshness', 'operator-brief', 'desk-watchlist'],
    selectedAnchorId: 'operator-brief',
  });

  assert.deepEqual(result, ['operator-brief', 'market-freshness', 'desk-watchlist', 'leaderboard-top']);
});

test('buildBulkPinnedAnchorIds keeps non-filtered pins after the filtered set up to the cap', () => {
  const result = buildBulkPinnedAnchorIds({
    currentPinnedAnchorIds: ['leaderboard-top', 'pulse-board', 'market-regime'],
    filteredAnchorIds: ['operator-brief', 'operator-priority-queue'],
    selectedAnchorId: null,
  });

  assert.deepEqual(result, ['operator-brief', 'operator-priority-queue', 'leaderboard-top', 'pulse-board']);
});

test('buildBulkPinnedAnchorIds respects the pin cap', () => {
  const result = buildBulkPinnedAnchorIds({
    currentPinnedAnchorIds: ['a', 'b', 'c', 'd'],
    filteredAnchorIds: ['e', 'f', 'g', 'h', 'i'],
    selectedAnchorId: 'i',
  });

  assert.equal(result.length, MAX_PINNED_SECTIONS);
  assert.deepEqual(result, ['i', 'e', 'f', 'g']);
});


test('buildRouteContextAnchorIds returns previous, current, and next anchors around the selection', () => {
  const result = buildRouteContextAnchorIds({
    anchorIds: ['season-status', 'market-freshness', 'operator-brief', 'operator-priority-queue', 'desk-watchlist'],
    selectedAnchorId: 'operator-brief',
  });

  assert.deepEqual(result, ['market-freshness', 'operator-brief', 'operator-priority-queue']);
});

test('buildRouteContextAnchorIds clamps at the beginning and end of the route', () => {
  assert.deepEqual(
    buildRouteContextAnchorIds({
      anchorIds: ['season-status', 'market-freshness', 'operator-brief'],
      selectedAnchorId: 'season-status',
    }),
    ['season-status', 'market-freshness']
  );

  assert.deepEqual(
    buildRouteContextAnchorIds({
      anchorIds: ['season-status', 'market-freshness', 'operator-brief'],
      selectedAnchorId: 'operator-brief',
    }),
    ['market-freshness', 'operator-brief']
  );
});

test('buildRouteContextAnchorIds returns an empty list when the selection is missing', () => {
  assert.deepEqual(
    buildRouteContextAnchorIds({
      anchorIds: ['season-status', 'market-freshness'],
      selectedAnchorId: 'unknown',
    }),
    []
  );
});
