import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import developmentSuite from '../../docs/retrieval/fixtures/rrf/rrf-dev-queries-v2.json';
import {
  BEHAVIOR_OUTCOME_ALLOWLIST,
  buildQueryText,
  retrievePrecedent,
} from '../../lib/retrieval/active-focus';
import { materializeCorpusV2 } from '../../lib/retrieval/corpus-v2';
import type { RawRetrievalContext } from '../../lib/retrieval/types';
import {
  ELIGIBLE_PRECEDENTS_SQL,
  eligiblePrecedentBindings,
  loadEligiblePrecedents,
} from '../../lib/server/precedent-repository';
import { bootstrapWorkspace } from '../../lib/server/workspaces';

const AS_OF = Date.parse('2026-08-29T00:00:00Z') / 1000;
const NOW = 1_788_100_000;
const secrets = {
  sessionSecret: 'package4-test-session-secret-material-32-bytes-minimum',
  csrfSecret: 'package4-test-csrf-secret-material-32-bytes-minimum',
};

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM workspaces').run();
});

async function workspace(fill: number) {
  return bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: NOW,
    tokenBytes: new Uint8Array(32).fill(fill),
    ...secrets,
  });
}

function standardContext(workspaceId: string): RawRetrievalContext {
  const context: RawRetrievalContext = {
    workspaceKey: workspaceId,
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
    queryText: '',
    asOf: '2026-08-29T00:00:00Z',
  };
  context.queryText = buildQueryText(context);
  return context;
}

type CandidateOverrides = Partial<{
  product: string;
  componentFamily: string;
  useCase: string;
  variants: string[];
  behavior: string;
  intent: string;
  risk: string;
  outcomeKey: string;
  recordStatus: 'active' | 'superseded' | 'quarantined' | 'conflict';
  profileStatus: 'active' | 'superseded' | 'rejected' | 'quarantined';
  hostile: boolean;
  mismatchTags: string[];
  shapeTags: string[];
  relationships: Array<{ type: 'applies-to'; target: string }>;
  validFrom: number;
  validUntil: number | null;
  supersedesRecordKey: string | null;
}>;

