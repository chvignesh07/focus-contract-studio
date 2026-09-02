import {
  applyRequestSchema,
  assertExactBatch,
  canonicalPackage5Request,
  historyRecords,
  undoRequestSchema,
} from '../domain/package5.ts';
import { sha256Hex } from './crypto.ts';
import { FcsError, rethrowRateLimitError } from './errors.ts';
import {
  applicationCandidateError,
  auditHistoryKind,
  boundedHistoryLimit,
} from './package5-operation-policy.ts';
import { resolveWorkspaceEvidenceSession } from './workspaces.ts';

type ApplicationRow = {
  id: string;
  proposal_id: string;
  proposal_hash: string;
  from_revision: number;
  to_revision: number;
  result: 'applied';
  created_at: number;
};

export type ApplyProposalResult = {
  ok: true;
  receipt: {
    receiptId: string;
    proposalId: string;
    proposalDigest8: string;
    fromRevision: number;
    toRevision: number;
    result: 'applied';
    createdAt: string;
    replayed: boolean;
  };
};

function instant(seconds: number): string {
  return new Date(seconds * 1_000).toISOString().replace('.000Z', 'Z');
}

function applicationResult(row: ApplicationRow, replayed: boolean): ApplyProposalResult {
  return {
    ok: true,
    receipt: {
      receiptId: row.id,
      proposalId: row.proposal_id,
      proposalDigest8: row.proposal_hash.slice(0, 8),
      fromRevision: row.from_revision,
      toRevision: row.to_revision,
      result: row.result,
      createdAt: instant(row.created_at),
      replayed,
    },
  };
}

