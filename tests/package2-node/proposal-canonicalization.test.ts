import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalProposalDocument,
  changedFocusFields,
  normalizeProposalSummary,
  proposalDocumentHash,
  supportRequirementForField,
} from '../../lib/domain/proposal.ts';
import {
  CANCEL_CONFIGURATION,
  REVISION_1_CONFIGURATION,
} from '../../lib/domain/focus-configuration.ts';

const fieldEvidence = [
  {
    field: 'initialFocus' as const,
    recordId: 'D001',
    behavior: 'initial-focus' as const,
    normalizedOutcomeKey: 'cancel-button',
  },
];

const expected =
  '{"schemaVersion":1,"variantId":"00000000-0000-4000-8000-000000000002","baseImplementedRevision":1,"configuration":{"initialFocus":"cancel-button","focusOrder":["reason-input","cancel-button","delete-button"],"trapTab":"wrap","trapShiftTab":"wrap","escapeAction":"close","returnFocus":"delete-trigger"},"evidenceQueryId":"00000000-0000-4000-8000-000000000003","evidenceRecordIds":["D001"],"fieldEvidence":[{"field":"initialFocus","recordId":"D001","behavior":"initial-focus","normalizedOutcomeKey":"cancel-button"}],"summary":"Focus Cancel first.","authorKind":"agent","status":"proposed","createdAt":"2026-08-30T14:26:43Z"}';

test('proposal canonical JSON and SHA-256 match the fixed independent vector', async () => {
  const value = canonicalProposalDocument({
    variantId: '00000000-0000-4000-8000-000000000002',
    baseImplementedRevision: 1,
    configuration: CANCEL_CONFIGURATION,
    evidenceQueryId: '00000000-0000-4000-8000-000000000003',
    evidenceRecordIds: ['D001'],
    fieldEvidence,
    summary: 'Focus Cancel first.',
    createdAt: 1_788_100_003,
  });
  assert.equal(value, expected);
  assert.equal(
    await proposalDocumentHash(value),
    '466913328b113b5c7e1b9f8d55a176d9f2d0e304188abb100b927b2941291428',
  );
});

test('summary, changed-field ordering, and evidence outcome mappings are closed', () => {
  assert.equal(normalizeProposalSummary('  Cafe\u0301  \n repair  '), 'Café repair');
  assert.deepEqual(
    changedFocusFields(REVISION_1_CONFIGURATION, CANCEL_CONFIGURATION),
    ['initialFocus'],
  );
  assert.deepEqual(
    supportRequirementForField('initialFocus', CANCEL_CONFIGURATION),
    { behavior: 'initial-focus', normalizedOutcomeKey: 'cancel-button' },
  );
  assert.deepEqual(
    supportRequirementForField('focusOrder', CANCEL_CONFIGURATION),
    { behavior: 'focus-order', normalizedOutcomeKey: 'reason-cancel-delete' },
  );
  assert.throws(() => normalizeProposalSummary('\u0000hidden'));
});