async function insertCandidate(
  workspaceId: string,
  recordKey: string,
  ordinal: number,
  overrides: CandidateOverrides = {},
) {
  const databaseId = `${String(ordinal).padStart(8, '0')}-0000-4000-8000-${String(ordinal).padStart(12, '0')}`;
  const values = {
    product: 'focus-contract-studio',
    componentFamily: 'modal-dialog',
    useCase: 'delete-account',
    variants: ['delete-account-standard'],
    behavior: 'initial-focus',
    intent: 'destructive-confirmation',
    risk: 'irreversible',
    outcomeKey: 'cancel-button',
    recordStatus: 'active' as const,
    profileStatus: 'active' as const,
    hostile: false,
    mismatchTags: ['initial-focus-destructive'],
    shapeTags: ['reason-input-present'],
    relationships: [
      { type: 'applies-to' as const, target: 'variant:delete-account-standard' },
    ],
    validFrom: AS_OF - 100,
    validUntil: null,
    supersedesRecordKey: null,
    ...overrides,
  };
  await env.DB.prepare(
    `INSERT INTO precedent_records (
       id, workspace_id, record_key, dataset_version, scope_kind, scope_key,
       behavior, normalized_outcome_key, status, valid_from, valid_until,
       rationale, tags_json, provenance_kind, provenance_ref, immutable, created_at
     ) VALUES (?, ?, ?, 'fcs-precedent-v2', 'variant', 'delete-account-standard',
               ?, ?, ?, ?, ?, ?, '["package4"]', 'synthetic-seed', ?, 1, ?)`,
  )
    .bind(
      databaseId,
      workspaceId,
      recordKey,
      values.behavior,
      values.outcomeKey,
      values.recordStatus,
      values.validFrom,
      values.validUntil,
      `Package 4 candidate ${recordKey}`,
      `package4:${recordKey}`,
      AS_OF,
    )
    .run();
  await env.DB.prepare(
    `INSERT INTO precedent_retrieval_profiles (
       record_id, workspace_id, product, component_family, use_case,
       variants_json, intent, risk, source_status, hostile,
       mismatch_tags_json, shape_tags_json, relationships_json,
       supersedes_record_key
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      databaseId,
      workspaceId,
      values.product,
      values.componentFamily,
      values.useCase,
      JSON.stringify(values.variants),
      values.intent,
      values.risk,
      values.profileStatus,
      values.hostile ? 1 : 0,
      JSON.stringify(values.mismatchTags),
      JSON.stringify(values.shapeTags),
      JSON.stringify(values.relationships),
      values.supersedesRecordKey,
    )
    .run();
  return databaseId;
}

test('Package 4 uses exactly prior migrations and the actual prepared query uses a declared eligibility index', async () => {
  const migrations = (env as Cloudflare.Env & {
    PACKAGE4_TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
  }).PACKAGE4_TEST_MIGRATIONS;
  expect(migrations.map(({ name }) => name)).toEqual([
    '0001_package1_domain.sql',
    '0002_package2_vertical_slice.sql',
    '0003_package3_raw_observer_verifier.sql',
  ]);
  expect(ELIGIBLE_PRECEDENTS_SQL).toMatch(/LIMIT 36$/u);
  const current = await workspace(70);
  const context = standardContext(current.workspace.id);
  const outcomes = BEHAVIOR_OUTCOME_ALLOWLIST['initial-focus'];
  const plan = await env.DB.prepare(`EXPLAIN QUERY PLAN ${ELIGIBLE_PRECEDENTS_SQL}`)
    .bind(...eligiblePrecedentBindings(current.workspace.id, context, AS_OF, outcomes))
    .all<{ detail: string }>();
  const detail = plan.results.map(({ detail: value }) => value).join('\n');
  expect(detail).toMatch(/idx_precedent_(?:profiles_eligibility|eligibility)/u);
  expect(detail).not.toMatch(/SCAN (?:p|pr)\b/u);
});

test('the actual prepared query excludes every hostile, malformed-scope, wrong-scope, temporal, outcome, workspace, and superseded category', async () => {
  const current = await workspace(71);
  const foreign = await workspace(72);
  const currentId = current.workspace.id;
  await insertCandidate(foreign.workspace.id, 'D970', 970);
  await insertCandidate(currentId, 'D971', 971, { hostile: true });
  await insertCandidate(currentId, 'D972', 972, { profileStatus: 'rejected' });
  await insertCandidate(currentId, 'D973', 973, { product: 'other-product' });
  await insertCandidate(currentId, 'D974', 974, { componentFamily: 'popover' });
  await insertCandidate(currentId, 'D975', 975, { useCase: 'other-case' });
  await insertCandidate(currentId, 'D976', 976, { variants: ['delete-account-danger-emphasis'] });
  await insertCandidate(currentId, 'D977', 977, { behavior: 'escape', outcomeKey: 'close' });
  await insertCandidate(currentId, 'D978', 978, { intent: 'informational' });
  await insertCandidate(currentId, 'D979', 979, { risk: 'reversible' });
  await insertCandidate(currentId, 'D982', 982, { mismatchTags: ['other-mismatch'] });
  await insertCandidate(currentId, 'D983', 983, { validUntil: AS_OF });
  await insertCandidate(currentId, 'D984', 984, { validFrom: AS_OF + 1 });
  await insertCandidate(currentId, 'D985', 985, { outcomeKey: 'script-alert' });
  await insertCandidate(currentId, 'D986', 986, { recordStatus: 'superseded' });
  await insertCandidate(currentId, 'D987', 987, { recordStatus: 'quarantined' });
  await insertCandidate(currentId, 'D988', 988, { recordStatus: 'conflict' });
  await insertCandidate(currentId, 'D980', 980);
  await insertCandidate(currentId, 'D981', 981, { supersedesRecordKey: 'D980' });

  const loaded = await loadEligiblePrecedents(env.DB, currentId, standardContext(currentId), AS_OF);
  const ids = loaded.map(({ record }) => record.id);
  for (const excluded of [
    'D970', 'D971', 'D972', 'D973', 'D974', 'D975', 'D976', 'D977',
    'D978', 'D979', 'D982', 'D983', 'D984', 'D985', 'D986', 'D987',
    'D988', 'D980',
  ]) {
    expect(ids).not.toContain(excluded);
  }
  expect(ids).toContain('D981');
  expect(ids).toEqual([...ids].sort());
});

test('stored JSON that passes SQL predicates but violates bounded materialization fails closed', async () => {
  const current = await workspace(73);
  await insertCandidate(current.workspace.id, 'D990', 990, {
    variants: ['delete-account-standard', 'delete-account-standard'],
  });
  await expect(
    loadEligiblePrecedents(
      env.DB,
      current.workspace.id,
      standardContext(current.workspace.id),
      AS_OF,
    ),
  ).rejects.toThrow();
});

test('actual D1 eligibility and production retrieval match permitted in-memory retrieval for every supported development case', async () => {
  const current = await workspace(74);
  const workspaceId = current.workspace.id;
  const records = materializeCorpusV2().records.map((record) =>
    record.workspaceKey === 'demo-seed' ? { ...record, workspaceKey: workspaceId } : record,
  );
  for (const query of developmentSuite.queries.filter(({ expected }) => expected.disposition !== 'abstain')) {
    const context = { ...query.context, workspaceKey: workspaceId } as RawRetrievalContext;
    context.queryText = buildQueryText(context);
    const loaded = await loadEligiblePrecedents(env.DB, workspaceId, context, AS_OF);
    const fromD1 = retrievePrecedent(loaded.map(({ record }) => record), context);
    const inMemory = retrievePrecedent(records, context);
    expect(fromD1.eligibleIds, query.id).toEqual(inMemory.eligibleIds);
    expect(fromD1.disposition, query.id).toBe(inMemory.disposition);
    expect(fromD1.reasonCode, query.id).toBe(inMemory.reasonCode);
    expect(fromD1.returned.map(({ id }) => id), query.id).toEqual(
      inMemory.returned.map(({ id }) => id),
    );
  }
});

test('the actual prepared query is deterministically ordered and absolutely bounded to 36 rows', async () => {
  const current = await workspace(75);
  for (let index = 0; index < 40; index += 1) {
    await insertCandidate(
      current.workspace.id,
      `D${String(900 + index).padStart(3, '0')}`,
      1_000 + index,
    );
  }
  const loaded = await loadEligiblePrecedents(
    env.DB,
    current.workspace.id,
    standardContext(current.workspace.id),
    AS_OF,
  );
  const ids = loaded.map(({ record }) => record.id);
  expect(ids).toHaveLength(36);
  expect(ids).toEqual([...ids].sort());
});
