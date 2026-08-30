import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import {
  canonicalFocusConfiguration,
  implementedFocusConfigurationSchema,
} from '../../lib/domain/focus-configuration';
import { sha256Hex } from '../../lib/server/crypto';

const workspaceA = '00000000-0000-4000-8000-000000000101';
const workspaceB = '00000000-0000-4000-8000-000000000102';
const variantA = '00000000-0000-4000-8000-000000000201';
const deleteConfigurationJson = JSON.stringify({
  initialFocus: 'delete-button',
  focusOrder: ['reason-input', 'cancel-button', 'delete-button'],
  trapTab: 'wrap',
  trapShiftTab: 'wrap',
  escapeAction: 'close',
  returnFocus: 'delete-trigger',
});
const deleteConfigurationHash =
  '470a0491136de5ac58f3228bfc36115ef698568770e3d1e3195f0b6e78c196ff';
const cancelConfigurationJson = JSON.stringify({
  initialFocus: 'cancel-button',
  focusOrder: ['reason-input', 'cancel-button', 'delete-button'],
  trapTab: 'wrap',
  trapShiftTab: 'wrap',
  escapeAction: 'close',
  returnFocus: 'delete-trigger',
});
const cancelConfigurationHash =
  'b6bc505df6f2be8c8aaeb080a43c440d9ddbb58b6ca113a276316793ece7afcd';

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM workspaces').run();
});

async function insertWorkspace(id: string, subjectKey: string) {
  await env.DB.prepare(
    `INSERT INTO workspaces (
       id, subject_kind, subject_key, csrf_digest, generation,
       created_at, last_access_at, access_expires_at, grace_expires_at
     ) VALUES (?, 'anonymous', ?, ?, 1, 100, 100, 200, 300)`,
  )
    .bind(id, subjectKey, 'f'.repeat(64))
    .run();
}

async function insertVariantWithRevision(
  workspaceId: string,
  variantId: string,
  slug = 'delete-account-standard',
) {
  await env.DB.batch([
    env.DB
      .prepare(
        `INSERT INTO component_variants (
           id, workspace_id, product, family, use_case, slug,
           active_implemented_revision, created_at
         ) VALUES (?, ?, 'focus-contract-studio', 'modal-dialog', 'delete-account', ?, 1, 100)`,
      )
      .bind(variantId, workspaceId, slug),
    env.DB
      .prepare(
        `INSERT INTO implemented_focus_revisions (
           id, workspace_id, variant_id, revision, configuration_json,
           configuration_hash, created_at
         ) VALUES (?, ?, ?, 1, ?, ?, 100)`,
      )
      .bind(
        `${variantId.slice(0, -1)}9`,
        workspaceId,
        variantId,
        deleteConfigurationJson,
        deleteConfigurationHash,
      ),
  ]);
}

test('D1 catalogs all and only the 24 canonical focus configurations with exact hashes', async () => {
  const catalog = await env.DB.prepare(
    `SELECT configuration_json, configuration_hash
       FROM fcs_focus_configuration_catalog_v2
      ORDER BY configuration_json`,
  ).all<{ configuration_json: string; configuration_hash: string }>();
  expect(catalog.results).toHaveLength(24);
  expect(new Set(catalog.results.map((row) => row.configuration_json)).size).toBe(24);
  expect(new Set(catalog.results.map((row) => row.configuration_hash)).size).toBe(24);
  for (const row of catalog.results) {
    const parsed = implementedFocusConfigurationSchema.parse(
      JSON.parse(row.configuration_json),
    );
    expect(canonicalFocusConfiguration(parsed)).toBe(row.configuration_json);
    expect(await sha256Hex(row.configuration_json)).toBe(row.configuration_hash);
  }
});

test('immutable revisions accept only canonical focus configurations with matching hashes', async () => {
  await insertWorkspace(workspaceA, 'a'.repeat(64));
  await insertVariantWithRevision(workspaceA, variantA);
  const invalidConfigurations = [
    { configuration: '{}', hash: 'c'.repeat(64) },
    {
      configuration: deleteConfigurationJson.replace(/\}$/u, ',"unexpected":true}'),
      hash: deleteConfigurationHash,
    },
    {
      configuration: deleteConfigurationJson.replace('delete-button', 'outside-dialog'),
      hash: deleteConfigurationHash,
    },
    {
      configuration: deleteConfigurationJson.replace(
        '["reason-input","cancel-button","delete-button"]',
        '["reason-input","reason-input","delete-button"]',
      ),
      hash: deleteConfigurationHash,
    },
    { configuration: deleteConfigurationJson, hash: '0'.repeat(64) },
  ];
  for (const invalid of invalidConfigurations) {
    await expect(
      env.DB.prepare(
        `INSERT INTO implemented_focus_revisions (
           id, workspace_id, variant_id, revision, configuration_json,
           configuration_hash, parent_revision, created_at
         ) VALUES (?, ?, ?, 2, ?, ?, 1, 101)`,
      )
        .bind(
          '00000000-0000-4000-8000-000000000303',
          workspaceA,
          variantA,
          invalid.configuration,
          invalid.hash,
        )
        .run(),
    ).rejects.toThrow(/FOCUS_CONFIGURATION_INVALID/);
  }

  await expect(
    env.DB.prepare(
      `INSERT INTO implemented_focus_revisions (
         id, workspace_id, variant_id, revision, configuration_json,
         configuration_hash, parent_revision, created_at
       ) VALUES (?, ?, ?, 2, ?, ?, 1, 101)`,
    )
      .bind(
        '00000000-0000-4000-8000-000000000303',
        workspaceA,
        variantA,
        cancelConfigurationJson,
        cancelConfigurationHash,
      )
      .run(),
  ).resolves.toMatchObject({ success: true });
});

test('immutable proposals accept only canonical focus configurations', async () => {
  await insertWorkspace(workspaceA, 'a'.repeat(64));
  await insertVariantWithRevision(workspaceA, variantA);
  const queryId = '00000000-0000-4000-8000-000000000601';
  const proposalId = '00000000-0000-4000-8000-000000000701';
  const insertPair = (configuration: string) =>
    env.DB.batch([
      env.DB.prepare('PRAGMA defer_foreign_keys = on'),
      env.DB
        .prepare(
          `INSERT INTO retrieval_queries (
             id, workspace_id, proposal_id, variant_id, implemented_revision,
             raw_context_json, validated_context_json, query_text,
             algorithm_version, prefilter_version, dataset_version,
             token_issued_at, as_of, context_digest, result_digest, created_at
           ) VALUES (?, ?, ?, ?, 1, '{}', '{}', 'configuration validation',
             'fcs-rrf-v2', 'fcs-eligibility-v2', 'fcs-precedent-v2',
             100, 100, ?, ?, 100)`,
        )
        .bind(
          queryId,
          workspaceA,
          proposalId,
          variantA,
          'a'.repeat(64),
          'b'.repeat(64),
        ),
      env.DB
        .prepare(
          `INSERT INTO proposals (
             id, workspace_id, variant_id, base_implemented_revision,
             configuration_json, evidence_query_id, evidence_record_ids_json,
             support_map_json, summary, author_kind, proposal_json,
             proposal_hash, status, created_at
           ) VALUES (?, ?, ?, 1, ?, ?, '[]', '{}', 'Configuration validation',
             'agent', '{}', ?, 'proposed', 100)`,
        )
        .bind(
          proposalId,
          workspaceA,
          variantA,
          configuration,
          queryId,
          'c'.repeat(64),
        ),
    ]);

  for (const invalid of [
    '{}',
    cancelConfigurationJson.replace(/\}$/u, ',"unexpected":true}'),
    cancelConfigurationJson.replace('cancel-button', 'outside-dialog'),
    cancelConfigurationJson.replace(
      '["reason-input","cancel-button","delete-button"]',
      '["reason-input","reason-input","delete-button"]',
    ),
  ]) {
    await expect(insertPair(invalid)).rejects.toThrow(/FOCUS_CONFIGURATION_INVALID/);
  }
  await expect(insertPair(cancelConfigurationJson)).resolves.toHaveLength(3);
});

