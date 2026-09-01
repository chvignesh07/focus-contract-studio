import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applicationCandidateError,
  auditHistoryKind,
  boundedHistoryLimit,
} from '../../lib/server/package5-operation-policy.ts';

test('application policy closes every absent, authority, and revision branch', () => {
  assert.equal(applicationCandidateError(null, 1), 'PROPOSAL_NOT_FOUND');
  assert.equal(applicationCandidateError({
    status: 'proposed', baseImplementedRevision: 1, activeImplementedRevision: 1,
  }, 1), 'APPLICATION_STALE');
  assert.equal(applicationCandidateError({
    status: 'approved', baseImplementedRevision: 2, activeImplementedRevision: 1,
  }, 1), 'APPLICATION_STALE');
  assert.equal(applicationCandidateError({
    status: 'approved', baseImplementedRevision: 1, activeImplementedRevision: 2,
  }, 1), 'APPLICATION_STALE');
  assert.equal(applicationCandidateError({
    status: 'approved', baseImplementedRevision: 1, activeImplementedRevision: 1,
  }, 1), null);
});

test('history policy accepts only bounded integer limits', () => {
  assert.equal(boundedHistoryLimit(undefined), 100);
  assert.equal(boundedHistoryLimit(1), 1);
  assert.equal(boundedHistoryLimit(200), 200);
  for (const invalid of [0, 201, 1.5]) {
    assert.throws(() => boundedHistoryLimit(invalid), /INVALID_HISTORY_LIMIT/u);
  }
});

test('audit history policy allowlists reset and failure classes only', () => {
  assert.equal(auditHistoryKind('workspace.reset', 'success'), 'reset');
  assert.equal(auditHistoryKind('application.failed', 'failure'), 'failure');
  assert.equal(auditHistoryKind('application.applied', 'success'), null);
});
