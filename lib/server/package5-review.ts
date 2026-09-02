import {
  canonicalPackage5Request,
  reviewerProposalRequestSchema,
  reviewRequestSchema,
  transitionProposal,
  type ReviewRequest,
  type ReviewerProposalRequest,
} from '../domain/package5.ts';
import {
  canonicalProposalDocument,
  normalizeProposalSummary,
  proposalDocumentHash,
} from '../domain/proposal.ts';
import { canonicalFocusConfiguration } from '../domain/focus-configuration.ts';
import { assertExactBatch } from '../domain/package5.ts';
import { sha256Hex } from './crypto.ts';
import { FcsError, rethrowRateLimitError } from './errors.ts';
import { resolveActiveReviewSnapshot } from './active-focus-review.ts';
import { resolveWorkspaceEvidenceSession } from './workspaces.ts';

type ProposalRow = {
  id: string;
  variant_id: string;
  base_implemented_revision: number;
  configuration_json: string;
  evidence_query_id: string;
  evidence_record_ids_json: string;
  support_map_json: string;
  proposal_json: string;
  proposal_hash: string;
  status: 'proposed' | 'approved' | 'rejected' | 'revoked' | 'superseded' | 'applied' | 'stale';
};

type IdempotencyRow = {
  request_hash: string;
  state: 'started' | 'committed';
  result_kind: string | null;
  result_id: string | null;
};

export type ReviewProposalResult = {
  ok: true;
  review: {
    action: ReviewRequest['action'];
    proposalId: string;
    resultId: string;
    status: ProposalRow['status'];
    proposalDigest8: string;
    baseImplementedRevision: number;
    replayed: boolean;
  };
};

export type CreateReviewerProposalResult = {
  ok: true;
  review: {
    action: 'create';
    proposalId: string;
    resultId: string;
    status: 'proposed';
    proposalDigest8: string;
    baseImplementedRevision: number;
    replayed: boolean;
  };
};

function notFound(): FcsError {
  return new FcsError('PROPOSAL_NOT_FOUND', 'The proposal is unavailable.', 404);
}

async function proposal(
  db: D1Database,
  workspaceId: string,
  proposalId: string,
): Promise<ProposalRow | null> {
  return db.prepare(
    `SELECT id, variant_id, base_implemented_revision, configuration_json,
            evidence_query_id, evidence_record_ids_json, support_map_json,
            proposal_json, proposal_hash, status
       FROM proposals WHERE workspace_id = ? AND id = ?`,
  ).bind(workspaceId, proposalId).first<ProposalRow>();
}

function publicResult(
  action: ReviewRequest['action'],
  row: ProposalRow,
  resultId: string,
  replayed: boolean,
): ReviewProposalResult {
  return {
    ok: true,
    review: {
      action,
      proposalId: row.id,
      resultId,
      status: row.status,
      proposalDigest8: row.proposal_hash.slice(0, 8),
      baseImplementedRevision: row.base_implemented_revision,
      replayed,
    },
  };
}

async function recover(
  db: D1Database,
  workspaceId: string,
  proposalId: string,
  request: ReviewRequest,
  requestHash: string,
): Promise<ReviewProposalResult | null> {
  const operation = request.action === 'edit' ? 'create_proposal' : `review_${request.action}`;
  const existing = await db.prepare(
    `SELECT request_hash, state, result_kind, result_id
       FROM idempotency_records
      WHERE workspace_id = ? AND operation = ? AND idempotency_key = ?`,
  ).bind(workspaceId, operation, request.idempotencyKey).first<IdempotencyRow>();
  if (!existing) return null;
  if (existing.request_hash !== requestHash) {
    throw new FcsError('IDEMPOTENCY_CONFLICT', 'The request key was already used.', 409);
  }
  if (existing.state !== 'committed' || !existing.result_id) {
    throw new FcsError('REVIEW_IN_PROGRESS', 'The review is still being committed.', 409, true);
  }
  const resultProposal = await proposal(
    db,
    workspaceId,
    request.action === 'edit' ? existing.result_id : proposalId,
  );
  if (!resultProposal) throw new Error('Committed review result is unavailable.');
  return publicResult(request.action, resultProposal, existing.result_id, true);
}