test('revision parent lineage must resolve in the same workspace and variant', async () => {
  await insertWorkspace(workspaceA, 'a'.repeat(64));
  const orphanVariant = '00000000-0000-4000-8000-000000000221';
  const results = await env.DB.batch([
    env.DB.prepare('PRAGMA defer_foreign_keys = on'),
    env.DB
      .prepare(
        `INSERT INTO component_variants (
           id, workspace_id, product, family, use_case, slug,
           active_implemented_revision, created_at
         ) VALUES (?, ?, 'focus-contract-studio', 'modal-dialog',
           'delete-account', 'orphan-parent', 2, 100)`,
      )
      .bind(orphanVariant, workspaceA),
    env.DB
      .prepare(
        `INSERT INTO implemented_focus_revisions (
           id, workspace_id, variant_id, revision, configuration_json,
           configuration_hash, parent_revision, created_at
         ) VALUES (?, ?, ?, 2, ?, ?, 1, 101)`,
      )
      .bind(
        '00000000-0000-4000-8000-000000000321',
        workspaceA,
        orphanVariant,
        cancelConfigurationJson,
        cancelConfigurationHash,
      ),
    env.DB.prepare('PRAGMA foreign_key_check'),
    env.DB.prepare('DELETE FROM workspaces WHERE id = ?').bind(workspaceA),
  ]);
  expect(results[3]?.results).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ table: 'implemented_focus_revisions' }),
    ]),
  );
});

test('proposal parent lineage must resolve inside the same workspace', async () => {
  await insertWorkspace(workspaceA, 'a'.repeat(64));
  await insertVariantWithRevision(workspaceA, variantA);
  const queryId = '00000000-0000-4000-8000-000000000621';
  const proposalId = '00000000-0000-4000-8000-000000000721';
  const results = await env.DB.batch([
    env.DB.prepare('PRAGMA defer_foreign_keys = on'),
    env.DB
      .prepare(
        `INSERT INTO retrieval_queries (
           id, workspace_id, proposal_id, variant_id, implemented_revision,
           raw_context_json, validated_context_json, query_text,
           algorithm_version, prefilter_version, dataset_version,
           token_issued_at, as_of, context_digest, result_digest, created_at
         ) VALUES (?, ?, ?, ?, 1, '{}', '{}', 'parent lineage',
           'fcs-rrf-v2', 'fcs-eligibility-v2', 'fcs-precedent-v2',
           100, 100, ?, ?, 100)`,
      )
      .bind(
        queryId,
        workspaceA,
        proposalId,
        variantA,
        'a'.repeat(64),
        'b'.repeat(64),
      ),
    env.DB
      .prepare(
        `INSERT INTO proposals (
           id, workspace_id, variant_id, base_implemented_revision,
           configuration_json, evidence_query_id, evidence_record_ids_json,
           support_map_json, summary, author_kind, proposal_json,
           proposal_hash, parent_proposal_id, status, created_at
         ) VALUES (?, ?, ?, 1, ?, ?, '[]', '{}', 'Parent lineage',
           'agent', '{}', ?, ?, 'proposed', 100)`,
      )
      .bind(
        proposalId,
        workspaceA,
        variantA,
        cancelConfigurationJson,
        queryId,
        'c'.repeat(64),
        '00000000-0000-4000-8000-000000009999',
      ),
    env.DB.prepare('PRAGMA foreign_key_check'),
    env.DB.prepare('DELETE FROM workspaces WHERE id = ?').bind(workspaceA),
  ]);
  expect(results[3]?.results).toEqual(
    expect.arrayContaining([expect.objectContaining({ table: 'proposals' })]),
  );
});

test('proposal lineage rejects an immutable self-parent', async () => {
  await insertWorkspace(workspaceA, 'a'.repeat(64));
  await insertVariantWithRevision(workspaceA, variantA);
  const queryId = '00000000-0000-4000-8000-000000000631';
  const proposalId = '00000000-0000-4000-8000-000000000731';
  await expect(
    env.DB.batch([
      env.DB.prepare('PRAGMA defer_foreign_keys = on'),
      env.DB
        .prepare(
          `INSERT INTO retrieval_queries (
             id, workspace_id, proposal_id, variant_id, implemented_revision,
             raw_context_json, validated_context_json, query_text,
             algorithm_version, prefilter_version, dataset_version,
             token_issued_at, as_of, context_digest, result_digest, created_at
           ) VALUES (?, ?, ?, ?, 1, '{}', '{}', 'self parent',
             'fcs-rrf-v2', 'fcs-eligibility-v2', 'fcs-precedent-v2',
             100, 100, ?, ?, 100)`,
        )
        .bind(
          queryId,
          workspaceA,
          proposalId,
          variantA,
          'a'.repeat(64),
          'b'.repeat(64),
        ),
      env.DB
        .prepare(
          `INSERT INTO proposals (
             id, workspace_id, variant_id, base_implemented_revision,
             configuration_json, evidence_query_id, evidence_record_ids_json,
             support_map_json, summary, author_kind, proposal_json,
             proposal_hash, parent_proposal_id, status, created_at
           ) VALUES (?, ?, ?, 1, ?, ?, '[]', '{}', 'Self parent',
             'agent', '{}', ?, ?, 'proposed', 100)`,
        )
        .bind(
          proposalId,
          workspaceA,
          variantA,
          cancelConfigurationJson,
          queryId,
          'c'.repeat(64),
          proposalId,
        ),
    ]),
  ).rejects.toThrow(/PROPOSAL_LINEAGE_CYCLE/);
});

test('proposal lineage rejects a two-row deferred cycle', async () => {
  await insertWorkspace(workspaceA, 'a'.repeat(64));
  await insertVariantWithRevision(workspaceA, variantA);
  const values = [
    {
      query: '00000000-0000-4000-8000-000000000632',
      proposal: '00000000-0000-4000-8000-000000000732',
      parent: '00000000-0000-4000-8000-000000000733',
      hash: 'd'.repeat(64),
    },
    {
      query: '00000000-0000-4000-8000-000000000633',
      proposal: '00000000-0000-4000-8000-000000000733',
      parent: '00000000-0000-4000-8000-000000000732',
      hash: 'e'.repeat(64),
    },
  ];
  const statements = values.flatMap((value) => [
    env.DB
      .prepare(
        `INSERT INTO retrieval_queries (
           id, workspace_id, proposal_id, variant_id, implemented_revision,
           raw_context_json, validated_context_json, query_text,
           algorithm_version, prefilter_version, dataset_version,
           token_issued_at, as_of, context_digest, result_digest, created_at
         ) VALUES (?, ?, ?, ?, 1, '{}', '{}', 'two row cycle',
           'fcs-rrf-v2', 'fcs-eligibility-v2', 'fcs-precedent-v2',
           100, 100, ?, ?, 100)`,
      )
      .bind(
        value.query,
        workspaceA,
        value.proposal,
        variantA,
        'a'.repeat(64),
        'b'.repeat(64),
      ),
    env.DB
      .prepare(
        `INSERT INTO proposals (
           id, workspace_id, variant_id, base_implemented_revision,
           configuration_json, evidence_query_id, evidence_record_ids_json,
           support_map_json, summary, author_kind, proposal_json,
           proposal_hash, parent_proposal_id, status, created_at
         ) VALUES (?, ?, ?, 1, ?, ?, '[]', '{}', 'Two row cycle',
           'agent', '{}', ?, ?, 'proposed', 100)`,
      )
      .bind(
        value.proposal,
        workspaceA,
        variantA,
        cancelConfigurationJson,
        value.query,
        value.hash,
        value.parent,
      ),
  ]);
  await expect(
    env.DB.batch([
      env.DB.prepare('PRAGMA defer_foreign_keys = on'),
      ...statements,
    ]),
  ).rejects.toThrow(/PROPOSAL_LINEAGE_CYCLE/);
});

