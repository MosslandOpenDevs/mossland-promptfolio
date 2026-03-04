import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNetworkRetryHint, buildTickErrorMessage, buildTickRetryHint, buildTickSuccessMessage, formatRetryDelayLabel, getTickRetryDelayMs, isTickErrorRetryable, parseRetryAfterMs, resolveRetryDelayMs } from './tick-feedback.ts';

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

test('buildTickErrorMessage maps gateway timeout class status', () => {
  const message = buildTickErrorMessage({
    status: 503,
    bodyText: '',
    contentType: 'text/plain',
  });

  assert.equal(message, 'Price service is temporarily unavailable. Please retry shortly.');
});

test('buildTickErrorMessage maps auth failures to refresh hint', () => {
  const message = buildTickErrorMessage({
    status: 403,
    bodyText: '',
    contentType: 'text/plain',
  });

  assert.equal(message, 'Tick execution is currently unauthorized. Please refresh and try again.');
});

test('buildTickErrorMessage extracts JSON error message', () => {
  const message = buildTickErrorMessage({
    status: 500,
    bodyText: JSON.stringify({ error: 'backend unavailable' }),
    contentType: 'application/json; charset=utf-8',
  });

  assert.equal(message, 'backend unavailable');
});

test('buildTickErrorMessage maps database lock to retry hint', () => {
  const message = buildTickErrorMessage({
    status: 500,
    bodyText: JSON.stringify({ error: 'Database is locked' }),
    contentType: 'application/json',
  });

  assert.equal(message, 'Another tick is still being processed. Please retry in a few seconds.');
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

test('isTickErrorRetryable returns true for transient status codes', () => {
  assert.equal(isTickErrorRetryable({ status: 429, bodyText: '', contentType: 'text/plain' }), true);
  assert.equal(isTickErrorRetryable({ status: 503, bodyText: '', contentType: 'text/plain' }), true);
});

test('isTickErrorRetryable returns true for known transient backend payloads', () => {
  assert.equal(
    isTickErrorRetryable({
      status: 500,
      bodyText: JSON.stringify({ error: 'Database is locked' }),
      contentType: 'application/json',
    }),
    true
  );
  assert.equal(
    isTickErrorRetryable({
      status: 500,
      bodyText: 'Price fetch failed: timeout',
      contentType: 'text/plain',
    }),
    true
  );
});

test('isTickErrorRetryable returns false for non-transient auth errors', () => {
  assert.equal(isTickErrorRetryable({ status: 403, bodyText: '', contentType: 'text/plain' }), false);
});

test('buildTickRetryHint returns status-aware delay hints for retryable failures', () => {
  assert.equal(
    buildTickRetryHint({ status: 429, bodyText: '', contentType: 'text/plain' }),
    'Suggested retry delay: 3s'
  );
  assert.equal(
    buildTickRetryHint({ status: 503, bodyText: '', contentType: 'text/plain' }),
    'Suggested retry delay: 5s'
  );
  assert.equal(
    buildTickRetryHint({ status: 500, bodyText: 'Database is locked', contentType: 'text/plain' }),
    'Suggested retry delay: 2s'
  );
});

test('buildTickRetryHint respects Retry-After header when larger than baseline', () => {
  assert.equal(
    buildTickRetryHint({ status: 429, bodyText: '', contentType: 'text/plain' }, '7'),
    'Suggested retry delay: 7s'
  );
});

test('buildTickRetryHint supports strategy overrides', () => {
  assert.equal(
    buildTickRetryHint({ status: 429, bodyText: '', contentType: 'text/plain' }, '1', 'baseline'),
    'Suggested retry delay: 3s'
  );
  assert.equal(
    buildTickRetryHint({ status: 429, bodyText: '', contentType: 'text/plain' }, '1', 'header'),
    'Suggested retry delay: 1s'
  );
});

test('buildTickRetryHint returns null for non-retryable failures', () => {
  assert.equal(
    buildTickRetryHint({ status: 403, bodyText: '', contentType: 'text/plain' }),
    null
  );
});

test('getTickRetryDelayMs returns numeric delay for retryable failures', () => {
  assert.equal(getTickRetryDelayMs({ status: 429, bodyText: '', contentType: 'text/plain' }), 3000);
  assert.equal(getTickRetryDelayMs({ status: 503, bodyText: '', contentType: 'text/plain' }), 5000);
  assert.equal(getTickRetryDelayMs({ status: 500, bodyText: 'Database is locked', contentType: 'text/plain' }), 2000);
});

test('getTickRetryDelayMs returns null for non-retryable failures', () => {
  assert.equal(getTickRetryDelayMs({ status: 401, bodyText: '', contentType: 'text/plain' }), null);
});

test('formatRetryDelayLabel formats milliseconds and seconds', () => {
  assert.equal(formatRetryDelayLabel(250), '250ms');
  assert.equal(formatRetryDelayLabel(3000), '3s');
});

test('buildNetworkRetryHint returns client retry guidance', () => {
  assert.equal(buildNetworkRetryHint(), 'Suggested retry delay: 2s');
});

test('parseRetryAfterMs parses numeric Retry-After seconds', () => {
  assert.equal(parseRetryAfterMs('3'), 3000);
  assert.equal(parseRetryAfterMs(' 1.5 '), 1500);
  assert.equal(parseRetryAfterMs(''), null);
  assert.equal(parseRetryAfterMs('abc'), null);
});

test('parseRetryAfterMs parses HTTP-date Retry-After values', () => {
  const originalNow = Date.now;
  Date.now = () => Date.parse('Wed, 04 Mar 2026 05:00:00 GMT');
  try {
    assert.equal(parseRetryAfterMs('Wed, 04 Mar 2026 05:00:05 GMT'), 5000);
    assert.equal(parseRetryAfterMs('Wed, 04 Mar 2026 04:59:59 GMT'), 0);
  } finally {
    Date.now = originalNow;
  }
});

test('resolveRetryDelayMs applies configured merge strategies', () => {
  assert.equal(resolveRetryDelayMs({ baselineDelayMs: 3000, retryAfterHeader: '1', strategy: 'max' }), 3000);
  assert.equal(resolveRetryDelayMs({ baselineDelayMs: 3000, retryAfterHeader: '1', strategy: 'header' }), 1000);
  assert.equal(resolveRetryDelayMs({ baselineDelayMs: 3000, retryAfterHeader: '9', strategy: 'header' }), 9000);
  assert.equal(resolveRetryDelayMs({ baselineDelayMs: 3000, retryAfterHeader: '9', strategy: 'baseline' }), 3000);
});