async function editProposal(input: {
  db: D1Database;
  workspaceId: string;
  parent: ProposalRow;
  request: Extract<ReviewRequest, { action: 'edit' }>;
  requestHash: string;
  reviewerDigest: string;
  pageSessionId: string;
  now: number;
}): Promise<ReviewProposalResult> {
  const configurationJson = canonicalFocusConfiguration(input.request.configuration);
  if (configurationJson === input.parent.configuration_json) {
    throw new FcsError('INVALID_INPUT', 'The edited proposal is unchanged.', 400);
  }
  const childId = crypto.randomUUID();
  const idempotencyId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const commitId = crypto.randomUUID();
  const summary = normalizeProposalSummary(input.request.summary);
  const document = canonicalProposalDocument({
    variantId: input.parent.variant_id,
    baseImplementedRevision: input.parent.base_implemented_revision,
    configuration: input.request.configuration,
    evidenceQueryId: input.parent.evidence_query_id,
    evidenceRecordIds: [],
    fieldEvidence: [],
    summary,
    createdAt: input.now,
    authorKind: 'reviewer',
    pageSessionId: input.pageSessionId,
  });
  const hash = await proposalDocumentHash(document);
  const statements: D1PreparedStatement[] = [
    input.db.prepare(
      `INSERT INTO idempotency_records (
         id, workspace_id, operation, idempotency_key, request_hash,
         state, created_at, expires_at
       )
       SELECT ?, p.workspace_id, 'create_proposal', ?, ?, 'started', ?, ?
         FROM proposals p
         JOIN component_variants v
           ON v.workspace_id = p.workspace_id AND v.id = p.variant_id
          AND v.active_implemented_revision = p.base_implemented_revision
         JOIN observation_sessions s
           ON s.workspace_id = p.workspace_id AND s.id = ?
          AND s.variant_id = p.variant_id
          AND s.implemented_revision = p.base_implemented_revision
          AND s.state IN ('finalized', 'verified_pass', 'verified_fail')
        WHERE p.workspace_id = ? AND p.id = ? AND p.status = 'proposed'
          AND p.proposal_hash = ? AND p.base_implemented_revision = ?
          AND NOT EXISTS (
            SELECT 1 FROM idempotency_records i
             WHERE i.workspace_id = p.workspace_id
               AND i.operation = 'create_proposal' AND i.idempotency_key = ?
          )`,
    ).bind(
      idempotencyId,
      input.request.idempotencyKey,
      input.requestHash,
      input.now,
      input.now + 3_600,
      input.pageSessionId,
      input.workspaceId,
      input.parent.id,
      input.parent.proposal_hash,
      input.parent.base_implemented_revision,
      input.request.idempotencyKey,
    ),
    input.db.prepare(
      `INSERT INTO proposals (
         id, workspace_id, variant_id, base_implemented_revision,
         configuration_json, evidence_query_id, evidence_record_ids_json,
         support_map_json, summary, author_kind, proposal_json, proposal_hash,
         parent_proposal_id, status, created_at
       )
       SELECT ?, i.workspace_id, p.variant_id, p.base_implemented_revision,
              ?, p.evidence_query_id, '[]',
              '{}', ?, 'reviewer', ?, ?, p.id, 'proposed', ?
         FROM idempotency_records i
         JOIN proposals p ON p.workspace_id = i.workspace_id AND p.id = ?
        WHERE i.id = ? AND i.workspace_id = ?
          AND i.operation = 'create_proposal' AND i.state = 'started'`,
    ).bind(childId, configurationJson, summary, document, hash, input.now,
      input.parent.id, idempotencyId, input.workspaceId),
    input.db.prepare(
      `UPDATE proposals SET status = 'superseded'
        WHERE workspace_id = ? AND id = ? AND status = 'proposed'
          AND EXISTS (SELECT 1 FROM proposals child
                       WHERE child.workspace_id = proposals.workspace_id
                         AND child.id = ? AND child.parent_proposal_id = proposals.id)`,
    ).bind(input.workspaceId, input.parent.id, childId),
    input.db.prepare(
      `UPDATE idempotency_records
          SET state = 'committed', result_kind = 'proposal', result_id = ?
        WHERE id = ? AND workspace_id = ? AND operation = 'create_proposal'
          AND state = 'started'
          AND EXISTS (SELECT 1 FROM proposals p
                       WHERE p.workspace_id = idempotency_records.workspace_id
                         AND p.id = ? AND p.status = 'proposed')`,
    ).bind(childId, idempotencyId, input.workspaceId, childId),
    input.db.prepare(
      `INSERT INTO audit_events (
         id, workspace_id, actor_kind, action, target_kind, target_id,
         result, correlation_id, safe_detail_json, occurred_at
       )
       SELECT ?, i.workspace_id, 'reviewer', 'proposal.edited', 'proposal', ?,
              'success', ?, ?, ?
         FROM idempotency_records i
        WHERE i.id = ? AND i.workspace_id = ? AND i.state = 'committed'`,
    ).bind(auditId, childId, commitId,
      JSON.stringify({ parentProposalId: input.parent.id, reviewerDigest: input.reviewerDigest.slice(0, 8) }),
      input.now, idempotencyId, input.workspaceId),
    input.db.prepare(
      `INSERT INTO review_commits (
         id, workspace_id, proposal_id, idempotency_id, decision_id, action, created_at
       ) VALUES (?, ?, ?, ?, NULL, 'edit', ?)`,
    ).bind(commitId, input.workspaceId, childId, idempotencyId, input.now),
  ];
  const expected = [1, 1, 1, 1, 2, 1];
  assertExactBatch(await input.db.batch(statements), expected, 'review edit');
  const child = await proposal(input.db, input.workspaceId, childId);
  if (!child) throw new Error('Committed child proposal is unavailable.');
  return publicResult('edit', child, childId, false);
}

