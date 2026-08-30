import assert from 'node:assert/strict';
import test from 'node:test';

import { base64UrlEncode } from '../../lib/server/crypto.ts';
import { parseRuntimeHmacSecrets } from '../../lib/server/security-secrets.ts';

const secret = (fill: number) => base64UrlEncode(new Uint8Array(32).fill(fill));

test('runtime HMAC secrets require three distinct canonical 32-byte base64url values', () => {
  assert.deepEqual(
    parseRuntimeHmacSecrets({
      sessionSecret: secret(1),
      csrfSecret: secret(2),
      rateLimitSecret: secret(3),
    }),
    {
      sessionSecret: secret(1),
      csrfSecret: secret(2),
      rateLimitSecret: secret(3),
    },
  );
});

test('runtime HMAC secrets reject weak, padded, malformed, and reused material', () => {
  for (const values of [
    { sessionSecret: 'short', csrfSecret: secret(2), rateLimitSecret: secret(3) },
    { sessionSecret: `${secret(1)}=`, csrfSecret: secret(2), rateLimitSecret: secret(3) },
    { sessionSecret: '*'.repeat(43), csrfSecret: secret(2), rateLimitSecret: secret(3) },
    { sessionSecret: secret(1), csrfSecret: secret(1), rateLimitSecret: secret(3) },
  ]) {
    assert.throws(() => parseRuntimeHmacSecrets(values));
  }
});
