import assert from 'node:assert/strict';
import test from 'node:test';

import {
  issueEvidenceToken,
  parseEvidenceTokenIssuedAt,
  verifyEvidenceToken,
} from '../../lib/server/evidence-token.ts';

const binding = {
  workspaceId: '00000000-0000-4000-8000-000000000001',
  variantId: '00000000-0000-4000-8000-000000000002',
  implementedRevision: 1,
  contextDigest: 'a'.repeat(64),
  resultDigest: 'b'.repeat(64),
};
const sessionToken = Uint8Array.from({ length: 32 }, (_, index) => index);
const issuedAt = 1_788_100_000;
const expectedToken =
  'v1.1788100000.Uky7CnVOFc_VvkXUELR7PvFSUbrdqCf5C0lARIhzkrM';

test('evidence token matches the independent fixed HMAC vector', async () => {
  const token = await issueEvidenceToken({ sessionToken, issuedAt, ...binding });
  assert.equal(token, expectedToken);
  assert.ok(token.length <= 96);
  for (const privateValue of [
    Buffer.from(sessionToken).toString('base64url'),
    binding.workspaceId,
    binding.variantId,
    binding.contextDigest,
    binding.resultDigest,
  ]) {
    assert.equal(token.includes(privateValue), false);
  }
});

test('verification accepts exact lifetime and future-skew boundaries', async () => {
  assert.equal(parseEvidenceTokenIssuedAt(expectedToken, issuedAt), issuedAt);
  await assert.doesNotReject(
    verifyEvidenceToken(expectedToken, {
      sessionToken,
      now: issuedAt + 300,
      ...binding,
    }),
  );
  await assert.doesNotReject(
    verifyEvidenceToken(expectedToken, {
      sessionToken,
      now: issuedAt - 30,
      ...binding,
    }),
  );
});

test('issuance rejects noncanonical bindings and unparseable issue seconds', async () => {
  await assert.rejects(
    issueEvidenceToken({
      sessionToken,
      issuedAt,
      ...binding,
      workspaceId: `${binding.workspaceId}\nforged`,
    }),
  );
  await assert.rejects(
    issueEvidenceToken({
      sessionToken,
      issuedAt: 1_000_000_000_000,
      ...binding,
    }),
  );
});

test('verification rejects malformed, expired, future, tampered, and cross-boundary tokens', async () => {
  const cases: Array<[string, string, Parameters<typeof verifyEvidenceToken>[1]]> = [
    ['bad version', expectedToken.replace(/^v1/u, 'v2'), { sessionToken, now: issuedAt, ...binding }],
    ['padded encoding', `${expectedToken}=`, { sessionToken, now: issuedAt, ...binding }],
    ['bit tamper', `${expectedToken.slice(0, -1)}A`, { sessionToken, now: issuedAt, ...binding }],
    ['expired', expectedToken, { sessionToken, now: issuedAt + 301, ...binding }],
    ['future', expectedToken, { sessionToken, now: issuedAt - 31, ...binding }],
    ['rotated session', expectedToken, { sessionToken: new Uint8Array(32).fill(9), now: issuedAt, ...binding }],
    ['workspace', expectedToken, { sessionToken, now: issuedAt, ...binding, workspaceId: binding.variantId }],
    ['variant', expectedToken, { sessionToken, now: issuedAt, ...binding, variantId: binding.workspaceId }],
    ['revision', expectedToken, { sessionToken, now: issuedAt, ...binding, implementedRevision: 2 }],
    ['context', expectedToken, { sessionToken, now: issuedAt, ...binding, contextDigest: 'c'.repeat(64) }],
    ['result', expectedToken, { sessionToken, now: issuedAt, ...binding, resultDigest: 'd'.repeat(64) }],
  ];

  for (const [label, token, options] of cases) {
    await assert.rejects(
      verifyEvidenceToken(token, options),
      (error: unknown) =>
        error instanceof Error &&
        'code' in error &&
        error.code === 'EVIDENCE_NOT_ELIGIBLE',
      label,
    );
  }
});
