import {
  canonicalProposalDocument,
  canonicalProposalRequest,
  changedFocusFields,
  createProposalInputSchema,
  normalizeProposalSummary,
  proposalDocumentHash,
  supportRequirementForField,
  type CreateProposalInput,
  type FieldEvidenceSupport,
} from '../domain/proposal';
import { canonicalFocusConfiguration } from '../domain/focus-configuration';
import {
  resolveActiveReviewSnapshot,
  WEBMCP_CONTRACT_VERSION,
} from './active-focus-review';
import { deterministicUuid, sha256Hex } from './crypto';
import {
  parseEvidenceTokenIssuedAt,
  verifyEvidenceToken,
} from './evidence-token';
import { FcsError } from './errors';
import { resolveWorkspaceEvidenceSession } from './workspaces';

type IdempotencyRow = {
  request_hash: string;
  state: 'started' | 'committed';
  result_id: string | null;
};

type ProposalRow = {
  id: string;
  proposal_hash: string;
  proposal_json: string;
};

export type CreateProposalResult = {
  ok: true;
  contractVersion: typeof WEBMCP_CONTRACT_VERSION;
  proposal: {
    proposalId: string;
    baseImplementedRevision: number;
    proposalDigest8: string;
    changedFields: string[];
    fieldEvidence: Array<{
      field: string;
      recordId: string;
      outcomeKey: string;
    }>;
    status: 'proposed';
    applied: false;
    label: 'NOT APPLIED';
    createdAt: string;
    proposalDigest: string;
    configuration: CreateProposalInput['configuration'];
    summary: string;
    authorKind: 'agent';
    parentProposalId: null;
  };
};

function invalidInput(): FcsError {
  return new FcsError('INVALID_INPUT', 'The proposal input is invalid.', 400);
}

function evidenceNotEligible(): FcsError {
  return new FcsError(
    'EVIDENCE_NOT_ELIGIBLE',
    'The supplied evidence is not eligible.',
    409,
  );
}

function supportRequired(): FcsError {
  return new FcsError(
    'EVIDENCE_REQUIRED_FOR_AGENT_CHANGE',
    'Each changed field requires eligible cited evidence.',
    409,
  );
}

async function idempotencyRecord(
  db: D1Database,
  workspaceId: string,
  idempotencyKey: string,
): Promise<IdempotencyRow | null> {
  return db
    .prepare(
      `SELECT request_hash, state, result_id
         FROM idempotency_records
        WHERE workspace_id = ? AND operation = 'create_proposal'
          AND idempotency_key = ?`,
    )
    .bind(workspaceId, idempotencyKey)
    .first<IdempotencyRow>();
}

async function proposalRow(
  db: D1Database,
  workspaceId: string,
  proposalId: string,
): Promise<ProposalRow> {
  const row = await db
    .prepare(
      `SELECT id, proposal_hash, proposal_json
         FROM proposals WHERE workspace_id = ? AND id = ?`,
    )
    .bind(workspaceId, proposalId)
    .first<ProposalRow>();
  if (!row) throw new Error('Committed proposal is unavailable.');
  return row;
}

function publicResult(row: ProposalRow): CreateProposalResult {
  const document = JSON.parse(row.proposal_json) as {
    baseImplementedRevision: number;
    fieldEvidence: FieldEvidenceSupport[];
    createdAt: string;
    configuration: CreateProposalInput['configuration'];
    summary: string;
  };
  if (
    !Number.isSafeInteger(document.baseImplementedRevision) ||
    !Array.isArray(document.fieldEvidence) ||
    typeof document.createdAt !== 'string'
  ) {
    throw new Error('Committed proposal receipt is malformed.');
  }
  return {
    ok: true,
    contractVersion: WEBMCP_CONTRACT_VERSION,
    proposal: {
      proposalId: row.id,
      baseImplementedRevision: document.baseImplementedRevision,
      proposalDigest8: row.proposal_hash.slice(0, 8),
      changedFields: document.fieldEvidence.map(({ field }) => field),
      fieldEvidence: document.fieldEvidence.map((entry) => ({
        field: entry.field,
        recordId: entry.recordId,
        outcomeKey: entry.normalizedOutcomeKey,
      })),
      status: 'proposed',
      applied: false,
      label: 'NOT APPLIED',
      createdAt: document.createdAt,
      proposalDigest: row.proposal_hash,
      configuration: document.configuration,
      summary: document.summary,
      authorKind: 'agent',
      parentProposalId: null,
    },
  };
}