function reviewerProposalResult(
  row: ProposalRow,
  replayed: boolean,
): CreateReviewerProposalResult {
  return {
    ok: true,
    review: {
      action: 'create',
      proposalId: row.id,
      resultId: row.id,
      status: 'proposed',
      proposalDigest8: row.proposal_hash.slice(0, 8),
      baseImplementedRevision: row.base_implemented_revision,
      replayed,
    },
  };
}

export async function createReviewerProposal(input: {
  db: D1Database;
  cookieHeader: string | null;
  now: number;
  sessionSecret: string;
  admitOperation?: (workspaceId: string) => Promise<void>;
  input: unknown;
}): Promise<CreateReviewerProposalResult> {
  const parsed = reviewerProposalRequestSchema.safeParse(input.input);
  if (!parsed.success || !Number.isSafeInteger(input.now) || input.now < 0) {
    throw new FcsError('INVALID_INPUT', 'The reviewer proposal input is invalid.', 400);
  }
  const request: ReviewerProposalRequest = parsed.data;
  const session = await resolveWorkspaceEvidenceSession({
    db: input.db,
    cookieHeader: input.cookieHeader,
    now: input.now,
    sessionSecret: input.sessionSecret,
  });
  const snapshot = await resolveActiveReviewSnapshot({
    db: input.db,
    cookieHeader: input.cookieHeader,
    now: input.now,
    asOf: input.now,
    sessionSecret: input.sessionSecret,
  });
  if (!snapshot.observation) {
    throw new FcsError('REVIEW_STATE_INVALID', 'Run and finalize the visible rehearsal first.', 409);
  }
  const configurationJson = canonicalFocusConfiguration(request.configuration);
  if (configurationJson === canonicalFocusConfiguration(snapshot.implemented)) {
    throw new FcsError('INVALID_INPUT', 'The reviewer proposal is unchanged.', 400);
  }
  const requestHash = await sha256Hex(JSON.stringify({
    variantId: snapshot.variantId,
    baseImplementedRevision: snapshot.implementedRevision,
    pageSessionId: snapshot.observation.session_id,
    request: canonicalPackage5Request('reviewer_proposal', request),
  }));
  const existing = await input.db.prepare(
    `SELECT request_hash, state, result_id FROM idempotency_records
      WHERE workspace_id = ? AND operation = 'create_proposal' AND idempotency_key = ?`,
  ).bind(session.workspace.id, request.idempotencyKey).first<IdempotencyRow>();
  if (existing) {
    if (existing.request_hash !== requestHash) {
      throw new FcsError('IDEMPOTENCY_CONFLICT', 'The request key was already used.', 409);
    }
    if (existing.state !== 'committed' || !existing.result_id) {
      throw new FcsError('PROPOSAL_IN_PROGRESS', 'The proposal is still being committed.', 409, true);
    }
    const recovered = await proposal(input.db, session.workspace.id, existing.result_id);
    if (!recovered) throw new Error('Committed reviewer proposal is unavailable.');
    return reviewerProposalResult(recovered, true);
  }
  await input.admitOperation?.(session.workspace.id);
  const idempotencyId = crypto.randomUUID();
  const queryId = crypto.randomUUID();
  const proposalId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const correlationId = crypto.randomUUID();
  const summary = normalizeProposalSummary(request.summary);
  const document = canonicalProposalDocument({
    variantId: snapshot.variantId,
    baseImplementedRevision: snapshot.implementedRevision,
    configuration: request.configuration,
    evidenceQueryId: queryId,
    evidenceRecordIds: [],
    fieldEvidence: [],
    summary,
    createdAt: input.now,
    authorKind: 'reviewer',
    pageSessionId: snapshot.observation.session_id,
  });
  const proposalHash = await proposalDocumentHash(document);
  const statements = [
    input.db.prepare(
      `INSERT INTO idempotency_records (
         id, workspace_id, operation, idempotency_key, request_hash,
         state, created_at, expires_at
       ) SELECT ?, v.workspace_id, 'create_proposal', ?, ?, 'started', ?, ?
           FROM component_variants v
          WHERE v.workspace_id = ? AND v.id = ? AND v.active_implemented_revision = ?
            AND NOT EXISTS (SELECT 1 FROM idempotency_records i
                             WHERE i.workspace_id = v.workspace_id
                               AND i.operation = 'create_proposal' AND i.idempotency_key = ?)`,
    ).bind(
      idempotencyId, request.idempotencyKey, requestHash, input.now, input.now + 3_600,
      snapshot.workspaceId, snapshot.variantId, snapshot.implementedRevision,
      request.idempotencyKey,
    ),
    input.db.prepare(
      `INSERT INTO retrieval_queries (
         id, workspace_id, proposal_id, variant_id, implemented_revision,
         raw_context_json, validated_context_json, query_text,
         algorithm_version, prefilter_version, dataset_version,
         token_issued_at, as_of, context_digest, result_digest, created_at
       ) SELECT ?, i.workspace_id, ?, ?, ?, ?, ?, ?,
                'fcs-rrf-v2', 'fcs-eligibility-v2', 'fcs-precedent-v2',
                ?, ?, ?, ?, ?
           FROM idempotency_records i
          WHERE i.id = ? AND i.workspace_id = ? AND i.state = 'started'`,
    ).bind(
      queryId, proposalId, snapshot.variantId, snapshot.implementedRevision,
      snapshot.canonicalContext, snapshot.canonicalContext, snapshot.context.queryText,
      input.now, input.now, snapshot.contextDigest, snapshot.resultDigest, input.now,
      idempotencyId, snapshot.workspaceId,
    ),
    input.db.prepare(
      `INSERT INTO proposals (
         id, workspace_id, variant_id, base_implemented_revision,
         configuration_json, evidence_query_id, evidence_record_ids_json,
         support_map_json, summary, author_kind, proposal_json, proposal_hash,
         parent_proposal_id, status, created_at
       ) SELECT ?, i.workspace_id, ?, ?, ?, ?, '[]', '{}', ?, 'reviewer', ?, ?,
                NULL, 'proposed', ?
           FROM idempotency_records i JOIN retrieval_queries q
             ON q.workspace_id = i.workspace_id AND q.id = ? AND q.proposal_id = ?
          WHERE i.id = ? AND i.workspace_id = ? AND i.state = 'started'`,
    ).bind(
      proposalId, snapshot.variantId, snapshot.implementedRevision, configurationJson,
      queryId, summary, document, proposalHash, input.now, queryId, proposalId,
      idempotencyId, snapshot.workspaceId,
    ),
    input.db.prepare(
      `UPDATE idempotency_records SET state = 'committed', result_kind = 'proposal', result_id = ?
        WHERE id = ? AND workspace_id = ? AND operation = 'create_proposal' AND state = 'started'
          AND EXISTS (SELECT 1 FROM proposals p
                       WHERE p.workspace_id = idempotency_records.workspace_id AND p.id = ?)`,
    ).bind(proposalId, idempotencyId, snapshot.workspaceId, proposalId),
    input.db.prepare(
      `INSERT INTO audit_events (
         id, workspace_id, actor_kind, action, target_kind, target_id,
         result, correlation_id, safe_detail_json, occurred_at
       ) SELECT ?, i.workspace_id, 'reviewer', 'proposal.created', 'proposal', ?,
                'success', ?, '{"status":"proposed","novelResponsibilityAccepted":true}', ?
           FROM idempotency_records i
          WHERE i.id = ? AND i.workspace_id = ? AND i.state = 'committed'`,
    ).bind(auditId, proposalId, correlationId, input.now, idempotencyId, snapshot.workspaceId),
  ];
  try {
    assertExactBatch(await input.db.batch(statements), [1, 1, 1, 1, 2], 'reviewer proposal');
  } catch (error) {
    rethrowRateLimitError(error);
    const raced = await input.db.prepare(
      `SELECT result_id FROM idempotency_records
        WHERE workspace_id = ? AND operation = 'create_proposal'
          AND idempotency_key = ? AND request_hash = ? AND state = 'committed'`,
    ).bind(snapshot.workspaceId, request.idempotencyKey, requestHash).first<{ result_id: string }>();
    if (raced?.result_id) {
      const recovered = await proposal(input.db, snapshot.workspaceId, raced.result_id);
      if (recovered) return reviewerProposalResult(recovered, true);
    }
    throw new FcsError('PROPOSAL_WRITE_FAILED', 'The reviewer proposal could not be committed.', 503, true);
  }
  const created = await proposal(input.db, snapshot.workspaceId, proposalId);
  if (!created) throw new Error('Committed reviewer proposal is unavailable.');
  return reviewerProposalResult(created, false);
}

