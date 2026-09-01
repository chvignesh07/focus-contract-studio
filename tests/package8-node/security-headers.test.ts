import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSecurityHeaders,
  SECURITY_HEADER_NAMES,
} from '../../lib/server/security-headers.ts';

test('security headers use a nonce-only same-origin policy with WebMCP scoped to self', () => {
  const nonce = 'dGVzdC1ub25jZS0xMjM0NTY=';
  const headers = buildSecurityHeaders(nonce);

  assert.deepEqual([...headers.keys()].sort(), [...SECURITY_HEADER_NAMES].sort());
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('referrer-policy'), 'no-referrer');
  assert.equal(headers.get('origin-agent-cluster'), '?1');
  assert.equal(
    headers.get('permissions-policy'),
    'camera=(), geolocation=(), microphone=(), payment=(), tools=(self)',
  );

  const csp = headers.get('content-security-policy') ?? '';
  assert.match(csp, /script-src 'self' 'nonce-dGVzdC1ub25jZS0xMjM0NTY='/u);
  assert.match(csp, /style-src 'self' 'nonce-dGVzdC1ub25jZS0xMjM0NTY='/u);
  assert.match(csp, /frame-ancestors 'none'/u);
  assert.doesNotMatch(csp, /\*|'unsafe-inline'|'unsafe-eval'|https?:/u);
});

test('security headers reject malformed nonce material', () => {
  for (const nonce of ['', 'spaces are invalid', "x'; script-src *", 'x'.repeat(129)]) {
    assert.throws(() => buildSecurityHeaders(nonce), /nonce/u);
  }
});
