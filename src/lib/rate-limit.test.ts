import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, clientIpFromHeaders, isSameOrigin } from './rate-limit.ts';

test('rate limiter allows up to the limit, then blocks with a retry delay', () => {
  const rl = createRateLimiter();
  const t0 = 1_000_000;
  assert.equal(rl.check('k', 3, 60_000, t0).ok, true);
  assert.equal(rl.check('k', 3, 60_000, t0 + 1).ok, true);
  const third = rl.check('k', 3, 60_000, t0 + 2);
  assert.equal(third.ok, true);
  assert.equal(third.remaining, 0);
  const blocked = rl.check('k', 3, 60_000, t0 + 3);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterMs > 0 && blocked.retryAfterMs <= 60_000);
});

test('rate limiter resets after the window elapses', () => {
  const rl = createRateLimiter();
  const t0 = 0;
  rl.check('k', 1, 1_000, t0);
  assert.equal(rl.check('k', 1, 1_000, t0 + 500).ok, false);
  assert.equal(rl.check('k', 1, 1_000, t0 + 1_000).ok, true);
});

test('rate limiter isolates buckets by key', () => {
  const rl = createRateLimiter();
  const now = 42;
  assert.equal(rl.check('a', 1, 1_000, now).ok, true);
  assert.equal(rl.check('a', 1, 1_000, now).ok, false);
  assert.equal(rl.check('b', 1, 1_000, now).ok, true);
});

test('clientIpFromHeaders prefers first x-forwarded-for hop, then x-real-ip', () => {
  assert.equal(clientIpFromHeaders(new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })), '1.2.3.4');
  assert.equal(clientIpFromHeaders(new Headers({ 'x-real-ip': '9.9.9.9' })), '9.9.9.9');
  assert.equal(clientIpFromHeaders(new Headers({})), 'unknown');
});

test('isSameOrigin blocks a cross-origin Origin but allows same-origin and absent', () => {
  // absent Origin (non-browser client) → allowed
  assert.equal(isSameOrigin(new Headers({ host: 'pf.moss.land' })), true);
  // same-origin → allowed
  assert.equal(isSameOrigin(new Headers({ origin: 'https://pf.moss.land', host: 'pf.moss.land' })), true);
  // cross-origin → blocked
  assert.equal(isSameOrigin(new Headers({ origin: 'https://evil.example', host: 'pf.moss.land' })), false);
  // proxied host is honored via x-forwarded-host
  assert.equal(
    isSameOrigin(new Headers({ origin: 'https://pf.moss.land', host: 'internal:6200', 'x-forwarded-host': 'pf.moss.land' })),
    true
  );
  // malformed Origin → blocked
  assert.equal(isSameOrigin(new Headers({ origin: 'not a url', host: 'pf.moss.land' })), false);
});
