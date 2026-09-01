import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PACKAGE6_OPERATION_KINDS,
  PACKAGE6_VARIANTS,
  activeVariantRequestSchema,
  derivePackage6Stages,
  operationState,
  stateKindForPublicCode,
} from '../../lib/domain/package6.ts';

test('active variant input is the exact two-slug CAS allowlist', () => {
  for (const variant of PACKAGE6_VARIANTS) {
    assert.deepEqual(activeVariantRequestSchema.parse({
      variant,
      expectedViewRevision: 7,
    }), {
      variant,
      expectedViewRevision: 7,
    });
  }
  for (const invalid of [
    { variant: 'unknown', expectedViewRevision: 1 },
    { variant: PACKAGE6_VARIANTS[0], expectedViewRevision: 0 },
    { variant: PACKAGE6_VARIANTS[0], expectedViewRevision: 1, workspaceId: crypto.randomUUID() },
    { variantId: crypto.randomUUID(), expectedViewRevision: 1 },
  ]) {
    assert.equal(activeVariantRequestSchema.safeParse(invalid).success, false);
  }
});

test('six inspectable stages derive from committed state instead of decorative progress', () => {
  const initial = derivePackage6Stages({
    observed: false,
    retrievalResolved: true,
    proposalStatus: null,
    applied: false,
    verified: false,
    historyKinds: ['revision'],
  });
  assert.deepEqual(initial.map(({ id, state }) => [id, state]), [
    ['observe', 'current'],
    ['precedent', 'complete'],
    ['proposal', 'available'],
    ['review', 'available'],
    ['apply', 'available'],
    ['verify-history', 'available'],
  ]);
  assert.deepEqual(initial.map(({ href }) => href), [
    '#observe', '#precedent', '#proposal', '#review-authority', '#apply', '#verify-history',
  ]);

  const approved = derivePackage6Stages({
    observed: true,
    retrievalResolved: true,
    proposalStatus: 'approved',
    applied: false,
    verified: false,
    historyKinds: ['revision', 'proposal', 'decision'],
  });
  assert.deepEqual(approved.map(({ state }) => state), [
    'complete', 'complete', 'complete', 'complete', 'current', 'available',
  ]);

  const verified = derivePackage6Stages({
    observed: true,
    retrievalResolved: true,
    proposalStatus: 'applied',
    applied: true,
    verified: true,
    historyKinds: ['revision', 'application', 'verification', 'projection'],
  });
  assert.equal(verified.length, 6);
  assert.equal(verified.every(({ state }) => state === 'complete'), true);
});

test('every required operation state has one stable safe next action contract', () => {
  assert.deepEqual(PACKAGE6_OPERATION_KINDS, [
    'loading',
    'empty',
    'abstention',
    'conflict',
    'validationFailure',
    'staleState',
    'rateLimit',
    'expiredSession',
    'unsupportedWebMCP',
    'uncertainNetwork',
    'recovery',
    'success',
    'verifiedFailure',
    'verifiedPass',
  ]);
  const codes = new Set<string>();
  for (const kind of PACKAGE6_OPERATION_KINDS) {
    const state = operationState(kind);
    assert.deepEqual(Object.keys(state).sort(), [
      'code',
      'correlationId',
      'happened',
      'kind',
      'nextAction',
      'revisionChanged',
    ]);
    assert.deepEqual(Object.keys(state.nextAction).sort(), ['label', 'target']);
    assert.ok(state.nextAction.label.length > 0);
    assert.match(state.nextAction.target, /^#/u);
    assert.match(state.correlationId, /^(?:local-[a-z-]+|[0-9a-f-]{36})$/u);
    assert.equal(codes.has(state.code), false);
    codes.add(state.code);
    assert.equal(stateKindForPublicCode(state.code), kind);
  }
});

test('server public codes select truthful recovery states without leaking detail', () => {
  assert.equal(stateKindForPublicCode('VIEW_STATE_STALE'), 'staleState');
  assert.equal(stateKindForPublicCode('SESSION_EXPIRED'), 'expiredSession');
  assert.equal(stateKindForPublicCode('RATE_LIMITED'), 'rateLimit');
  assert.equal(stateKindForPublicCode('INVALID_REQUEST'), 'validationFailure');
  assert.equal(stateKindForPublicCode('APPLICATION_WRITE_FAILED'), 'uncertainNetwork');
  assert.equal(stateKindForPublicCode('something-private'), 'uncertainNetwork');
});
