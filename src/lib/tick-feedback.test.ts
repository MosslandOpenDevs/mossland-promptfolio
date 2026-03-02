import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTickErrorMessage, buildTickSuccessMessage } from './tick-feedback.ts';

test('buildTickSuccessMessage formats positive price', () => {
  assert.equal(buildTickSuccessMessage(0.12345678), 'Tick executed. MOC: $0.123457');
});

test('buildTickSuccessMessage falls back for invalid value', () => {
  assert.equal(buildTickSuccessMessage(Number.NaN), 'Tick executed successfully.');
});

test('buildTickErrorMessage maps 429 to rate-limit hint', () => {
  const message = buildTickErrorMessage({
    status: 429,
    bodyText: '',
    contentType: 'application/json',
  });

  assert.equal(message, 'Rate limited by price feed. Retry in a few seconds.');
});

test('buildTickErrorMessage extracts JSON error message', () => {
  const message = buildTickErrorMessage({
    status: 500,
    bodyText: JSON.stringify({ error: 'database is locked' }),
    contentType: 'application/json; charset=utf-8',
  });

  assert.equal(message, 'database is locked');
});

test('buildTickErrorMessage maps known price failure strings', () => {
  const message = buildTickErrorMessage({
    status: 500,
    bodyText: JSON.stringify({ error: 'Price fetch failed: 503' }),
    contentType: 'application/json',
  });

  assert.equal(message, 'Unable to fetch MOC price right now. Please retry.');
});

test('buildTickErrorMessage returns generic fallback for empty response', () => {
  const message = buildTickErrorMessage({
    status: 500,
    bodyText: '   ',
    contentType: 'text/plain',
  });

  assert.equal(message, 'Tick failed (HTTP 500).');
});