export async function reviewProposal(input: {
  db: D1Database;
  cookieHeader: string | null;
  proposalId: string;
  now: number;
  sessionSecret: string;
  admitOperation?: (workspaceId: string) => Promise<void>;
  input: unknown;
}): Promise<ReviewProposalResult> {
  const parsed = reviewRequestSchema.safeParse(input.input);
  if (!Number.isSafeInteger(input.now) || input.now < 0 || !parsed.success) {
    throw new FcsError('INVALID_INPUT', 'The review input is invalid.', 400);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(input.proposalId)) {
    throw notFound();
  }
  const request = parsed.data;
  const session = await resolveWorkspaceEvidenceSession({
    db: input.db,
    cookieHeader: input.cookieHeader,
    now: input.now,
    sessionSecret: input.sessionSecret,
  });
  const current = await proposal(input.db, session.workspace.id, input.proposalId);
  if (!current) throw notFound();
  const pageSession = await input.db.prepare(
    `SELECT id FROM observation_sessions
      WHERE workspace_id = ? AND variant_id = ? AND implemented_revision = ?
        AND state IN ('finalized', 'verified_pass', 'verified_fail')
      ORDER BY finalized_at DESC, id DESC LIMIT 1`,
  ).bind(
    session.workspace.id, current.variant_id, current.base_implemented_revision,
  ).first<{ id: string }>();
  if (!pageSession) {
    throw new FcsError('REVIEW_STATE_INVALID', 'The proposal cannot be reviewed in this page session.', 409);
  }
  const requestHash = await sha256Hex(JSON.stringify({
    proposalId: input.proposalId,
    proposalHash: current.proposal_hash,
    baseImplementedRevision: current.base_implemented_revision,
    pageSessionId: pageSession.id,
    request: canonicalPackage5Request('review', request),
  }));
  const recovered = await recover(
    input.db, session.workspace.id, input.proposalId, request, requestHash,
  );
  if (recovered) return recovered;
  await input.admitOperation?.(session.workspace.id);
  const reviewerDigest = await sha256Hex(session.sessionToken);
  if (request.action === 'edit') {
    try {
      return await editProposal({
        db: input.db,
        workspaceId: session.workspace.id,
        parent: current,
        request,
        requestHash,
        reviewerDigest,
        pageSessionId: pageSession.id,
        now: input.now,
      });
    } catch (error) {
      rethrowRateLimitError(error);
      if (error instanceof FcsError) throw error;
      const raced = await recover(
        input.db, session.workspace.id, input.proposalId, request, requestHash,
      );
      if (raced) return raced;
      throw new FcsError('REVIEW_WRITE_FAILED', 'The review could not be committed.', 503, true);
    }
  }
  let nextStatus: ProposalRow['status'];
  try {
    nextStatus = transitionProposal(current.status, request.action);
  } catch {
    throw new FcsError('REVIEW_STATE_INVALID', 'The proposal cannot accept that decision.', 409);
  }
  const operation = `review_${request.action}`;
  const idempotencyId = crypto.randomUUID();
  const decisionId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const commitId = crypto.randomUUID();
  const statements: D1PreparedStatement[] = [
    input.db.prepare(
      `INSERT INTO idempotency_records (
         id, workspace_id, operation, idempotency_key, request_hash,
         state, created_at, expires_at
       )
       SELECT ?, p.workspace_id, ?, ?, ?, 'started', ?, ?
         FROM proposals p
         JOIN component_variants v
           ON v.workspace_id = p.workspace_id AND v.id = p.variant_id
          AND v.active_implemented_revision = p.base_implemented_revision
         JOIN observation_sessions s
           ON s.workspace_id = p.workspace_id AND s.id = ?
          AND s.variant_id = p.variant_id
          AND s.implemented_revision = p.base_implemented_revision
          AND s.state IN ('finalized', 'verified_pass', 'verified_fail')
        WHERE p.workspace_id = ? AND p.id = ? AND p.status = ?
          AND p.proposal_hash = ? AND p.base_implemented_revision = ?
          AND (? <> 'review_revoke' OR EXISTS (
            SELECT 1 FROM review_decisions prior
             WHERE prior.workspace_id = p.workspace_id AND prior.proposal_id = p.id
               AND prior.action = 'approve'
               AND NOT EXISTS (
                 SELECT 1 FROM review_decisions later
                  WHERE later.workspace_id = prior.workspace_id
                    AND later.proposal_id = prior.proposal_id
                    AND (later.created_at > prior.created_at OR
                         (later.created_at = prior.created_at AND later.id > prior.id))
               )
          ))
          AND NOT EXISTS (
            SELECT 1 FROM idempotency_records i
             WHERE i.workspace_id = p.workspace_id
               AND i.operation = ? AND i.idempotency_key = ?
          )`,
    ).bind(
      idempotencyId, operation, request.idempotencyKey, requestHash,
      input.now, input.now + 3_600, pageSession.id,
      session.workspace.id, input.proposalId, current.status,
      current.proposal_hash, current.base_implemented_revision,
      operation, operation, request.idempotencyKey,
    ),
    input.db.prepare(
      `INSERT INTO review_decisions (
         id, workspace_id, proposal_id, observation_session_id, action,
         proposal_hash, base_implemented_revision, reviewer_kind,
         reviewer_subject_digest, created_at
       )
       SELECT ?, i.workspace_id, ?, ?, ?, ?, ?, 'ui-mediated', ?, ?
         FROM idempotency_records i
        WHERE i.id = ? AND i.workspace_id = ? AND i.operation = ?
          AND i.state = 'started'`,
    ).bind(
      decisionId, input.proposalId, pageSession.id, request.action,
      current.proposal_hash, current.base_implemented_revision,
      reviewerDigest, input.now, idempotencyId, session.workspace.id, operation,
    ),
    input.db.prepare(
      `UPDATE proposals SET status = ?
        WHERE workspace_id = ? AND id = ? AND status = ?
          AND EXISTS (SELECT 1 FROM review_decisions d
                       WHERE d.workspace_id = proposals.workspace_id
                         AND d.id = ? AND d.proposal_id = proposals.id)`,
    ).bind(nextStatus, session.workspace.id, input.proposalId, current.status, decisionId),
    input.db.prepare(
      `UPDATE idempotency_records
          SET state = 'committed', result_kind = 'review', result_id = ?
        WHERE id = ? AND workspace_id = ? AND operation = ? AND state = 'started'
          AND EXISTS (SELECT 1 FROM review_decisions d
                       WHERE d.workspace_id = idempotency_records.workspace_id
                         AND d.id = ?)`,
    ).bind(decisionId, idempotencyId, session.workspace.id, operation, decisionId),
    input.db.prepare(
      `INSERT INTO audit_events (
         id, workspace_id, actor_kind, action, target_kind, target_id,
         result, correlation_id, safe_detail_json, occurred_at
       )
       SELECT ?, i.workspace_id, 'reviewer', ?, 'review', ?,
              'success', ?, ?, ?
         FROM idempotency_records i
        WHERE i.id = ? AND i.workspace_id = ? AND i.state = 'committed'`,
    ).bind(
      auditId, `review.${request.action}`, decisionId, commitId,
      JSON.stringify({ proposalId: input.proposalId, status: nextStatus }),
      input.now, idempotencyId, session.workspace.id,
    ),
    input.db.prepare(
      `INSERT INTO review_commits (
         id, workspace_id, proposal_id, idempotency_id, decision_id, action, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(commitId, session.workspace.id, input.proposalId, idempotencyId,
      decisionId, request.action, input.now),
  ];
  try {
    assertExactBatch(await input.db.batch(statements), [1, 1, 1, 1, 2, 1], 'review');
  } catch (error) {
    rethrowRateLimitError(error);
    const raced = await recover(
      input.db, session.workspace.id, input.proposalId, request, requestHash,
    );
    if (raced) return raced;
    throw new FcsError('REVIEW_WRITE_FAILED', 'The review could not be committed.', 503, true);
  }
  return publicResult(request.action, { ...current, status: nextStatus }, decisionId, false);
}
