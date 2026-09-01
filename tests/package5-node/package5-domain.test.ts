import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CANCEL_CONFIGURATION,
  canonicalFocusConfiguration,
  implementedFocusConfigurationSchema,
} from '../../lib/domain/focus-configuration.ts';
import {
  applyRequestSchema,
  assertExactBatch,
  canonicalPackage5Request,
  historyRecords,
  reviewRequestSchema,
  transitionProposal,
  undoRequestSchema,
} from '../../lib/domain/package5.ts';

const key = '00000000-0000-4000-8000-000000005001';
const proposalId = '00000000-0000-4000-8000-000000005002';
test('strict mutation inputs accept only the authority declared for each operation', () => {
  assert.deepEqual(reviewRequestSchema.parse({
    action: 'approve',
    idempotencyKey: key,
  }), {
    action: 'approve',
    idempotencyKey: key,
  });
  assert.equal(reviewRequestSchema.safeParse({
    action: 'approve',
    idempotencyKey: key,
    proposalHash: 'a'.repeat(64),
  }).success, false);
  assert.deepEqual(applyRequestSchema.parse({
    proposalId,
    expectedImplementedRevision: 1,
    idempotencyKey: key,
  }), { proposalId, expectedImplementedRevision: 1, idempotencyKey: key });
  assert.equal(applyRequestSchema.safeParse({
    proposalId,
    expectedImplementedRevision: 1,
    idempotencyKey: key,
    proposalHash: 'a'.repeat(64),
  }).success, false);
  assert.deepEqual(undoRequestSchema.parse({
    restoreRevision: 1,
    expectedImplementedRevision: 2,
    idempotencyKey: key,
  }), { restoreRevision: 1, expectedImplementedRevision: 2, idempotencyKey: key });
  assert.equal(undoRequestSchema.safeParse({
    restoreRevision: 2,
    expectedImplementedRevision: 2,
    idempotencyKey: key,
  }).success, false);
  const edit = reviewRequestSchema.parse({
    action: 'edit',
    idempotencyKey: key,
    configuration: CANCEL_CONFIGURATION,
    summary: 'Focus Cancel first.',
  });
  assert.equal(edit.action, 'edit');
  if (edit.action !== 'edit') assert.fail('edit request did not preserve its discriminator');
  assert.deepEqual(edit.configuration, CANCEL_CONFIGURATION);
  assert.equal(applyRequestSchema.safeParse({
    proposalId,
    expectedImplementedRevision: 0,
    idempotencyKey: key,
  }).success, false);
});

test('canonical requests are stable and reject unsupported values', () => {
  const value = applyRequestSchema.parse({ proposalId, expectedImplementedRevision: 1, idempotencyKey: key });
  assert.equal(
    canonicalPackage5Request('apply', value),
    `{"operation":"apply","proposalId":"${proposalId}","expectedImplementedRevision":1,"idempotencyKey":"${key}"}`,
  );
  assert.throws(() => transitionProposal('rejected', 'approve'), /INVALID_PROPOSAL_TRANSITION/u);
  assert.equal(transitionProposal('proposed', 'approve'), 'approved');
  assert.equal(transitionProposal('proposed', 'reject'), 'rejected');
  assert.equal(transitionProposal('approved', 'revoke'), 'revoked');
  assert.throws(() => transitionProposal('proposed', 'revoke'), /INVALID_PROPOSAL_TRANSITION/u);
});

test('exact batch interpretation fails closed on length, success, or row-count drift', () => {
  const result = (changes: number, success = true) => ({ success, meta: { changes } }) as D1Result;
  assert.doesNotThrow(() => assertExactBatch([result(1), result(0)], [1, 0], 'review'));
  assert.throws(() => assertExactBatch([result(1)], [1, 1], 'review'), /review/u);
  assert.throws(() => assertExactBatch([result(1, false)], [1], 'review'), /review/u);
  assert.throws(() => assertExactBatch([result(0)], [1], 'review'), /review/u);
  assert.throws(() => assertExactBatch([result(0, false)], [1], 'review'), /review/u);
});

test('history is bounded, chronological, stable on ties, and strips unknown fields', () => {
  const safe = historyRecords([
    { kind: 'application', id: 'b', proposalId, fromRevision: 1, toRevision: 2, occurredAt: 12, secret: 'drop' },
    { kind: 'proposal', id: 'a', proposalDigest8: '12345678', baseRevision: 1, status: 'approved', occurredAt: 10 },
    { kind: 'decision', id: 'c', proposalId, action: 'approve', occurredAt: 12 },
  ], 2);
  assert.deepEqual(safe, [
    { kind: 'application', id: 'b', proposalId, fromRevision: 1, toRevision: 2, occurredAt: 12 },
    { kind: 'decision', id: 'c', proposalId, action: 'approve', occurredAt: 12 },
  ]);
  assert.equal(JSON.stringify(safe).includes('secret'), false);
  assert.throws(() => historyRecords([], 0), /INVALID_HISTORY_LIMIT/u);
  assert.throws(() => historyRecords([], 201), /INVALID_HISTORY_LIMIT/u);
  assert.throws(() => historyRecords([], 1.5), /INVALID_HISTORY_LIMIT/u);
  assert.deepEqual(historyRecords([
    { kind: 'unknown', id: 'x', occurredAt: 9 },
    { kind: 'reset', id: 'r', occurredAt: 9 },
  ]), [{ kind: 'reset', id: 'r', occurredAt: 9 }]);
});

test('focus configuration validation and canonicalization cover the inherited safety boundary', () => {
  assert.equal(
    canonicalFocusConfiguration(CANCEL_CONFIGURATION),
    '{"initialFocus":"cancel-button","focusOrder":["reason-input","cancel-button","delete-button"],"trapTab":"wrap","trapShiftTab":"wrap","escapeAction":"close","returnFocus":"delete-trigger"}',
  );
  assert.equal(implementedFocusConfigurationSchema.safeParse({
    ...CANCEL_CONFIGURATION,
    focusOrder: ['reason-input', 'reason-input', 'delete-button'],
  }).success, false);
});