test('application finalization binds the implemented revision to the committed receipt', async () => {
  await insertWorkspace(workspaceA, 'a'.repeat(64));
  const variantB = '00000000-0000-4000-8000-000000000212';
  await insertVariantWithRevision(workspaceA, variantA);
  await insertVariantWithRevision(
    workspaceA,
    variantB,
    'delete-account-danger-emphasis',
  );
  const queryA = '00000000-0000-4000-8000-000000000641';
  const queryB = '00000000-0000-4000-8000-000000000642';
  const proposalA = '00000000-0000-4000-8000-000000000741';
  const proposalB = '00000000-0000-4000-8000-000000000742';
  const guardA = '00000000-0000-4000-8000-000000000841';
  const guardB = '00000000-0000-4000-8000-000000000842';
  const receiptA = '00000000-0000-4000-8000-000000000941';
  const receiptB = '00000000-0000-4000-8000-000000000942';
  const proposalHashA = 'a'.repeat(64);
  const proposalHashB = 'b'.repeat(64);
  const proposalStatements = [
    { query: queryA, proposal: proposalA, variant: variantA, hash: proposalHashA },
    { query: queryB, proposal: proposalB, variant: variantB, hash: proposalHashB },
  ].flatMap((value) => [
    env.DB
      .prepare(
        `INSERT INTO retrieval_queries (
           id, workspace_id, proposal_id, variant_id, implemented_revision,
           raw_context_json, validated_context_json, query_text,
           algorithm_version, prefilter_version, dataset_version,
           token_issued_at, as_of, context_digest, result_digest, created_at
         ) VALUES (?, ?, ?, ?, 1, '{}', '{}', 'receipt binding',
           'fcs-rrf-v2', 'fcs-eligibility-v2', 'fcs-precedent-v2',
           100, 100, ?, ?, 100)`,
      )
      .bind(
        value.query,
        workspaceA,
        value.proposal,
        value.variant,
        'c'.repeat(64),
        'd'.repeat(64),
      ),
    env.DB
      .prepare(
        `INSERT INTO proposals (
           id, workspace_id, variant_id, base_implemented_revision,
           configuration_json, evidence_query_id, evidence_record_ids_json,
           support_map_json, summary, author_kind, proposal_json,
           proposal_hash, status, created_at
         ) VALUES (?, ?, ?, 1, ?, ?, '[]', '{}', 'Receipt binding',
           'agent', '{}', ?, 'proposed', 100)`,
      )
      .bind(
        value.proposal,
        workspaceA,
        value.variant,
        cancelConfigurationJson,
        value.query,
        value.hash,
      ),
  ]);
  await env.DB.batch([
    env.DB.prepare('PRAGMA defer_foreign_keys = on'),
    ...proposalStatements,
    env.DB
      .prepare(
        `INSERT INTO application_guards (
           id, workspace_id, variant_id, proposal_id, from_revision,
           to_revision, proposal_hash, idempotency_key, created_at
         ) VALUES (?, ?, ?, ?, 1, 2, ?, 'receipt-binding-a', 101)`,
      )
      .bind(guardA, workspaceA, variantA, proposalA, proposalHashA),
    env.DB
      .prepare(
        `INSERT INTO application_guards (
           id, workspace_id, variant_id, proposal_id, from_revision,
           to_revision, proposal_hash, idempotency_key, created_at
         ) VALUES (?, ?, ?, ?, 1, 2, ?, 'receipt-binding-b', 101)`,
      )
      .bind(guardB, workspaceA, variantB, proposalB, proposalHashB),
    env.DB
      .prepare(
        `INSERT INTO application_receipts (
           id, workspace_id, guard_id, proposal_id, proposal_hash,
           from_revision, to_revision, idempotency_key, result, created_at
         ) VALUES (?, ?, ?, ?, ?, 1, 2, 'receipt-binding-a',
           'applied', 102)`,
      )
      .bind(receiptA, workspaceA, guardA, proposalA, proposalHashA),
    env.DB
      .prepare(
        `INSERT INTO application_receipts (
           id, workspace_id, guard_id, proposal_id, proposal_hash,
           from_revision, to_revision, idempotency_key, result, created_at
         ) VALUES (?, ?, ?, ?, ?, 1, 2, 'receipt-binding-b',
           'applied', 102)`,
      )
      .bind(receiptB, workspaceA, guardB, proposalB, proposalHashB),
    env.DB
      .prepare(
        `INSERT INTO implemented_focus_revisions (
           id, workspace_id, variant_id, revision, configuration_json,
           configuration_hash, parent_revision, source_proposal_id,
           source_receipt_id, created_at
         ) VALUES (?, ?, ?, 2, ?, ?, 1, ?, ?, 103)`,
      )
      .bind(
        '00000000-0000-4000-8000-000000000341',
        workspaceA,
        variantA,
        cancelConfigurationJson,
        cancelConfigurationHash,
        proposalA,
        receiptB,
      ),
  ]);
  await env.DB.prepare(
    `UPDATE component_variants SET active_implemented_revision = 2
      WHERE workspace_id = ? AND id = ?`,
  )
    .bind(workspaceA, variantA)
    .run();
  await env.DB.prepare(`UPDATE proposals SET status = 'approved' WHERE id = ?`)
    .bind(proposalA)
    .run();
  await env.DB.prepare(`UPDATE proposals SET status = 'applied' WHERE id = ?`)
    .bind(proposalA)
    .run();
  await env.DB.prepare(
    `INSERT INTO idempotency_records (
       id, workspace_id, operation, idempotency_key, request_hash, state,
       result_kind, result_id, created_at, expires_at
     ) VALUES (?, ?, 'apply', 'receipt-binding-record', ?, 'committed',
       'application', ?, 104, 204)`,
  )
    .bind(
      '00000000-0000-4000-8000-000000000951',
      workspaceA,
      'e'.repeat(64),
      receiptA,
    )
    .run();
  await env.DB.prepare(
    `INSERT INTO audit_events (
       id, workspace_id, actor_kind, action, target_kind, target_id,
       result, correlation_id, safe_detail_json, occurred_at
     ) VALUES (?, ?, 'system', 'application.applied', 'receipt', ?,
       'success', 'receipt-binding-correlation', '{}', 104)`,
  )
    .bind(
      '00000000-0000-4000-8000-000000000952',
      workspaceA,
      receiptA,
    )
    .run();

  await expect(
    env.DB.prepare(
      `INSERT INTO application_commits (
         id, workspace_id, guard_id, receipt_id, created_at
       ) VALUES (?, ?, ?, ?, 105)`,
    )
      .bind(
        '00000000-0000-4000-8000-000000000953',
        workspaceA,
        guardA,
        receiptA,
      )
      .run(),
  ).rejects.toThrow(/APPLICATION_INCOMPLETE/);
  expect(
    await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM application_commits WHERE workspace_id = ?`,
    )
      .bind(workspaceA)
      .first(),
  ).toEqual({ count: 0 });
});

test('workspace enums, digests, lifecycle bounds, and subject uniqueness fail closed', async () => {
  await insertWorkspace(workspaceA, 'a'.repeat(64));

  await expect(
    insertWorkspace(workspaceB, 'a'.repeat(64)),
  ).rejects.toThrow();
  await expect(
    env.DB.prepare(
      `INSERT INTO workspaces (
         id, subject_kind, subject_key, csrf_digest, generation,
         created_at, last_access_at, access_expires_at, grace_expires_at
       ) VALUES (?, 'owner', ?, ?, 1, 100, 100, 200, 300)`,
    )
      .bind(workspaceB, 'b'.repeat(64), 'c'.repeat(64))
      .run(),
  ).rejects.toThrow();
  await expect(
    env.DB.prepare(
      `INSERT INTO workspaces (
         id, subject_kind, subject_key, csrf_digest, generation,
         created_at, last_access_at, access_expires_at, grace_expires_at
       ) VALUES (?, 'anonymous', ?, ?, 1, 100, 100, 90, 300)`,
    )
      .bind(workspaceB, 'b'.repeat(64), 'c'.repeat(64))
      .run(),
  ).rejects.toThrow();
});

test('composite foreign keys reject cross-workspace variant relationships', async () => {
  await insertWorkspace(workspaceA, 'a'.repeat(64));
  await insertWorkspace(workspaceB, 'b'.repeat(64));
  await insertVariantWithRevision(workspaceA, variantA);

  await expect(
    env.DB.prepare(
      `INSERT INTO workspace_view_state (
         workspace_id, active_variant_id, view_revision, updated_at
       ) VALUES (?, ?, 1, 100)`,
    )
      .bind(workspaceB, variantA)
      .run(),
  ).rejects.toThrow();
});

test('variant slug, revision, state, and idempotency uniqueness are enforced', async () => {
  await insertWorkspace(workspaceA, 'a'.repeat(64));
  await insertVariantWithRevision(workspaceA, variantA);

  await expect(
    insertVariantWithRevision(
      workspaceA,
      '00000000-0000-4000-8000-000000000202',
    ),
  ).rejects.toThrow();
  await expect(
    env.DB.prepare(
      `INSERT INTO implemented_focus_revisions (
         id, workspace_id, variant_id, revision, configuration_json,
         configuration_hash, created_at
       ) VALUES (?, ?, ?, 1, ?, ?, 101)`,
    )
      .bind(
        '00000000-0000-4000-8000-000000000302',
        workspaceA,
        variantA,
        deleteConfigurationJson,
        deleteConfigurationHash,
      )
      .run(),
  ).rejects.toThrow();

  await env.DB.prepare(
    `INSERT INTO idempotency_records (
       id, workspace_id, operation, idempotency_key, request_hash,
       state, created_at, expires_at
     ) VALUES (?, ?, 'reset', ?, ?, 'started', 100, 200)`,
  )
    .bind(
      '00000000-0000-4000-8000-000000000401',
      workspaceA,
      '00000000-0000-4000-8000-000000000501',
      'e'.repeat(64),
    )
    .run();
  await expect(
    env.DB.prepare(
      `INSERT INTO idempotency_records (
         id, workspace_id, operation, idempotency_key, request_hash,
         state, created_at, expires_at
       ) VALUES (?, ?, 'reset', ?, ?, 'committed', 101, 200)`,
    )
      .bind(
        '00000000-0000-4000-8000-000000000402',
        workspaceA,
        '00000000-0000-4000-8000-000000000501',
        'f'.repeat(64),
      )
      .run(),
  ).rejects.toThrow();
});

test('active revision pointers and reset finalization fail closed inside D1', async () => {
  await insertWorkspace(workspaceA, 'a'.repeat(64));
  await insertVariantWithRevision(workspaceA, variantA);
  await expect(
    env.DB.prepare(
      `UPDATE component_variants SET active_implemented_revision = 99
        WHERE workspace_id = ? AND id = ?`,
    )
      .bind(workspaceA, variantA)
      .run(),
  ).rejects.toThrow(/ACTIVE_REVISION_NOT_FOUND/);

  await insertWorkspace(workspaceB, 'b'.repeat(64));
  await env.DB.prepare(
    `INSERT INTO idempotency_records (
       id, workspace_id, operation, idempotency_key, request_hash,
       state, created_at, expires_at
     ) VALUES (?, ?, 'reset', ?, ?, 'started', 100, 200)`,
  )
    .bind(
      '00000000-0000-4000-8000-000000000451',
      workspaceA,
      '00000000-0000-4000-8000-000000000551',
      'e'.repeat(64),
    )
    .run();
  await expect(
    env.DB.prepare(
      `UPDATE idempotency_records
          SET state = 'committed', result_kind = 'workspace', result_id = ?
        WHERE id = ?`,
    )
      .bind(workspaceB, '00000000-0000-4000-8000-000000000451')
      .run(),
  ).rejects.toThrow(/RESET_INCOMPLETE/);
  expect(
    await env.DB.prepare(
      `SELECT state, result_id FROM idempotency_records WHERE id = ?`,
    )
      .bind('00000000-0000-4000-8000-000000000451')
      .first(),
  ).toEqual({ state: 'started', result_id: null });
});

test('active revision pointers advance exactly one existing revision and never rewind', async () => {
  await insertWorkspace(workspaceA, 'a'.repeat(64));
  await insertVariantWithRevision(workspaceA, variantA);
  await env.DB.prepare(
    `INSERT INTO implemented_focus_revisions (
       id, workspace_id, variant_id, revision, configuration_json,
       configuration_hash, parent_revision, created_at
     ) VALUES (?, ?, ?, 2, ?, ?, 1, 101)`,
  )
    .bind(
      '00000000-0000-4000-8000-000000000303',
      workspaceA,
      variantA,
      cancelConfigurationJson,
      cancelConfigurationHash,
    )
    .run();
  await env.DB.prepare(
    `UPDATE component_variants SET active_implemented_revision = 2
      WHERE workspace_id = ? AND id = ?`,
  )
    .bind(workspaceA, variantA)
    .run();

  await expect(
    env.DB.prepare(
      `UPDATE component_variants SET active_implemented_revision = 1
        WHERE workspace_id = ? AND id = ?`,
    )
      .bind(workspaceA, variantA)
      .run(),
  ).rejects.toThrow(/ACTIVE_REVISION_NOT_NEXT/);
  expect(
    await env.DB.prepare(
      `SELECT active_implemented_revision FROM component_variants
        WHERE workspace_id = ? AND id = ?`,
    )
      .bind(workspaceA, variantA)
      .first(),
  ).toEqual({ active_implemented_revision: 2 });
});

test('D1 flags an inserted variant with a nonexistent active revision before commit', async () => {
  await insertWorkspace(workspaceA, 'a'.repeat(64));
  const invalidVariant = '00000000-0000-4000-8000-000000000221';
  const results = await env.DB.batch([
    env.DB.prepare('PRAGMA defer_foreign_keys = on'),
    env.DB
      .prepare(
        `INSERT INTO component_variants (
           id, workspace_id, product, family, use_case, slug,
           active_implemented_revision, created_at
         ) VALUES (?, ?, 'focus-contract-studio', 'modal-dialog',
           'delete-account', 'invalid-active-revision', 2, 100)`,
      )
      .bind(invalidVariant, workspaceA),
    env.DB.prepare('PRAGMA foreign_key_check'),
    env.DB.prepare(`DELETE FROM workspaces WHERE id = ?`).bind(workspaceA),
  ]);
  expect(
    results[2]?.results,
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ table: 'component_variants' }),
    ]),
  );
  expect(await env.DB.prepare(`SELECT COUNT(*) AS count FROM workspaces`).first())
    .toEqual({ count: 0 });
});

test('D1 flags nonexistent and foreign-workspace revision provenance before commit', async () => {
  await insertWorkspace(workspaceB, 'b'.repeat(64));
  const variantB = '00000000-0000-4000-8000-000000000222';
  await insertVariantWithRevision(workspaceB, variantB, 'delete-account-foreign');
  const queryB = '00000000-0000-4000-8000-000000000622';
  const proposalB = '00000000-0000-4000-8000-000000000722';
  const guardB = '00000000-0000-4000-8000-000000000822';
  const receiptB = '00000000-0000-4000-8000-000000000922';
  const proposalHash = 'd'.repeat(64);
  await env.DB.batch([
    env.DB.prepare('PRAGMA defer_foreign_keys = on'),
    env.DB
      .prepare(
        `INSERT INTO retrieval_queries (
           id, workspace_id, proposal_id, variant_id, implemented_revision,
           raw_context_json, validated_context_json, query_text,
           algorithm_version, prefilter_version, dataset_version,
           token_issued_at, as_of, context_digest, result_digest, created_at
         ) VALUES (?, ?, ?, ?, 1, '{}', '{}', 'foreign provenance',
           'fcs-rrf-v2', 'fcs-eligibility-v2', 'fcs-precedent-v2',
           100, 100, ?, ?, 100)`,
      )
      .bind(
        queryB,
        workspaceB,
        proposalB,
        variantB,
        'a'.repeat(64),
        'b'.repeat(64),
      ),
    env.DB
      .prepare(
        `INSERT INTO proposals (
           id, workspace_id, variant_id, base_implemented_revision,
           configuration_json, evidence_query_id, evidence_record_ids_json,
           support_map_json, summary, author_kind, proposal_json,
           proposal_hash, status, created_at
         ) VALUES (?, ?, ?, 1, ?, ?, '[]', '{}', 'Foreign proposal',
           'agent', '{}', ?, 'proposed', 100)`,
      )
      .bind(
        proposalB,
        workspaceB,
        variantB,
        cancelConfigurationJson,
        queryB,
        proposalHash,
      ),
    env.DB
      .prepare(
        `INSERT INTO application_guards (
           id, workspace_id, variant_id, proposal_id, from_revision,
           to_revision, proposal_hash, idempotency_key, created_at
         ) VALUES (?, ?, ?, ?, 1, 2, ?, 'foreign-provenance-key', 101)`,
      )
      .bind(guardB, workspaceB, variantB, proposalB, proposalHash),
    env.DB
      .prepare(
        `INSERT INTO application_receipts (
           id, workspace_id, guard_id, proposal_id, proposal_hash,
           from_revision, to_revision, idempotency_key, result, created_at
         ) VALUES (?, ?, ?, ?, ?, 1, 2, 'foreign-provenance-key',
           'applied', 102)`,
      )
      .bind(receiptB, workspaceB, guardB, proposalB, proposalHash),
  ]);

  const invalidProvenance = [
    {
      revisionId: '00000000-0000-4000-8000-000000000331',
      proposalId: '00000000-0000-4000-8000-000000009991',
      receiptId: null,
    },
    {
      revisionId: '00000000-0000-4000-8000-000000000332',
      proposalId: proposalB,
      receiptId: null,
    },
    {
      revisionId: '00000000-0000-4000-8000-000000000333',
      proposalId: null,
      receiptId: '00000000-0000-4000-8000-000000009992',
    },
    {
      revisionId: '00000000-0000-4000-8000-000000000334',
      proposalId: null,
      receiptId: receiptB,
    },
  ] as const;
  for (const invalid of invalidProvenance) {
    await insertWorkspace(workspaceA, 'a'.repeat(64));
    await insertVariantWithRevision(workspaceA, variantA);
    const results = await env.DB.batch([
      env.DB.prepare('PRAGMA defer_foreign_keys = on'),
      env.DB
        .prepare(
          `INSERT INTO implemented_focus_revisions (
             id, workspace_id, variant_id, revision, configuration_json,
             configuration_hash, parent_revision, source_proposal_id,
             source_receipt_id, created_at
           ) VALUES (?, ?, ?, 2, ?, ?, 1, ?, ?, 110)`,
        )
        .bind(
          invalid.revisionId,
          workspaceA,
          variantA,
          cancelConfigurationJson,
          cancelConfigurationHash,
          invalid.proposalId,
          invalid.receiptId,
        ),
      env.DB.prepare('PRAGMA foreign_key_check'),
      env.DB
        .prepare(
          `SELECT active_implemented_revision FROM component_variants
            WHERE workspace_id = ? AND id = ?`,
        )
        .bind(workspaceA, variantA),
      env.DB.prepare(`DELETE FROM workspaces WHERE id = ?`).bind(workspaceA),
    ]);
    expect(results[2]?.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: 'implemented_focus_revisions' }),
      ]),
    );
    expect(results[3]?.results).toEqual([
      { active_implemented_revision: 1 },
    ]);
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM implemented_focus_revisions WHERE id = ?`,
      )
        .bind(invalid.revisionId)
        .first(),
    ).toEqual({ count: 0 });
  }
});