async function recordApplicationFailure(input: {
  db: D1Database;
  workspaceId: string;
  proposalId: string;
  code: string;
  now: number;
}): Promise<void> {
  try {
    await input.db.prepare(
      `INSERT INTO audit_events (
         id, workspace_id, actor_kind, action, target_kind, target_id,
         result, correlation_id, safe_detail_json, occurred_at
       ) VALUES (?, ?, 'reviewer', 'application.failed', 'proposal', ?,
                 'failure', ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(), input.workspaceId, input.proposalId, crypto.randomUUID(),
      JSON.stringify({ code: input.code }), input.now,
    ).run();
  } catch {
    // Audit availability cannot turn a closed application decision into success.
  }
}

async function recoverApplication(input: {
  db: D1Database;
  workspaceId: string;
  idempotencyKey: string;
  requestHash: string;
}): Promise<ApplyProposalResult | null> {
  const row = await input.db.prepare(
    `SELECT i.request_hash, i.state, i.result_id,
            r.id, r.proposal_id, r.proposal_hash, r.from_revision,
            r.to_revision, r.result, r.created_at
       FROM idempotency_records i
       LEFT JOIN application_receipts r
         ON r.workspace_id = i.workspace_id AND r.id = i.result_id
      WHERE i.workspace_id = ? AND i.operation = 'apply'
        AND i.idempotency_key = ?`,
  ).bind(input.workspaceId, input.idempotencyKey).first<
    ApplicationRow & { request_hash: string; state: string; result_id: string | null }
  >();
  if (!row) return null;
  if (row.request_hash !== input.requestHash) {
    throw new FcsError('IDEMPOTENCY_CONFLICT', 'The request key was already used.', 409);
  }
  if (row.state !== 'committed' || !row.result_id || !row.id) {
    throw new FcsError('APPLICATION_IN_PROGRESS', 'The application is still committing.', 409, true);
  }
  return applicationResult(row, true);
}

export async function applyProposal(input: {
  db: D1Database;
  cookieHeader: string | null;
  now: number;
  sessionSecret: string;
  admitOperation?: (workspaceId: string) => Promise<void>;
  input: unknown;
}): Promise<ApplyProposalResult> {
  const parsed = applyRequestSchema.safeParse(input.input);
  if (!parsed.success || !Number.isSafeInteger(input.now) || input.now < 0) {
    throw new FcsError('INVALID_INPUT', 'The application input is invalid.', 400);
  }
  const request = parsed.data;
  const session = await resolveWorkspaceEvidenceSession({
    db: input.db,
    cookieHeader: input.cookieHeader,
    now: input.now,
    sessionSecret: input.sessionSecret,
  });
  const requestHash = await sha256Hex(canonicalPackage5Request('apply', request));
  const replay = await recoverApplication({
    db: input.db,
    workspaceId: session.workspace.id,
    idempotencyKey: request.idempotencyKey,
    requestHash,
  });
  if (replay) return replay;
  await input.admitOperation?.(session.workspace.id);
  const candidate = await input.db.prepare(
    `SELECT p.id, p.variant_id, p.base_implemented_revision, p.proposal_hash,
            p.status, v.active_implemented_revision
       FROM proposals p
       JOIN component_variants v
         ON v.workspace_id = p.workspace_id AND v.id = p.variant_id
      WHERE p.workspace_id = ? AND p.id = ?`,
  ).bind(session.workspace.id, request.proposalId).first<{
    id: string;
    variant_id: string;
    base_implemented_revision: number;
    proposal_hash: string;
    status: string;
    active_implemented_revision: number;
  }>();
  const candidateError = applicationCandidateError(candidate ? {
    status: candidate.status,
    baseImplementedRevision: candidate.base_implemented_revision,
    activeImplementedRevision: candidate.active_implemented_revision,
  } : null, request.expectedImplementedRevision);
  if (candidateError === 'PROPOSAL_NOT_FOUND') {
    throw new FcsError('PROPOSAL_NOT_FOUND', 'The proposal is unavailable.', 404);
  }
  if (candidateError === 'PROPOSAL_NOT_APPROVED' || candidateError === 'STALE_REVISION') {
    await recordApplicationFailure({
      db: input.db,
      workspaceId: session.workspace.id,
      proposalId: request.proposalId,
      code: candidateError,
      now: input.now,
    });
    throw new FcsError(
      candidateError,
      candidateError === 'PROPOSAL_NOT_APPROVED'
        ? 'The proposal is not approved for application.'
        : 'The proposal revision is no longer current.',
      409,
    );
  }
  if (!candidate) throw new Error('Application candidate policy returned an impossible result.');
  const siblings = await input.db.prepare(
    `SELECT COUNT(*) AS count FROM proposals
      WHERE workspace_id = ? AND variant_id = ? AND id <> ?
        AND base_implemented_revision = ? AND status IN ('proposed', 'approved')`,
  ).bind(
    session.workspace.id,
    candidate.variant_id,
    candidate.id,
    candidate.base_implemented_revision,
  ).first<{ count: number }>();
  const idempotencyId = crypto.randomUUID();
  const guardId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const receiptId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const commitId = crypto.randomUUID();
  const statements: D1PreparedStatement[] = [
    input.db.prepare(
      `INSERT INTO idempotency_records (
         id, workspace_id, operation, idempotency_key, request_hash,
         state, created_at, expires_at
       )
       SELECT ?, p.workspace_id, 'apply', ?, ?, 'started', ?, ?
         FROM proposals p
         JOIN component_variants v
           ON v.workspace_id = p.workspace_id AND v.id = p.variant_id
          AND v.active_implemented_revision = ?
        WHERE p.workspace_id = ? AND p.id = ? AND p.status = 'approved'
          AND p.base_implemented_revision = ?
          AND NOT EXISTS (
            SELECT 1 FROM idempotency_records i
             WHERE i.workspace_id = p.workspace_id AND i.operation = 'apply'
               AND i.idempotency_key = ?
          )`,
    ).bind(
      idempotencyId, request.idempotencyKey, requestHash,
      input.now, input.now + 3_600,
      request.expectedImplementedRevision,
      session.workspace.id, request.proposalId,
      request.expectedImplementedRevision, request.idempotencyKey,
    ),
    input.db.prepare(
      `INSERT INTO application_guards (
         id, workspace_id, variant_id, proposal_id, from_revision,
         to_revision, proposal_hash, idempotency_key, created_at
       )
       SELECT ?, i.workspace_id, p.variant_id, p.id, p.base_implemented_revision,
              p.base_implemented_revision + 1, p.proposal_hash, ?, ?
         FROM idempotency_records i
         JOIN proposals p ON p.workspace_id = i.workspace_id AND p.id = ?
         JOIN component_variants v
           ON v.workspace_id = p.workspace_id AND v.id = p.variant_id
          AND v.active_implemented_revision = p.base_implemented_revision
         JOIN review_decisions d
           ON d.workspace_id = p.workspace_id AND d.proposal_id = p.id
          AND d.action = 'approve' AND d.proposal_hash = p.proposal_hash
          AND d.base_implemented_revision = p.base_implemented_revision
         JOIN review_commits rc
           ON rc.workspace_id = d.workspace_id AND rc.decision_id = d.id
          AND rc.proposal_id = p.id AND rc.action = 'approve'
        WHERE i.id = ? AND i.workspace_id = ? AND i.operation = 'apply'
          AND i.state = 'started' AND p.status = 'approved'
          AND p.base_implemented_revision = ?
          AND NOT EXISTS (
            SELECT 1 FROM review_decisions later
             WHERE later.workspace_id = d.workspace_id
               AND later.proposal_id = d.proposal_id
               AND (later.created_at > d.created_at OR
                    (later.created_at = d.created_at AND later.id > d.id))
          )`,
    ).bind(
      guardId, request.idempotencyKey, input.now, request.proposalId,
      idempotencyId, session.workspace.id, request.expectedImplementedRevision,
    ),
    input.db.prepare(
      `INSERT INTO implemented_focus_revisions (
         id, workspace_id, variant_id, revision, configuration_json,
         configuration_hash, parent_revision, source_proposal_id,
         source_receipt_id, created_at
       )
       SELECT ?, g.workspace_id, g.variant_id, g.to_revision,
              p.configuration_json, catalog.configuration_hash,
              g.from_revision, p.id, ?, ?
         FROM application_guards g
         JOIN proposals p ON p.workspace_id = g.workspace_id AND p.id = g.proposal_id
         JOIN fcs_focus_configuration_catalog_v2 catalog
           ON catalog.configuration_json = p.configuration_json
        WHERE g.workspace_id = ? AND g.id = ?`,
    ).bind(revisionId, receiptId, input.now, session.workspace.id, guardId),
    input.db.prepare(
      `UPDATE component_variants
          SET active_implemented_revision = active_implemented_revision + 1
        WHERE workspace_id = ? AND id = ?
          AND active_implemented_revision = ?
          AND EXISTS (SELECT 1 FROM application_guards g
                       WHERE g.workspace_id = component_variants.workspace_id
                         AND g.id = ? AND g.variant_id = component_variants.id)`,
    ).bind(session.workspace.id, candidate.variant_id,
      request.expectedImplementedRevision, guardId),
    input.db.prepare(
      `INSERT INTO application_receipts (
         id, workspace_id, guard_id, proposal_id, proposal_hash,
         from_revision, to_revision, idempotency_key, result, created_at
       )
       SELECT ?, g.workspace_id, g.id, g.proposal_id, g.proposal_hash,
              g.from_revision, g.to_revision, g.idempotency_key, 'applied', ?
         FROM application_guards g
        WHERE g.workspace_id = ? AND g.id = ?
          AND EXISTS (SELECT 1 FROM implemented_focus_revisions r
                       WHERE r.workspace_id = g.workspace_id
                         AND r.variant_id = g.variant_id
                         AND r.revision = g.to_revision AND r.id = ?)`,
    ).bind(receiptId, input.now, session.workspace.id, guardId, revisionId),
    input.db.prepare(
      `UPDATE proposals SET status = 'applied'
        WHERE workspace_id = ? AND id = ? AND status = 'approved'
          AND EXISTS (SELECT 1 FROM application_receipts r
                       WHERE r.workspace_id = proposals.workspace_id
                         AND r.id = ? AND r.proposal_id = proposals.id)`,
    ).bind(session.workspace.id, request.proposalId, receiptId),
    input.db.prepare(
      `UPDATE proposals SET status = 'stale'
        WHERE workspace_id = ? AND variant_id = ? AND id <> ?
          AND base_implemented_revision = ? AND status IN ('proposed', 'approved')
          AND EXISTS (SELECT 1 FROM application_receipts r
                       WHERE r.workspace_id = proposals.workspace_id AND r.id = ?)`,
    ).bind(
      session.workspace.id, candidate.variant_id, request.proposalId,
      request.expectedImplementedRevision, receiptId,
    ),
    input.db.prepare(
      `UPDATE idempotency_records
          SET state = 'committed', result_kind = 'application', result_id = ?
        WHERE id = ? AND workspace_id = ? AND operation = 'apply' AND state = 'started'
          AND EXISTS (SELECT 1 FROM application_receipts r
                       WHERE r.workspace_id = idempotency_records.workspace_id
                         AND r.id = ?)`,
    ).bind(receiptId, idempotencyId, session.workspace.id, receiptId),
    input.db.prepare(
      `INSERT INTO audit_events (
         id, workspace_id, actor_kind, action, target_kind, target_id,
         result, correlation_id, safe_detail_json, occurred_at
       )
       SELECT ?, r.workspace_id, 'reviewer', 'application.applied',
              'application', r.id, 'success', ?, ?, ?
         FROM application_receipts r
         JOIN idempotency_records i
           ON i.workspace_id = r.workspace_id AND i.result_id = r.id
          AND i.operation = 'apply' AND i.state = 'committed'
        WHERE r.workspace_id = ? AND r.id = ?`,
    ).bind(auditId, guardId,
      JSON.stringify({ fromRevision: request.expectedImplementedRevision, toRevision: request.expectedImplementedRevision + 1 }),
      input.now, session.workspace.id, receiptId),
    input.db.prepare(
      `INSERT INTO application_commits (
         id, workspace_id, guard_id, receipt_id, created_at
       ) VALUES (?, ?, ?, ?, ?)`,
    ).bind(commitId, session.workspace.id, guardId, receiptId, input.now),
  ];
  try {
    assertExactBatch(
      await input.db.batch(statements),
      [1, 1, 1, 1, 1, 1, siblings?.count ?? 0, 1, 2, 1],
      'application',
    );
  } catch (error) {
    rethrowRateLimitError(error);
    const raced = await recoverApplication({
      db: input.db,
      workspaceId: session.workspace.id,
      idempotencyKey: request.idempotencyKey,
      requestHash,
    });
    if (raced) return raced;
    const state = await input.db.prepare(
      `SELECT p.status, p.base_implemented_revision, v.active_implemented_revision
         FROM proposals p
         JOIN component_variants v
           ON v.workspace_id = p.workspace_id AND v.id = p.variant_id
        WHERE p.workspace_id = ? AND p.id = ?`,
    ).bind(session.workspace.id, request.proposalId).first<{
      status: string;
      base_implemented_revision: number;
      active_implemented_revision: number;
    }>();
    if (!state) throw new FcsError('PROPOSAL_NOT_FOUND', 'The proposal is unavailable.', 404);
    if (state.status !== 'approved') {
      throw new FcsError(
        'PROPOSAL_NOT_APPROVED',
        'The proposal is not approved for application.',
        409,
      );
    }
    if (
      state.base_implemented_revision !== request.expectedImplementedRevision ||
      state.active_implemented_revision !== request.expectedImplementedRevision
    ) {
      throw new FcsError('STALE_REVISION', 'The proposal revision is no longer current.', 409);
    }
    throw new FcsError('APPLICATION_WRITE_FAILED', 'The proposal could not be applied.', 503, true);
  }
  return applicationResult({
    id: receiptId,
    proposal_id: request.proposalId,
    proposal_hash: candidate.proposal_hash,
    from_revision: request.expectedImplementedRevision,
    to_revision: request.expectedImplementedRevision + 1,
    result: 'applied',
    created_at: input.now,
  }, false);
}

export type Package5HistoryResult = {
  ok: true;
  activeRevision: number;
  records: Record<string, unknown>[];
};

export async function getPackage5History(input: {
  db: D1Database;
  cookieHeader: string | null;
  now: number;
  sessionSecret: string;
  limit?: number;
}): Promise<Package5HistoryResult> {
  const session = await resolveWorkspaceEvidenceSession({
    db: input.db,
    cookieHeader: input.cookieHeader,
    now: input.now,
    sessionSecret: input.sessionSecret,
  });
  const active = await input.db.prepare(
    `SELECT v.id, v.active_implemented_revision
       FROM workspace_view_state s
       JOIN component_variants v
         ON v.workspace_id = s.workspace_id AND v.id = s.active_variant_id
      WHERE s.workspace_id = ?`,
  ).bind(session.workspace.id).first<{ id: string; active_implemented_revision: number }>();
  if (!active) throw new FcsError('NO_ACTIVE_VARIANT', 'No active variant is available.', 409);
  const limit = boundedHistoryLimit(input.limit);
  type Row = Record<string, unknown> & { id: string; occurred_at: number };
  const queries = [
    input.db.prepare(
      `SELECT id, substr(proposal_hash, 1, 8) AS proposal_digest8,
              base_implemented_revision AS base_revision, status,
              created_at AS occurred_at
         FROM proposals WHERE workspace_id = ? AND variant_id = ?
        ORDER BY created_at DESC, id DESC LIMIT ?`,
    ),
    input.db.prepare(
      `SELECT d.id, d.proposal_id, d.action, d.created_at AS occurred_at
         FROM review_decisions d JOIN proposals p
           ON p.workspace_id = d.workspace_id AND p.id = d.proposal_id
        WHERE d.workspace_id = ? AND p.variant_id = ?
        ORDER BY d.created_at DESC, d.id DESC LIMIT ?`,
    ),
    input.db.prepare(
      `SELECT r.id, r.proposal_id, r.from_revision, r.to_revision,
              r.created_at AS occurred_at
         FROM application_receipts r JOIN proposals p
           ON p.workspace_id = r.workspace_id AND p.id = r.proposal_id
        WHERE r.workspace_id = ? AND p.variant_id = ?
        ORDER BY r.created_at DESC, r.id DESC LIMIT ?`,
    ),
    input.db.prepare(
      `SELECT id, revision,
              CASE WHEN revision = 1 THEN 'seed'
                   WHEN source_proposal_id IS NOT NULL THEN 'apply'
                   ELSE 'undo' END AS source,
              created_at AS occurred_at
         FROM implemented_focus_revisions
        WHERE workspace_id = ? AND variant_id = ?
        ORDER BY created_at DESC, id DESC LIMIT ?`,
    ),
    input.db.prepare(
      `SELECT v.id, v.implemented_revision AS revision, v.result,
              EXISTS (SELECT 1 FROM runtime_precedent_provenance pp
                       WHERE pp.workspace_id = v.workspace_id
                         AND pp.verification_receipt_id = v.id) AS projected,
              v.created_at AS occurred_at
         FROM verification_receipts v
        WHERE v.workspace_id = ? AND v.variant_id = ?
        ORDER BY v.created_at DESC, v.id DESC LIMIT ?`,
    ),
    input.db.prepare(
      `SELECT p.id, p.behavior, p.normalized_outcome_key AS outcome_key,
              p.created_at AS occurred_at
         FROM precedent_records p JOIN runtime_precedent_provenance pp
           ON pp.workspace_id = p.workspace_id AND pp.record_id = p.id
        WHERE p.workspace_id = ? AND pp.variant_id = ?
        ORDER BY p.created_at DESC, p.id DESC LIMIT ?`,
    ),
    input.db.prepare(
      `SELECT id, implemented_revision AS revision, state, environment,
              created_at AS occurred_at
         FROM observation_sessions
        WHERE workspace_id = ? AND variant_id = ?
        ORDER BY created_at DESC, id DESC LIMIT ?`,
    ),
    input.db.prepare(
      `SELECT id, json_extract(safe_detail_json, '$.code') AS code,
              correlation_id, action, result, occurred_at
        FROM audit_events
        WHERE workspace_id = ?
          AND ? IS NOT NULL
          AND (action = 'workspace.reset' OR result = 'failure')
        ORDER BY occurred_at DESC, id DESC LIMIT ?`,
    ),
  ];
  const [proposals, decisions, applications, revisions, verifications, projections,
    rehearsals, audits] =
    await Promise.all(queries.map((query) =>
      query.bind(session.workspace.id, active.id, limit).all<Row>(),
    ));
  const map = (kind: string, rows: Row[]) => rows.map((row) => ({
    kind,
    id: row.id,
    proposalId: row.proposal_id,
    proposalDigest8: row.proposal_digest8,
    baseRevision: row.base_revision,
    status: row.status,
    action: row.action,
    fromRevision: row.from_revision,
    toRevision: row.to_revision,
    revision: row.revision,
    source: row.source,
    result: row.result,
    projected: row.projected === 1,
    behavior: row.behavior,
    outcomeKey: row.outcome_key,
    state: row.state,
    environment: row.environment,
    code: row.code,
    correlationId: row.correlation_id,
    occurredAt: row.occurred_at,
  }));
  const raw = [
    ...map('proposal', proposals.results),
    ...map('decision', decisions.results),
    ...map('application', applications.results),
    ...map('revision', revisions.results),
    ...map('verification', verifications.results),
    ...map('projection', projections.results),
    ...map('rehearsal', rehearsals.results),
    ...audits.results.flatMap((row) => {
      const kind = auditHistoryKind(row.action, row.result);
      return kind ? [{
      ...map(kind, [row])[0],
      code: row.action === 'workspace.reset' ? 'WORKSPACE_RESET' : row.code,
      }] : [];
    }),
  ];
  return {
    ok: true,
    activeRevision: active.active_implemented_revision,
    records: historyRecords(raw, limit),
  };
}

export type UndoRevisionResult = {
  ok: true;
  receipt: {
    revisionId: string;
    restoredRevision: number;
    fromRevision: number;
    toRevision: number;
    createdAt: string;
    replayed: boolean;
  };
};

async function recoverUndo(input: {
  db: D1Database;
  workspaceId: string;
  key: string;
  requestHash: string;
}): Promise<UndoRevisionResult | null> {
  const row = await input.db.prepare(
    `SELECT i.request_hash, i.state, i.result_id, c.restore_revision,
            c.from_revision, c.to_revision, c.created_at
       FROM idempotency_records i
       LEFT JOIN undo_commits c
         ON c.workspace_id = i.workspace_id AND c.revision_id = i.result_id
      WHERE i.workspace_id = ? AND i.operation = 'undo' AND i.idempotency_key = ?`,
  ).bind(input.workspaceId, input.key).first<{
    request_hash: string; state: string; result_id: string | null;
    restore_revision: number | null; from_revision: number | null;
    to_revision: number | null; created_at: number | null;
  }>();
  if (!row) return null;
  if (row.request_hash !== input.requestHash) {
    throw new FcsError('IDEMPOTENCY_CONFLICT', 'The request key was already used.', 409);
  }
  if (row.state !== 'committed' || !row.result_id || row.restore_revision === null ||
      row.from_revision === null || row.to_revision === null || row.created_at === null) {
    throw new FcsError('UNDO_IN_PROGRESS', 'The undo is still committing.', 409, true);
  }
  return {
    ok: true,
    receipt: {
      revisionId: row.result_id,
      restoredRevision: row.restore_revision,
      fromRevision: row.from_revision,
      toRevision: row.to_revision,
      createdAt: instant(row.created_at),
      replayed: true,
    },
  };
}

export async function undoRevision(input: {
  db: D1Database;
  cookieHeader: string | null;
  now: number;
  sessionSecret: string;
  admitOperation?: (workspaceId: string) => Promise<void>;
  input: unknown;
}): Promise<UndoRevisionResult> {
  const parsed = undoRequestSchema.safeParse(input.input);
  if (!parsed.success || !Number.isSafeInteger(input.now) || input.now < 0) {
    throw new FcsError('INVALID_INPUT', 'The undo input is invalid.', 400);
  }
  const request = parsed.data;
  const session = await resolveWorkspaceEvidenceSession({
    db: input.db,
    cookieHeader: input.cookieHeader,
    now: input.now,
    sessionSecret: input.sessionSecret,
  });
  const requestHash = await sha256Hex(canonicalPackage5Request('undo', request));
  const replay = await recoverUndo({
    db: input.db, workspaceId: session.workspace.id,
    key: request.idempotencyKey, requestHash,
  });
  if (replay) return replay;
  await input.admitOperation?.(session.workspace.id);
  const active = await input.db.prepare(
    `SELECT v.id, v.active_implemented_revision
       FROM workspace_view_state s JOIN component_variants v
         ON v.workspace_id = s.workspace_id AND v.id = s.active_variant_id
       JOIN implemented_focus_revisions restore
         ON restore.workspace_id = v.workspace_id AND restore.variant_id = v.id
        AND restore.revision = ?
      WHERE s.workspace_id = ? AND v.active_implemented_revision = ?`,
  ).bind(request.restoreRevision, session.workspace.id,
    request.expectedImplementedRevision).first<{ id: string; active_implemented_revision: number }>();
  if (!active) throw new FcsError('UNDO_STALE', 'The selected revision cannot be restored.', 409);
  const idempotencyId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const commitId = crypto.randomUUID();
  const toRevision = request.expectedImplementedRevision + 1;
  const open = await input.db.prepare(
    `SELECT COUNT(*) AS count FROM proposals
      WHERE workspace_id = ? AND variant_id = ?
        AND base_implemented_revision < ? AND status IN ('proposed', 'approved')`,
  ).bind(session.workspace.id, active.id, toRevision).first<{ count: number }>();
  const statements: D1PreparedStatement[] = [
    input.db.prepare(
      `INSERT INTO idempotency_records (
         id, workspace_id, operation, idempotency_key, request_hash,
         state, created_at, expires_at
       )
       SELECT ?, v.workspace_id, 'undo', ?, ?, 'started', ?, ?
         FROM component_variants v
         JOIN workspace_view_state s
           ON s.workspace_id = v.workspace_id AND s.active_variant_id = v.id
         JOIN implemented_focus_revisions restore
           ON restore.workspace_id = v.workspace_id AND restore.variant_id = v.id
          AND restore.revision = ?
        WHERE v.workspace_id = ? AND v.id = ?
          AND v.active_implemented_revision = ?
          AND NOT EXISTS (SELECT 1 FROM idempotency_records i
                           WHERE i.workspace_id = v.workspace_id
                             AND i.operation = 'undo' AND i.idempotency_key = ?)`,
    ).bind(idempotencyId, request.idempotencyKey, requestHash,
      input.now, input.now + 3_600, request.restoreRevision,
      session.workspace.id, active.id, request.expectedImplementedRevision,
      request.idempotencyKey),
    input.db.prepare(
      `INSERT INTO implemented_focus_revisions (
         id, workspace_id, variant_id, revision, configuration_json,
         configuration_hash, parent_revision, source_proposal_id,
         source_receipt_id, created_at
       )
       SELECT ?, i.workspace_id, restore.variant_id, ?, restore.configuration_json,
              restore.configuration_hash, ?, NULL, NULL, ?
         FROM idempotency_records i
         JOIN implemented_focus_revisions restore
           ON restore.workspace_id = i.workspace_id
          AND restore.variant_id = ? AND restore.revision = ?
        WHERE i.id = ? AND i.workspace_id = ? AND i.operation = 'undo'
          AND i.state = 'started'`,
    ).bind(revisionId, toRevision, request.expectedImplementedRevision,
      input.now, active.id, request.restoreRevision, idempotencyId, session.workspace.id),
    input.db.prepare(
      `UPDATE component_variants SET active_implemented_revision = ?
        WHERE workspace_id = ? AND id = ? AND active_implemented_revision = ?
          AND EXISTS (SELECT 1 FROM implemented_focus_revisions r
                       WHERE r.workspace_id = component_variants.workspace_id
                         AND r.id = ? AND r.revision = ?)`,
    ).bind(toRevision, session.workspace.id, active.id,
      request.expectedImplementedRevision, revisionId, toRevision),
    input.db.prepare(
      `UPDATE proposals SET status = 'stale'
        WHERE workspace_id = ? AND variant_id = ?
          AND base_implemented_revision < ? AND status IN ('proposed', 'approved')
          AND EXISTS (SELECT 1 FROM implemented_focus_revisions r
                       WHERE r.workspace_id = proposals.workspace_id AND r.id = ?)`,
    ).bind(session.workspace.id, active.id, toRevision, revisionId),
    input.db.prepare(
      `UPDATE idempotency_records
          SET state = 'committed', result_kind = 'revision', result_id = ?
        WHERE id = ? AND workspace_id = ? AND operation = 'undo' AND state = 'started'
          AND EXISTS (SELECT 1 FROM implemented_focus_revisions r
                       WHERE r.workspace_id = idempotency_records.workspace_id
                         AND r.id = ?)`,
    ).bind(revisionId, idempotencyId, session.workspace.id, revisionId),
    input.db.prepare(
      `INSERT INTO audit_events (
         id, workspace_id, actor_kind, action, target_kind, target_id,
         result, correlation_id, safe_detail_json, occurred_at
       )
       SELECT ?, i.workspace_id, 'reviewer', 'revision.undone', 'revision', ?,
              'success', ?, ?, ?
         FROM idempotency_records i
        WHERE i.id = ? AND i.workspace_id = ? AND i.state = 'committed'`,
    ).bind(auditId, revisionId, commitId,
      JSON.stringify({ fromRevision: request.expectedImplementedRevision, toRevision, restoredRevision: request.restoreRevision }),
      input.now, idempotencyId, session.workspace.id),
    input.db.prepare(
      `INSERT INTO undo_commits (
         id, workspace_id, variant_id, idempotency_id, revision_id,
         from_revision, to_revision, restore_revision, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(commitId, session.workspace.id, active.id, idempotencyId, revisionId,
      request.expectedImplementedRevision, toRevision, request.restoreRevision, input.now),
  ];
  try {
    assertExactBatch(await input.db.batch(statements),
      [1, 1, 1, open?.count ?? 0, 1, 2, 1], 'undo');
  } catch (error) {
    rethrowRateLimitError(error);
    const raced = await recoverUndo({
      db: input.db, workspaceId: session.workspace.id,
      key: request.idempotencyKey, requestHash,
    });
    if (raced) return raced;
    throw new FcsError('UNDO_WRITE_FAILED', 'The undo could not be committed.', 503, true);
  }
  return {
    ok: true,
    receipt: {
      revisionId,
      restoredRevision: request.restoreRevision,
      fromRevision: request.expectedImplementedRevision,
      toRevision,
      createdAt: instant(input.now),
      replayed: false,
    },
  };
}
