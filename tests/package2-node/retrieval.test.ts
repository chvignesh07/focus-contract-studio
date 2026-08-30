import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  buildQueryText,
  retrievePrecedent,
} from '../../lib/retrieval/active-focus.ts';
import { materializeCorpusV2 } from '../../lib/retrieval/corpus-v2.ts';
import type { RawRetrievalContext } from '../../lib/retrieval/types.ts';

const standardInitialFocus: RawRetrievalContext = {
  workspaceKey: 'demo-seed',
  product: 'focus-contract-studio',
  componentFamily: 'modal-dialog',
  useCase: 'delete-account',
  variant: 'delete-account-standard',
  behavior: 'initial-focus',
  intent: 'destructive-confirmation',
  risk: 'irreversible',
  observedOutcomeKey: 'delete-button',
  mismatchTag: 'initial-focus-destructive',
  shapeTag: 'reason-input-present',
  queryText:
    'product=focus-contract-studio family=modal-dialog use_case=delete-account variant=delete-account-standard behavior=initial-focus observed=delete-button mismatch=initial-focus-destructive shape=reason-input-present intent=destructive-confirmation risk=irreversible',
  asOf: '2026-08-29T00:00:00Z',
};

test('whole-field materialization reproduces the sealed 36-record corpus digest', () => {
  const corpus = materializeCorpusV2();
  assert.equal(corpus.records.length, 36);
  assert.equal(new Set(corpus.records.map((record) => record.id)).size, 36);
  assert.equal(
    createHash('sha256').update(JSON.stringify(corpus)).digest('hex'),
    '5e944319b6898b9a843a4c4885a89cc81a418c7444d21624df94694d5c872724',
  );
});

test('neutral query text is byte-exact and never includes a desired outcome', () => {
  assert.equal(buildQueryText(standardInitialFocus), standardInitialFocus.queryText);
  assert.equal(buildQueryText(standardInitialFocus).includes('cancel-button'), false);
});

test('frozen eligible-only ranks return the hand-checked DEV2-01 packet', () => {
  const result = retrievePrecedent(materializeCorpusV2().records, standardInitialFocus);
  assert.equal(result.disposition, 'results');
  assert.equal(result.reasonCode, 'SUPPORTED_PRECEDENT');
  assert.deepEqual(result.eligibleIds, ['D001', 'D003', 'D029']);
  assert.deepEqual(result.lists.lexical.map((record) => record.id), ['D029', 'D001', 'D003']);
  assert.deepEqual(result.lists.structured.map((record) => record.id), ['D001', 'D003', 'D029']);
  assert.deepEqual(result.lists.relationship.map((record) => record.id), ['D001', 'D003', 'D029']);
  assert.deepEqual(result.returned.map((record) => record.id), ['D001', 'D003']);
  assert.equal(result.returned[0]?.outcomeKey, 'cancel-button');
  assert.equal(result.returned[0]?.rrfDisplay, '0.04891592');
});

test('exact conflicting outcomes remain conflict and score cannot resolve them', () => {
  const conflict: RawRetrievalContext = {
    ...standardInitialFocus,
    mismatchTag: 'policy-exception',
    queryText:
      'product=focus-contract-studio family=modal-dialog use_case=delete-account variant=delete-account-standard behavior=initial-focus observed=delete-button mismatch=policy-exception shape=reason-input-present intent=destructive-confirmation risk=irreversible',
  };
  const result = retrievePrecedent(materializeCorpusV2().records, conflict);
  assert.equal(result.disposition, 'conflict');
  assert.equal(result.reasonCode, 'EXACT_OUTCOME_CONFLICT');
  assert.deepEqual(result.returned.map((record) => record.id), ['D028', 'D027']);
  assert.notEqual(result.returned[0]?.outcomeKey, result.returned[1]?.outcomeKey);
});

test('unsupported context abstains before ranking and hostile/ineligible rows never appear', () => {
  const unsupported: RawRetrievalContext = {
    ...standardInitialFocus,
    product: 'other-product',
    queryText:
      'product=other-product family=modal-dialog use_case=delete-account variant=delete-account-standard behavior=initial-focus observed=delete-button mismatch=initial-focus-destructive shape=reason-input-present intent=destructive-confirmation risk=irreversible',
  };
  const unsupportedResult = retrievePrecedent(
    materializeCorpusV2().records,
    unsupported,
  );
  assert.deepEqual(unsupportedResult, {
    disposition: 'abstain',
    reasonCode: 'UNSUPPORTED_CONTEXT',
    eligibleIds: [],
    lists: { lexical: [], structured: [], relationship: [] },
    returned: [],
  });

  const result = retrievePrecedent(materializeCorpusV2().records, standardInitialFocus);
  const forbidden = new Set(['D004', 'D005', 'D006', 'D007', 'D008']);
  assert.equal(
    [...result.eligibleIds, ...result.returned.map((record) => record.id)].some((id) =>
      forbidden.has(id),
    ),
    false,
  );
});

test('Stage -1 rejects unsupported behavior tuples and noncanonical server instants', () => {
  const unsupportedTuple: RawRetrievalContext = {
    ...standardInitialFocus,
    observedOutcomeKey: 'arbitrary-target',
  };
  unsupportedTuple.queryText = buildQueryText(unsupportedTuple);
  assert.equal(
    retrievePrecedent(materializeCorpusV2().records, unsupportedTuple).reasonCode,
    'UNSUPPORTED_CONTEXT',
  );

  const noncanonicalInstant: RawRetrievalContext = {
    ...standardInitialFocus,
    asOf: '2026-08-29T00:00:00.000Z',
  };
  assert.equal(
    retrievePrecedent(materializeCorpusV2().records, noncanonicalInstant)
      .reasonCode,
    'UNSUPPORTED_CONTEXT',
  );
});

test('Stage 0 excludes malformed outcomes and active records superseded by active valid records', () => {
  const malformedOutcome = structuredClone(materializeCorpusV2().records);
  malformedOutcome.find((record) => record.id === 'D001')!.outcomeKey =
    'javascript:alert(1)';
  assert.equal(
    retrievePrecedent(malformedOutcome, standardInitialFocus).eligibleIds.includes(
      'D001',
    ),
    false,
  );

  const superseded = structuredClone(materializeCorpusV2().records);
  superseded.find((record) => record.id === 'D001')!.supersedes = 'D003';
  assert.equal(
    retrievePrecedent(superseded, standardInitialFocus).eligibleIds.includes(
      'D003',
    ),
    false,
  );
});

test('retrieval is byte-deterministic for 100 repetitions', () => {
  const records = materializeCorpusV2().records;
  const baseline = JSON.stringify(retrievePrecedent(records, standardInitialFocus));
  for (let repetition = 1; repetition < 100; repetition += 1) {
    assert.equal(JSON.stringify(retrievePrecedent(records, standardInitialFocus)), baseline);
  }
});