test('D1 commits the deferred proposal/retrieval cycle in either insertion order', async () => {
  const pairs = [
    {
      workspaceId: workspaceA,
      subjectKey: 'a'.repeat(64),
      variantId: variantA,
      queryId: '00000000-0000-4000-8000-000000000601',
      proposalId: '00000000-0000-4000-8000-000000000701',
      queryFirst: true,
    },
    {
      workspaceId: workspaceB,
      subjectKey: 'b'.repeat(64),
      variantId: '00000000-0000-4000-8000-000000000212',
      queryId: '00000000-0000-4000-8000-000000000602',
      proposalId: '00000000-0000-4000-8000-000000000702',
      queryFirst: false,
    },
  ];
  for (const pair of pairs) {
    await insertWorkspace(pair.workspaceId, pair.subjectKey);
    await insertVariantWithRevision(pair.workspaceId, pair.variantId);
    const query = env.DB.prepare(
      `INSERT INTO retrieval_queries (
         id, workspace_id, proposal_id, variant_id, implemented_revision,
         raw_context_json, validated_context_json, query_text,
         algorithm_version, prefilter_version, dataset_version,
         token_issued_at, as_of, context_digest, result_digest, created_at
       ) VALUES (?, ?, ?, ?, 1, '{}', '{}', 'initial focus',
         'fcs-rrf-v2', 'fcs-eligibility-v2', 'fcs-precedent-v2',
         100, 100, ?, ?, 100)`,
    )
      .bind(
        pair.queryId,
        pair.workspaceId,
        pair.proposalId,
        pair.variantId,
        'a'.repeat(64),
        'b'.repeat(64),
      );
    const proposal = env.DB.prepare(
      `INSERT INTO proposals (
         id, workspace_id, variant_id, base_implemented_revision,
         configuration_json, evidence_query_id, evidence_record_ids_json,
         support_map_json, summary, author_kind, proposal_json,
         proposal_hash, status, created_at
       ) VALUES (?, ?, ?, 1, ?, ?, '[]', '{}', 'Deferred cycle proof',
         'agent', '{}', ?, 'proposed', 100)`,
    ).bind(
      pair.proposalId,
      pair.workspaceId,
      pair.variantId,
      cancelConfigurationJson,
      pair.queryId,
      'c'.repeat(64),
    );
    await expect(
      env.DB.batch([
        env.DB.prepare('PRAGMA defer_foreign_keys = on'),
        ...(pair.queryFirst ? [query, proposal] : [proposal, query]),
      ]),
    ).resolves.toHaveLength(3);
    expect(
      await env.DB.prepare(
        `SELECT q.id AS query_id, p.id AS proposal_id
           FROM retrieval_queries q
           JOIN proposals p
             ON p.workspace_id = q.workspace_id
            AND p.id = q.proposal_id
            AND p.evidence_query_id = q.id
          WHERE q.workspace_id = ?`,
      )
        .bind(pair.workspaceId)
        .first(),
    ).toEqual({ query_id: pair.queryId, proposal_id: pair.proposalId });
  }

  const queryTable = await env.DB.prepare(
    `SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'retrieval_queries'`,
  ).first<{ sql: string }>();
  const proposalTable = await env.DB.prepare(
    `SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'proposals'`,
  ).first<{ sql: string }>();
  expect(queryTable?.sql).toMatch(
    /FOREIGN KEY \(workspace_id, proposal_id\)[\s\S]*REFERENCES proposals\(workspace_id, id\) DEFERRABLE INITIALLY DEFERRED/,
  );
  expect(proposalTable?.sql).toMatch(
    /FOREIGN KEY \(workspace_id, evidence_query_id\)[\s\S]*REFERENCES retrieval_queries\(workspace_id, id\)/,
  );
});