async function recoverExisting(
  db: D1Database,
  workspaceId: string,
  idempotencyKey: string,
  requestHash: string,
): Promise<CreateProposalResult | null> {
  const existing = await idempotencyRecord(
    db,
    workspaceId,
    idempotencyKey,
  );
  if (!existing) return null;
  if (existing.request_hash !== requestHash) {
    throw new FcsError(
      'IDEMPOTENCY_CONFLICT',
      'The request key was already used.',
      409,
    );
  }
  if (existing.state !== 'committed' || !existing.result_id) {
    throw new FcsError(
      'PROPOSAL_IN_PROGRESS',
      'The proposal is still being committed.',
      409,
      true,
    );
  }
  return publicResult(
    await proposalRow(db, workspaceId, existing.result_id),
  );
}

function contribution(rank: number | null): string {
  return rank === null ? '0.000000000000' : (1 / (60 + rank)).toFixed(12);
}

function assertBatch(results: D1Result[], expectedChanges: number[]): void {
  if (
    results.length !== expectedChanges.length ||
    results.some(
      (result, index) =>
        !result.success || result.meta.changes !== expectedChanges[index],
    )
  ) {
    throw new Error('The proposal batch returned unexpected row counts.');
  }
}

export async function createProposal(input: {
  db: D1Database;
  cookieHeader: string | null;
  now: number;
  sessionSecret: string;
  admitOperation?: (workspaceId: string) => Promise<void>;
  input: unknown;
}): Promise<CreateProposalResult> {
  const parsed = createProposalInputSchema.safeParse(input.input);
  if (!parsed.success || !Number.isSafeInteger(input.now) || input.now < 0) {
    throw invalidInput();
  }
  let value: CreateProposalInput;
  let requestJson: string;
  try {
    value = {
      ...parsed.data,
      summary: normalizeProposalSummary(parsed.data.summary),
    };
    requestJson = canonicalProposalRequest(value);
  } catch {
    throw invalidInput();
  }
  const requestHash = await sha256Hex(requestJson);
  const resolved = await resolveWorkspaceEvidenceSession({
    db: input.db,
    cookieHeader: input.cookieHeader,
    now: input.now,
    sessionSecret: input.sessionSecret,
  });
  const recovered = await recoverExisting(
    input.db,
    resolved.workspace.id,
    value.idempotencyKey,
    requestHash,
  );
  if (recovered) return recovered;
  await input.admitOperation?.(resolved.workspace.id);

  const issuedAt = parseEvidenceTokenIssuedAt(
    value.evidenceQueryToken,
    input.now,
  );
  const snapshot = await resolveActiveReviewSnapshot({
    db: input.db,
    cookieHeader: input.cookieHeader,
    now: input.now,
    asOf: issuedAt,
    sessionSecret: input.sessionSecret,
  });
  if (value.baseImplementedRevision !== snapshot.implementedRevision) {
    throw new FcsError(
      'STALE_REVISION',
      'The implemented revision changed.',
      409,
    );
  }
  await verifyEvidenceToken(value.evidenceQueryToken, {
    sessionToken: snapshot.sessionToken,
    now: input.now,
    workspaceId: snapshot.workspaceId,
    variantId: snapshot.variantId,
    implementedRevision: snapshot.implementedRevision,
    contextDigest: snapshot.contextDigest,
    resultDigest: snapshot.resultDigest,
  });
  const displayed = snapshot.retrieval.returned.slice(0, 3);
  if (snapshot.retrieval.disposition === 'conflict') {
    throw new FcsError(
      'RETRIEVAL_CONFLICT',
      'Eligible precedent has an unresolved exact-scope conflict.',
      409,
    );
  }
  const changedFields = changedFocusFields(
    snapshot.implemented,
    value.configuration,
  );
  if (changedFields.length === 0) throw invalidInput();
  if (snapshot.retrieval.disposition !== 'results') throw supportRequired();
  const displayedIds = new Set(displayed.map(({ id }) => id));
  if (value.evidenceRecordIds.some((recordId) => !displayedIds.has(recordId))) {
    throw evidenceNotEligible();
  }

  const citations = displayed
    .filter(({ id }) => value.evidenceRecordIds.includes(id))
    .map(({ id }) => id);
  const fieldEvidence: FieldEvidenceSupport[] = [];
  for (const field of changedFields) {
    const required = supportRequirementForField(field, value.configuration);
    const record = displayed.find(
      (candidate) =>
        citations.includes(candidate.id) &&
        candidate.behavior === required.behavior &&
        candidate.outcomeKey === required.normalizedOutcomeKey,
    );
    if (!record) throw supportRequired();
    fieldEvidence.push({
      field,
      recordId: record.id,
      behavior: required.behavior,
      normalizedOutcomeKey: required.normalizedOutcomeKey,
    });
  }

  const databaseIds = new Map(
    snapshot.loadedPrecedents.map(({ databaseRecordId, record }) => [
      record.id,
      databaseRecordId,
    ]),
  );
  if (displayed.some(({ id }) => !databaseIds.has(id))) {
    throw evidenceNotEligible();
  }
  const idempotencyId = crypto.randomUUID();
  const queryId = crypto.randomUUID();
  const proposalId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const correlationId = crypto.randomUUID();
  const configurationJson = canonicalFocusConfiguration(value.configuration);
  const supportMapJson = JSON.stringify(
    Object.fromEntries(
      fieldEvidence.map((entry) => [entry.field, entry.recordId]),
    ),
  );
  const proposalJson = canonicalProposalDocument({
    variantId: snapshot.variantId,
    baseImplementedRevision: value.baseImplementedRevision,
    configuration: value.configuration,
    evidenceQueryId: queryId,
    evidenceRecordIds: citations,
    fieldEvidence,
    summary: value.summary,
    createdAt: input.now,
  });
  const proposalHash = await proposalDocumentHash(proposalJson);

  const statements: D1PreparedStatement[] = [
    input.db
      .prepare(
        `INSERT INTO idempotency_records (
           id, workspace_id, operation, idempotency_key, request_hash,
           state, created_at, expires_at
         )
         SELECT ?, w.id, 'create_proposal', ?, ?, 'started', ?, ?
           FROM workspaces w
           JOIN workspace_view_state s ON s.workspace_id = w.id
           JOIN component_variants v
             ON v.workspace_id = s.workspace_id AND v.id = s.active_variant_id
          WHERE w.id = ? AND w.purged_at IS NULL AND w.access_expires_at >= ?
            AND v.id = ? AND v.active_implemented_revision = ?
            AND NOT EXISTS (
              SELECT 1 FROM idempotency_records i
               WHERE i.workspace_id = w.id AND i.operation = 'create_proposal'
                 AND i.idempotency_key = ?
            )`,
      )
      .bind(
        idempotencyId,
        value.idempotencyKey,
        requestHash,
        input.now,
        input.now + 3_600,
        snapshot.workspaceId,
        input.now,
        snapshot.variantId,
        snapshot.implementedRevision,
        value.idempotencyKey,
      ),
    input.db
      .prepare(
        `INSERT INTO retrieval_queries (
           id, workspace_id, proposal_id, variant_id, implemented_revision,
           raw_context_json, validated_context_json, query_text,
           algorithm_version, prefilter_version, dataset_version,
           token_issued_at, as_of, context_digest, result_digest, created_at
         )
         SELECT ?, i.workspace_id, ?, ?, ?, ?, ?, ?,
                'fcs-rrf-v2', 'fcs-eligibility-v2', 'fcs-precedent-v2',
                ?, ?, ?, ?, ?
           FROM idempotency_records i
          WHERE i.id = ? AND i.workspace_id = ?
            AND i.operation = 'create_proposal' AND i.state = 'started'`,
      )
      .bind(
        queryId,
        proposalId,
        snapshot.variantId,
        snapshot.implementedRevision,
        snapshot.canonicalContext,
        snapshot.canonicalContext,
        snapshot.context.queryText,
        issuedAt,
        issuedAt,
        snapshot.contextDigest,
        snapshot.resultDigest,
        input.now,
        idempotencyId,
        snapshot.workspaceId,
      ),
  ];

  const expectedChanges = [1, 1];
  for (let index = 0; index < displayed.length; index += 1) {
    const record = displayed[index]!;
    statements.push(
      input.db
        .prepare(
          `INSERT INTO retrieval_results (
             id, workspace_id, query_id, record_id, eligibility_reason,
             lexical_rank, structured_rank, relationship_rank,
             lexical_contribution, structured_contribution,
             relationship_contribution, structured_score, relationship_tier,
             rrf_score, result_order, disposition
           )
           SELECT ?, i.workspace_id, ?, ?, 'focus-eligibility-v2:stage0',
                  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'support'
             FROM idempotency_records i
            WHERE i.id = ? AND i.workspace_id = ?
              AND i.operation = 'create_proposal' AND i.state = 'started'`,
        )
        .bind(
          await deterministicUuid(
            `fcs-retrieval-result-v1:${proposalId}:${record.id}`,
          ),
          queryId,
          databaseIds.get(record.id),
          record.lexicalRank,
          record.structuredRank,
          record.relationshipRank,
          contribution(record.lexicalRank),
          contribution(record.structuredRank),
          contribution(record.relationshipRank),
          record.structuredScore,
          record.relationshipTier,
          record.rrfDisplay,
          index + 1,
          idempotencyId,
          snapshot.workspaceId,
        ),
    );
    expectedChanges.push(1);
  }
  statements.push(
    input.db
      .prepare(
        `INSERT INTO proposals (
           id, workspace_id, variant_id, base_implemented_revision,
           configuration_json, evidence_query_id, evidence_record_ids_json,
           support_map_json, summary, author_kind, proposal_json,
           proposal_hash, parent_proposal_id, status, created_at
         )
         SELECT ?, i.workspace_id, ?, ?, ?, ?, ?, ?, ?, 'agent', ?, ?,
                NULL, 'proposed', ?
           FROM idempotency_records i
           JOIN retrieval_queries q
             ON q.workspace_id = i.workspace_id AND q.id = ? AND q.proposal_id = ?
          WHERE i.id = ? AND i.workspace_id = ?
            AND i.operation = 'create_proposal' AND i.state = 'started'`,
      )
      .bind(
        proposalId,
        snapshot.variantId,
        snapshot.implementedRevision,
        configurationJson,
        queryId,
        JSON.stringify(citations),
        supportMapJson,
        value.summary,
        proposalJson,
        proposalHash,
        input.now,
        queryId,
        proposalId,
        idempotencyId,
        snapshot.workspaceId,
      ),
  );
  expectedChanges.push(1);
  for (const evidence of fieldEvidence) {
    const recordId = databaseIds.get(evidence.recordId);
    statements.push(
      input.db
        .prepare(
          `INSERT INTO proposal_evidence (
             id, workspace_id, proposal_id, query_id, record_id,
             changed_field, behavior, normalized_outcome_key, created_at
           )
           SELECT ?, i.workspace_id, ?, ?, ?, ?, ?, ?, ?
             FROM idempotency_records i
             JOIN proposals p
               ON p.workspace_id = i.workspace_id AND p.id = ?
            WHERE i.id = ? AND i.workspace_id = ?
              AND i.operation = 'create_proposal' AND i.state = 'started'`,
        )
        .bind(
          await deterministicUuid(
            `fcs-proposal-evidence-v1:${proposalId}:${evidence.field}:${evidence.recordId}`,
          ),
          proposalId,
          queryId,
          recordId,
          evidence.field,
          evidence.behavior,
          evidence.normalizedOutcomeKey,
          input.now,
          proposalId,
          idempotencyId,
          snapshot.workspaceId,
        ),
    );
    expectedChanges.push(1);
  }
  statements.push(
    input.db
      .prepare(
        `UPDATE idempotency_records
            SET state = 'committed', result_kind = 'proposal', result_id = ?
          WHERE id = ? AND workspace_id = ?
            AND operation = 'create_proposal' AND state = 'started'
            AND EXISTS (
              SELECT 1 FROM proposals p
               WHERE p.workspace_id = idempotency_records.workspace_id
                 AND p.id = ? AND p.evidence_query_id = ?
            )
            AND (SELECT COUNT(*) FROM retrieval_results r
                  WHERE r.workspace_id = idempotency_records.workspace_id
                    AND r.query_id = ?) = ?
            AND (SELECT COUNT(*) FROM proposal_evidence e
                  WHERE e.workspace_id = idempotency_records.workspace_id
                    AND e.proposal_id = ?) = ?`,
      )
      .bind(
        proposalId,
        idempotencyId,
        snapshot.workspaceId,
        proposalId,
        queryId,
        queryId,
        displayed.length,
        proposalId,
        fieldEvidence.length,
      ),
    input.db
      .prepare(
        `INSERT INTO audit_events (
           id, workspace_id, actor_kind, action, target_kind, target_id,
           result, correlation_id, safe_detail_json, occurred_at
         ) VALUES (?, ?, 'agent', 'proposal.created', 'proposal', ?,
                   'success', ?, '{"status":"proposed","applied":false}', ?)`,
      )
      .bind(
        auditId,
        snapshot.workspaceId,
        proposalId,
        correlationId,
        input.now,
      ),
  );
  expectedChanges.push(1, 1);

  try {
    const results = await input.db.batch(statements);
    assertBatch(results, expectedChanges);
  } catch {
    const raced = await recoverExisting(
      input.db,
      snapshot.workspaceId,
      value.idempotencyKey,
      requestHash,
    );
    if (raced) return raced;
    const current = await input.db
      .prepare(
        `SELECT v.id, v.active_implemented_revision
           FROM workspace_view_state s
           JOIN component_variants v
             ON v.workspace_id = s.workspace_id AND v.id = s.active_variant_id
          WHERE s.workspace_id = ?`,
      )
      .bind(snapshot.workspaceId)
      .first<{ id: string; active_implemented_revision: number }>();
    if (
      !current ||
      current.id !== snapshot.variantId ||
      current.active_implemented_revision !== snapshot.implementedRevision
    ) {
      throw new FcsError(
        'STALE_REVISION',
        'The implemented revision changed.',
        409,
      );
    }
    throw new FcsError(
      'PROPOSAL_WRITE_FAILED',
      'The proposal could not be committed.',
      503,
      true,
    );
  }
  return publicResult(
    await proposalRow(input.db, snapshot.workspaceId, proposalId),
  );
}
