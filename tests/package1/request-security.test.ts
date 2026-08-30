import { expect, test } from 'vitest';

import { sha256Hex } from '../../lib/server/crypto';
import { readStrictJsonMutation } from '../../lib/server/request-security';

const origin = 'https://focus-contract-studio.example';
const csrfToken = 'csrf-test-token-with-enough-entropy';

function request(overrides: {
  method?: string;
  origin?: string | null;
  contentType?: string | null;
  csrf?: string | null;
  body?: string;
} = {}) {
  const headers = new Headers();
  const requestOrigin = overrides.origin === undefined ? origin : overrides.origin;
  const contentType =
    overrides.contentType === undefined ? 'application/json' : overrides.contentType;
  const csrf = overrides.csrf === undefined ? csrfToken : overrides.csrf;
  if (requestOrigin !== null) headers.set('origin', requestOrigin);
  if (contentType !== null) headers.set('content-type', contentType);
  if (csrf !== null) headers.set('x-fcs-csrf', csrf);
  return new Request(`${origin}/api/session/reset`, {
    method: overrides.method ?? 'POST',
    headers,
    body:
      (overrides.method ?? 'POST') === 'GET'
        ? undefined
        : (overrides.body ?? '{"idempotencyKey":"key"}'),
  });
}

test('only bounded same-origin JSON POST with the synchronizer token passes', async () => {
  const options = {
    expectedOrigin: origin,
    csrfDigest: await sha256Hex(csrfToken),
    maxBytes: 64,
  };
  await expect(readStrictJsonMutation(request(), options)).resolves.toEqual({
    idempotencyKey: 'key',
  });

  const rejected = [
    request({ method: 'GET' }),
    request({ origin: null }),
    request({ origin: 'https://attacker.example' }),
    request({ contentType: null }),
    request({ contentType: 'text/plain' }),
    request({ csrf: null }),
    request({ csrf: 'wrong' }),
    request({ body: JSON.stringify({ value: 'x'.repeat(80) }) }),
  ];
  for (const unsafe of rejected) {
    await expect(readStrictJsonMutation(unsafe, options)).rejects.toMatchObject({
      status: expect.any(Number),
    });
  }
});

test('an oversized streaming body is cancelled before the producer is fully consumed', async () => {
  let pulls = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      if (pulls > 100) {
        controller.close();
        return;
      }
      controller.enqueue(new TextEncoder().encode('12345678'));
    },
    cancel() {
      cancelled = true;
    },
  });
  const streamed = new Request(`${origin}/api/session/reset`, {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      'x-fcs-csrf': csrfToken,
    },
    body,
  });

  await expect(
    readStrictJsonMutation(streamed, {
      expectedOrigin: origin,
      csrfDigest: await sha256Hex(csrfToken),
      maxBytes: 16,
    }),
  ).rejects.toMatchObject({ code: 'BODY_TOO_LARGE', status: 413 });
  expect(pulls).toBeLessThan(100);
  expect(cancelled).toBe(true);
});