test('retrieval results cannot bypass workspace ownership with NULL', async () => {
  await insertWorkspace(workspaceA, 'a'.repeat(64));
  await insertVariantWithRevision(workspaceA, variantA);
  const recordId = '00000000-0000-4000-8000-000000000681';
  const queryId = '00000000-0000-4000-8000-000000000682';
  const proposalId = '00000000-0000-4000-8000-000000000683';
  await env.DB.batch([
    env.DB.prepare('PRAGMA defer_foreign_keys = on'),
    env.DB
      .prepare(
        `INSERT INTO precedent_records (
           id, workspace_id, record_key, dataset_version, scope_kind, scope_key,
           behavior, normalized_outcome_key, status, valid_from, rationale,
           tags_json, provenance_kind, provenance_ref, created_at
         ) VALUES (?, ?, 'D001', 'fcs-precedent-v2', 'use_case',
           'delete-account', 'initial-focus', 'cancel-button', 'active', 0,
           'Workspace ownership proof.', '[]', 'synthetic-seed', 'D001', 100)`,
      )
      .bind(recordId, workspaceA),
    env.DB
      .prepare(
        `INSERT INTO retrieval_queries (
           id, workspace_id, proposal_id, variant_id, implemented_revision,
           raw_context_json, validated_context_json, query_text,
           algorithm_version, prefilter_version, dataset_version,
           token_issued_at, as_of, context_digest, result_digest, created_at
         ) VALUES (?, ?, ?, ?, 1, '{}', '{}', 'workspace ownership',
           'fcs-rrf-v2', 'fcs-eligibility-v2', 'fcs-precedent-v2',
           100, 100, ?, ?, 100)`,
      )
      .bind(
        queryId,
        workspaceA,
        proposalId,
        variantA,
        'a'.repeat(64),
        'b'.repeat(64),
      ),
    env.DB
      .prepare(
        `INSERT INTO proposals (
           id, workspace_id, variant_id, base_implemented_revision,
           configuration_json, evidence_query_id, evidence_record_ids_json,
           support_map_json, summary, author_kind, proposal_json,
           proposal_hash, status, created_at
         ) VALUES (?, ?, ?, 1, ?, ?, '[]', '{}', 'Ownership proposal',
           'agent', '{}', ?, 'proposed', 100)`,
      )
      .bind(
        proposalId,
        workspaceA,
        variantA,
        cancelConfigurationJson,
        queryId,
        'c'.repeat(64),
      ),
  ]);

  await expect(
    env.DB.prepare(
      `INSERT INTO retrieval_results (
         id, workspace_id, query_id, record_id, eligibility_reason,
         lexical_contribution, structured_contribution,
         relationship_contribution, structured_score, relationship_tier,
         rrf_score, result_order, disposition
       ) VALUES (?, NULL, ?, ?, 'attempted NULL bypass',
         '0', '0', '0', 0, 0, '0', 1, 'support')`,
    )
      .bind(
        '00000000-0000-4000-8000-000000000684',
        queryId,
        recordId,
      )
      .run(),
  ).rejects.toThrow();
  expect(
    await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM retrieval_results WHERE query_id = ?`,
    )
      .bind(queryId)
      .first(),
  ).toEqual({ count: 0 });
});

test('append-only entities have update/delete guards while workspace purge still cascades', async () => {
  const immutableTables = [
    'implemented_focus_revisions',
    'rendered_manifests',
    'observation_events',
    'precedent_records',
    'precedent_subject_edges',
    'precedent_lineage',
    'retrieval_queries',
    'retrieval_results',
    'proposal_evidence',
    'review_decisions',
    'application_guards',
    'application_receipts',
    'application_commits',
    'verification_receipts',
    'verification_checks',
    'audit_events',
  ] as const;
  const triggers = await env.DB.prepare(
    `SELECT name FROM sqlite_schema WHERE type = 'trigger' ORDER BY name`,
  ).all<{ name: string }>();
  const names = new Set(triggers.results.map(({ name }) => name));
  for (const table of immutableTables) {
    expect(names.has(`trg_${table}_immutable_update`), table).toBe(true);
    expect(names.has(`trg_${table}_immutable_delete`), table).toBe(true);
  }

  await insertWorkspace(workspaceA, 'a'.repeat(64));
  await insertVariantWithRevision(workspaceA, variantA);
  await expect(
    env.DB.prepare(
      `UPDATE implemented_focus_revisions SET configuration_hash = ?
        WHERE workspace_id = ? AND variant_id = ? AND revision = 1`,
    )
      .bind('e'.repeat(64), workspaceA, variantA)
      .run(),
  ).rejects.toThrow(/IMPLEMENTED_FOCUS_REVISIONS_IMMUTABLE/);
  await expect(
    env.DB.prepare(
      `DELETE FROM implemented_focus_revisions
        WHERE workspace_id = ? AND variant_id = ? AND revision = 1`,
    )
      .bind(workspaceA, variantA)
      .run(),
  ).rejects.toThrow(/IMPLEMENTED_FOCUS_REVISIONS_IMMUTABLE/);

  await env.DB.prepare('DELETE FROM workspaces WHERE id = ?')
    .bind(workspaceA)
    .run();
  expect(
    await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM implemented_focus_revisions WHERE workspace_id = ?',
    )
      .bind(workspaceA)
      .first(),
  ).toEqual({ count: 0 });
});

test('reset finalizer requires the complete Package 2 corpus and exact D001 standard edge', async () => {
  const trigger = await env.DB.prepare(
    `SELECT sql FROM sqlite_schema
      WHERE type = 'trigger' AND name = 'trg_reset_commit_complete'`,
  ).first<{ sql: string }>();
  expect(trigger?.sql).toMatch(/COUNT\(\*\) FROM precedent_records[\s\S]*= 34/);
  expect(trigger?.sql).toMatch(
    /COUNT\(\*\) FROM precedent_retrieval_profiles[\s\S]*= 34/,
  );
  expect(trigger?.sql).toMatch(
    /COUNT\(\*\) FROM precedent_subject_edges[\s\S]*= 1/,
  );
  expect(trigger?.sql).toMatch(/delete-account-standard/);
  expect(trigger?.sql).toMatch(/normalized_outcome_key = 'cancel-button'/);
});

test('workspace identity, view revisions, and idempotency request identity are immutable', async () => {
  await insertWorkspace(workspaceA, 'a'.repeat(64));
  await insertVariantWithRevision(workspaceA, variantA);
  await env.DB.prepare(
    `INSERT INTO workspace_view_state (
       workspace_id, active_variant_id, view_revision, updated_at
     ) VALUES (?, ?, 1, 100)`,
  )
    .bind(workspaceA, variantA)
    .run();
  await expect(
    env.DB.prepare(`UPDATE workspaces SET subject_key = ? WHERE id = ?`)
      .bind('b'.repeat(64), workspaceA)
      .run(),
  ).rejects.toThrow(/WORKSPACE_IDENTITY_IMMUTABLE/);
  await expect(
    env.DB.prepare(
      `UPDATE workspace_view_state
          SET view_revision = 3, updated_at = 101 WHERE workspace_id = ?`,
    )
      .bind(workspaceA)
      .run(),
  ).rejects.toThrow(/VIEW_REVISION_NOT_NEXT/);

  const recordId = '00000000-0000-4000-8000-000000000801';
  await env.DB.prepare(
    `INSERT INTO idempotency_records (
       id, workspace_id, operation, idempotency_key, request_hash,
       state, created_at, expires_at
     ) VALUES (?, ?, 'create_proposal', 'proposal-key', ?, 'started', 100, 200)`,
  )
    .bind(recordId, workspaceA, 'd'.repeat(64))
    .run();
  await expect(
    env.DB.prepare(
      `UPDATE idempotency_records SET request_hash = ? WHERE id = ?`,
    )
      .bind('e'.repeat(64), recordId)
      .run(),
  ).rejects.toThrow(/IDEMPOTENCY_REQUEST_IMMUTABLE/);
  await expect(
    env.DB.prepare(`DELETE FROM idempotency_records WHERE id = ?`)
      .bind(recordId)
      .run(),
  ).rejects.toThrow(/IDEMPOTENCY_RECORDS_IMMUTABLE/);
  expect(
    await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM idempotency_records WHERE id = ?`,
    )
      .bind(recordId)
      .first(),
  ).toEqual({ count: 1 });

  await env.DB.prepare(`DELETE FROM workspaces WHERE id = ?`)
    .bind(workspaceA)
    .run();
  expect(
    await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM idempotency_records WHERE id = ?`,
    )
      .bind(recordId)
      .first(),
  ).toEqual({ count: 0 });
});

test('observation sessions enforce the recording-finalized-verification state machine', async () => {
  await insertWorkspace(workspaceA, 'a'.repeat(64));
  await insertVariantWithRevision(workspaceA, variantA);
  const sessionId = '00000000-0000-4000-8000-000000000901';
  await env.DB.prepare(
    `INSERT INTO observation_sessions (
       id, workspace_id, variant_id, implemented_revision, environment,
       nonce_digest, state, created_at, expires_at
     ) VALUES (?, ?, ?, 1, 'playwright', ?, 'recording', 100, 200)`,
  )
    .bind(sessionId, workspaceA, variantA, 'a'.repeat(64))
    .run();
  await expect(
    env.DB.prepare(
      `UPDATE observation_sessions SET state = 'verified_pass' WHERE id = ?`,
    )
      .bind(sessionId)
      .run(),
  ).rejects.toThrow(/OBSERVATION_TRANSITION_INVALID/);
  await expect(
    env.DB.prepare(
      `UPDATE observation_sessions
          SET state = 'finalized', finalized_at = 150 WHERE id = ?`,
    )
      .bind(sessionId)
      .run(),
  ).rejects.toThrow(/OBSERVATION_FINALIZATION_INCOMPLETE/);
  await env.DB.prepare(
    `UPDATE observation_sessions
        SET state = 'finalized', finalized_at = 150,
            event_digest = ?, manifest_digest = ? WHERE id = ?`,
  )
    .bind('b'.repeat(64), 'c'.repeat(64), sessionId)
    .run();
  await env.DB.prepare(
    `UPDATE observation_sessions SET state = 'verified_pass' WHERE id = ?`,
  )
    .bind(sessionId)
    .run();
  await expect(
    env.DB.prepare(
      `UPDATE observation_sessions SET state = 'recording' WHERE id = ?`,
    )
      .bind(sessionId)
      .run(),
  ).rejects.toThrow(/OBSERVATION_TRANSITION_INVALID/);
});

test('proposal payload is immutable and status follows the exact transition vocabulary', async () => {
  await insertWorkspace(workspaceA, 'a'.repeat(64));
  await insertVariantWithRevision(workspaceA, variantA);
  const queryId = '00000000-0000-4000-8000-000000000611';
  const proposalId = '00000000-0000-4000-8000-000000000711';
  const query = env.DB.prepare(
    `INSERT INTO retrieval_queries (
       id, workspace_id, proposal_id, variant_id, implemented_revision,
       raw_context_json, validated_context_json, query_text,
       algorithm_version, prefilter_version, dataset_version,
       token_issued_at, as_of, context_digest, result_digest, created_at
     ) VALUES (?, ?, ?, ?, 1, '{}', '{}', 'initial focus',
       'fcs-rrf-v2', 'fcs-eligibility-v2', 'fcs-precedent-v2',
       100, 100, ?, ?, 100)`,
  ).bind(
    queryId,
    workspaceA,
    proposalId,
    variantA,
    'a'.repeat(64),
    'b'.repeat(64),
  );
  const proposal = env.DB.prepare(
    `INSERT INTO proposals (
       id, workspace_id, variant_id, base_implemented_revision,
       configuration_json, evidence_query_id, evidence_record_ids_json,
       support_map_json, summary, author_kind, proposal_json,
       proposal_hash, status, created_at
     ) VALUES (?, ?, ?, 1, ?, ?, '[]', '{}', 'Immutable proposal',
       'agent', '{}', ?, 'proposed', 100)`,
  ).bind(
    proposalId,
    workspaceA,
    variantA,
    cancelConfigurationJson,
    queryId,
    'c'.repeat(64),
  );
  await env.DB.batch([
    env.DB.prepare('PRAGMA defer_foreign_keys = on'),
    query,
    proposal,
  ]);

  await expect(
    env.DB.prepare(`UPDATE proposals SET summary = 'rewritten' WHERE id = ?`)
      .bind(proposalId)
      .run(),
  ).rejects.toThrow(/PROPOSAL_PAYLOAD_IMMUTABLE/);
  await expect(
    env.DB.prepare(`UPDATE proposals SET status = 'applied' WHERE id = ?`)
      .bind(proposalId)
      .run(),
  ).rejects.toThrow(/PROPOSAL_TRANSITION_INVALID/);
  await env.DB.prepare(`UPDATE proposals SET status = 'approved' WHERE id = ?`)
    .bind(proposalId)
    .run();
  await env.DB.prepare(`UPDATE proposals SET status = 'revoked' WHERE id = ?`)
    .bind(proposalId)
    .run();
  expect(
    await env.DB.prepare(`SELECT status FROM proposals WHERE id = ?`)
      .bind(proposalId)
      .first(),
  ).toEqual({ status: 'revoked' });
});

test('a complete retained graph blocks child deletion and purges atomically by workspace', async () => {
  await insertWorkspace(workspaceA, 'a'.repeat(64));
  await insertVariantWithRevision(workspaceA, variantA);
  const observationSessionId = '00000000-0000-4000-8000-000000001001';
  const precedentA = '00000000-0000-4000-8000-000000001101';
  const precedentB = '00000000-0000-4000-8000-000000001102';
  const queryId = '00000000-0000-4000-8000-000000001201';
  const proposalId = '00000000-0000-4000-8000-000000001202';
  const resultId = '00000000-0000-4000-8000-000000001203';
  const guardId = '00000000-0000-4000-8000-000000001206';
  const receiptId = '00000000-0000-4000-8000-000000001207';
  const proposalHash = 'd'.repeat(64);
  await env.DB.batch([
    env.DB.prepare('PRAGMA defer_foreign_keys = on'),
    env.DB
      .prepare(
        `INSERT INTO workspace_view_state (
           workspace_id, active_variant_id, view_revision, updated_at
         ) VALUES (?, ?, 1, 100)`,
      )
      .bind(workspaceA, variantA),
    env.DB
      .prepare(
        `INSERT INTO observation_sessions (
           id, workspace_id, variant_id, implemented_revision, environment,
           nonce_digest, state, created_at, expires_at
         ) VALUES (?, ?, ?, 1, 'browser', ?, 'recording', 100, 200)`,
      )
      .bind(observationSessionId, workspaceA, variantA, 'a'.repeat(64)),
    env.DB
      .prepare(
        `INSERT INTO rendered_manifests (
           id, workspace_id, session_id, manifest_version, target_ids_json,
           tabbable_order_json, dialog_name, dialog_description, open_state,
           role, aria_modal, manifest_hash, created_at
         ) VALUES (?, ?, ?, 'focus-manifest-v1', '["cancel-button"]',
           '["cancel-button","delete-button"]', 'Delete account',
           'Confirm account deletion', 1, 'dialog', 1, ?, 101)`,
      )
      .bind(
        '00000000-0000-4000-8000-000000001002',
        workspaceA,
        observationSessionId,
        'b'.repeat(64),
      ),
    env.DB
      .prepare(
        `INSERT INTO observation_events (
           id, workspace_id, session_id, sequence, event_type, target_id,
           client_offset_ms, created_at
         ) VALUES (?, ?, ?, 1, 'focusin', 'cancel-button', 10, 101)`,
      )
      .bind(
        '00000000-0000-4000-8000-000000001003',
        workspaceA,
        observationSessionId,
      ),
    env.DB
      .prepare(
        `INSERT INTO precedent_records (
           id, workspace_id, record_key, dataset_version, scope_kind, scope_key,
           behavior, normalized_outcome_key, status, valid_from, rationale,
           tags_json, provenance_kind, provenance_ref, created_at
         ) VALUES (?, ?, 'D001', 'fcs-precedent-v2', 'use_case',
           'delete-account', 'initial-focus', 'cancel-button', 'active', 0,
           'Cancel is the reversible initial focus.', '["synthetic"]',
           'synthetic-seed', 'D001', 100)`,
      )
      .bind(precedentA, workspaceA),
    env.DB
      .prepare(
        `INSERT INTO precedent_records (
           id, workspace_id, record_key, dataset_version, scope_kind, scope_key,
           behavior, normalized_outcome_key, status, valid_from, rationale,
           tags_json, provenance_kind, provenance_ref, created_at
         ) VALUES (?, ?, 'D002', 'fcs-precedent-v2', 'use_case',
           'delete-account', 'initial-focus', 'cancel-button', 'active', 0,
           'Second synthetic lineage record.', '["synthetic"]',
           'synthetic-seed', 'D002', 101)`,
      )
      .bind(precedentB, workspaceA),
    env.DB
      .prepare(
        `INSERT INTO precedent_subject_edges (
           id, workspace_id, record_id, target_kind, target_key, edge_type, weight
         ) VALUES (?, ?, ?, 'variant', 'delete-account-standard',
           'applies-to', 1000)`,
      )
      .bind(
        '00000000-0000-4000-8000-000000001103',
        workspaceA,
        precedentA,
      ),
    env.DB
      .prepare(
        `INSERT INTO precedent_lineage (
           id, workspace_id, from_record_id, to_record_id, relationship, created_at
         ) VALUES (?, ?, ?, ?, 'confirms', 102)`,
      )
      .bind(
        '00000000-0000-4000-8000-000000001104',
        workspaceA,
        precedentA,
        precedentB,
      ),
    env.DB
      .prepare(
        `INSERT INTO retrieval_queries (
           id, workspace_id, proposal_id, variant_id, implemented_revision,
           raw_context_json, validated_context_json, query_text,
           algorithm_version, prefilter_version, dataset_version,
           token_issued_at, as_of, context_digest, result_digest, created_at
         ) VALUES (?, ?, ?, ?, 1, '{}', '{}', 'initial focus',
           'fcs-rrf-v2', 'fcs-eligibility-v2', 'fcs-precedent-v2',
           100, 100, ?, ?, 100)`,
      )
      .bind(
        queryId,
        workspaceA,
        proposalId,
        variantA,
        'c'.repeat(64),
        'e'.repeat(64),
      ),
    env.DB
      .prepare(
        `INSERT INTO proposals (
           id, workspace_id, variant_id, base_implemented_revision,
           configuration_json, evidence_query_id, evidence_record_ids_json,
           support_map_json, summary, author_kind, proposal_json,
           proposal_hash, status, created_at
         ) VALUES (?, ?, ?, 1, ?, ?, '["D001"]',
           '{"initialFocus":"D001"}', 'Focus Cancel first', 'agent', '{}',
           ?, 'proposed', 100)`,
      )
      .bind(
        proposalId,
        workspaceA,
        variantA,
        cancelConfigurationJson,
        queryId,
        proposalHash,
      ),
    env.DB
      .prepare(
        `INSERT INTO retrieval_results (
           id, workspace_id, query_id, record_id, eligibility_reason,
           lexical_rank, structured_rank, relationship_rank,
           lexical_contribution, structured_contribution,
           relationship_contribution, structured_score, relationship_tier,
           rrf_score, result_order, disposition
         ) VALUES (?, ?, ?, ?, 'exact use-case match', 1, 1, 1,
           '0.016', '0.016', '0.016', 1000, 1, '0.048', 1, 'support')`,
      )
      .bind(resultId, workspaceA, queryId, precedentA),
    env.DB
      .prepare(
        `INSERT INTO proposal_evidence (
           id, workspace_id, proposal_id, query_id, record_id, changed_field,
           behavior, normalized_outcome_key, created_at
         ) VALUES (?, ?, ?, ?, ?, 'initialFocus', 'initial-focus',
           'cancel-button', 101)`,
      )
      .bind(
        '00000000-0000-4000-8000-000000001204',
        workspaceA,
        proposalId,
        queryId,
        precedentA,
      ),
    env.DB
      .prepare(
        `INSERT INTO review_decisions (
           id, workspace_id, proposal_id, observation_session_id, action,
           proposal_hash, base_implemented_revision, reviewer_kind,
           reviewer_subject_digest, created_at
         ) VALUES (?, ?, ?, ?, 'approve', ?, 1, 'ui-mediated', ?, 102)`,
      )
      .bind(
        '00000000-0000-4000-8000-000000001205',
        workspaceA,
        proposalId,
        observationSessionId,
        proposalHash,
        'f'.repeat(64),
      ),
    env.DB
      .prepare(
        `INSERT INTO application_guards (
           id, workspace_id, variant_id, proposal_id, from_revision,
           to_revision, proposal_hash, idempotency_key, created_at
         ) VALUES (?, ?, ?, ?, 1, 2, ?, 'complete-graph-apply', 103)`,
      )
      .bind(guardId, workspaceA, variantA, proposalId, proposalHash),
    env.DB
      .prepare(
        `INSERT INTO application_receipts (
           id, workspace_id, guard_id, proposal_id, proposal_hash,
           from_revision, to_revision, idempotency_key, result, created_at
         ) VALUES (?, ?, ?, ?, ?, 1, 2, 'complete-graph-apply',
           'applied', 104)`,
      )
      .bind(receiptId, workspaceA, guardId, proposalId, proposalHash),
    env.DB
      .prepare(
        `INSERT INTO implemented_focus_revisions (
           id, workspace_id, variant_id, revision, configuration_json,
           configuration_hash, parent_revision, source_proposal_id,
           source_receipt_id, created_at
         ) VALUES (?, ?, ?, 2, ?, ?, 1, ?, ?, 106)`,
      )
      .bind(
        '00000000-0000-4000-8000-000000001209',
        workspaceA,
        variantA,
        cancelConfigurationJson,
        cancelConfigurationHash,
        proposalId,
        receiptId,
      ),
    env.DB
      .prepare(
        `UPDATE component_variants SET active_implemented_revision = 2
          WHERE workspace_id = ? AND id = ?`,
      )
      .bind(workspaceA, variantA),
    env.DB
      .prepare(`UPDATE proposals SET status = 'approved' WHERE id = ?`)
      .bind(proposalId),
    env.DB
      .prepare(`UPDATE proposals SET status = 'applied' WHERE id = ?`)
      .bind(proposalId),
    env.DB
      .prepare(
        `INSERT INTO idempotency_records (
           id, workspace_id, operation, idempotency_key, request_hash, state,
           result_kind, result_id, created_at, expires_at
         ) VALUES (?, ?, 'apply', 'complete-graph-apply-record', ?,
           'committed', 'application', ?, 106, 206)`,
      )
      .bind(
        '00000000-0000-4000-8000-000000001215',
        workspaceA,
        '6'.repeat(64),
        receiptId,
      ),
    env.DB
      .prepare(
        `INSERT INTO audit_events (
           id, workspace_id, actor_kind, action, target_kind, target_id,
           result, correlation_id, safe_detail_json, occurred_at
         ) VALUES (?, ?, 'system', 'application.applied', 'receipt', ?,
           'success', 'application-correlation', '{}', 106)`,
      )
      .bind(
        '00000000-0000-4000-8000-000000001216',
        workspaceA,
        receiptId,
      ),
    env.DB
      .prepare(
        `INSERT INTO application_commits (
           id, workspace_id, guard_id, receipt_id, created_at
         ) VALUES (?, ?, ?, ?, 106)`,
      )
      .bind(
        '00000000-0000-4000-8000-000000001208',
        workspaceA,
        guardId,
        receiptId,
      ),
    env.DB
      .prepare(
        `INSERT INTO verification_receipts (
           id, workspace_id, observation_session_id, variant_id,
           implemented_revision, verifier_version, result, event_digest,
           manifest_digest, active_at_verification, created_at
         ) VALUES (?, ?, ?, ?, 1, 'package1-proof', 'pass', ?, ?, 0, 107)`,
      )
      .bind(
        '00000000-0000-4000-8000-000000001210',
        workspaceA,
        observationSessionId,
        variantA,
        '2'.repeat(64),
        '3'.repeat(64),
      ),
    env.DB
      .prepare(
        `INSERT INTO verification_checks (
           id, workspace_id, verification_receipt_id, behavior, result,
           evidence_sequences_json
         ) VALUES (?, ?, ?, 'initial-focus', 'pass', '[1]')`,
      )
      .bind(
        '00000000-0000-4000-8000-000000001211',
        workspaceA,
        '00000000-0000-4000-8000-000000001210',
      ),
    env.DB
      .prepare(
        `INSERT INTO idempotency_records (
           id, workspace_id, operation, idempotency_key, request_hash, state,
           result_kind, result_id, created_at, expires_at
         ) VALUES (?, ?, 'create_proposal', 'complete-graph-create', ?,
           'committed', 'proposal', ?, 100, 200)`,
      )
      .bind(
        '00000000-0000-4000-8000-000000001212',
        workspaceA,
        '4'.repeat(64),
        proposalId,
      ),
    env.DB
      .prepare(
        `INSERT INTO audit_events (
           id, workspace_id, actor_kind, action, target_kind, target_id,
           result, correlation_id, safe_detail_json, occurred_at
         ) VALUES (?, ?, 'system', 'complete_graph', 'workspace', ?,
           'success', 'complete-graph-correlation', '{}', 108)`,
      )
      .bind(
        '00000000-0000-4000-8000-000000001213',
        workspaceA,
        workspaceA,
      ),
    env.DB
      .prepare(
        `INSERT INTO rate_limit_windows (
           id, workspace_id, key_digest, operation, window_start,
           window_seconds, request_count, expires_at
         ) VALUES (?, ?, ?, 'complete_graph', 100, 60, 1, 200)`,
      )
      .bind(
        '00000000-0000-4000-8000-000000001214',
        workspaceA,
        '5'.repeat(64),
      ),
  ]);

  const guardedChildren = [
    'component_variants',
    'workspace_view_state',
    'implemented_focus_revisions',
    'observation_sessions',
    'rendered_manifests',
    'observation_events',
    'precedent_records',
    'precedent_subject_edges',
    'precedent_lineage',
    'retrieval_queries',
    'retrieval_results',
    'proposals',
    'proposal_evidence',
    'review_decisions',
    'application_guards',
    'application_receipts',
    'application_commits',
    'verification_receipts',
    'verification_checks',
    'idempotency_records',
    'audit_events',
  ] as const;
  for (const table of guardedChildren) {
    await expect(
      env.DB.prepare(`DELETE FROM ${table} WHERE workspace_id = ?`)
        .bind(workspaceA)
        .run(),
    ).rejects.toThrow(/IMMUTABLE/u);
  }

  await env.DB.prepare(`DELETE FROM workspaces WHERE id = ?`)
    .bind(workspaceA)
    .run();
  const allTables = [
    'workspaces',
    ...guardedChildren,
    'rate_limit_windows',
  ] as const;
  expect(new Set(allTables).size).toBe(23);
  for (const table of allTables) {
    expect(
      await env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first(),
      table,
    ).toEqual({ count: 0 });
  }
});
