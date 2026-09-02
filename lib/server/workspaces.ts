import { assertExactBatch } from '../domain/package5';
import {
  constantTimeEqual,
  deterministicUuid,
  hexToBytes,
  randomTokenBytes,
  sha256Bytes,
  sha256Hex,
} from './crypto';
import {
  FcsError,
  rethrowRateLimitError,
  unavailableVariant,
} from './errors';
import {
  anonymousSubjectKey,
  csrfDigestForSession,
  csrfTokenForSession,
  issueSessionCookie,
  parseSessionCookie,
  resetTokenForSession,
} from './session';
import { createWorkspaceSeed } from '../domain/workspace-seed';
import { createWorkspaceCorpusSeed } from '../retrieval/corpus-seed';
import { workspaceQueryInventory } from './query-inventory';

const ACCESS_TTL_SECONDS = 8 * 60 * 60;
const GRACE_SECONDS = 24 * 60 * 60;

export type WorkspaceSummary = { id: string; generation: number };

type BootstrapInput = {
  db: D1Database;
  cookieHeader: string | null;
  now: number;
  tokenBytes?: Uint8Array;
  sessionSecret: string;
  csrfSecret: string;
  admitCreate?: () => Promise<void>;
};

type WorkspaceRow = WorkspaceSummary & {
  subject_key: string;
  admission_subject_key: string | null;
  csrf_digest: string;
  access_expires_at: number;
  purged_at: number | null;
};

function assertResultChanges(result: D1Result, expected: number, operation: string): void {
  if (!result.success || result.meta.changes !== expected) {
    throw new Error(`${operation} affected an unexpected number of rows.`);
  }
}

async function workspaceIdForSubject(subjectKey: string): Promise<string> {
  return deterministicUuid(`fcs-workspace-v1:${subjectKey}`);
}

type SeedGuard = { idempotencyId: string; priorWorkspaceId: string };

function seedInsert(
  db: D1Database,
  tableAndColumns: string,
  valuesSql: string,
  bindings: unknown[],
  guard?: SeedGuard,
): D1PreparedStatement {
  const guardedSuffix = guard
    ? ` WHERE EXISTS (
          SELECT 1 FROM idempotency_records
           WHERE id = ? AND workspace_id = ? AND operation = 'reset' AND state = 'started'
        )`
    : '';
  return db
    .prepare(
      `INSERT INTO ${tableAndColumns} ${guard ? 'SELECT' : 'VALUES ('} ${valuesSql}${
        guard ? guardedSuffix : ')'
      }`,
    )
    .bind(...bindings, ...(guard ? [guard.idempotencyId, guard.priorWorkspaceId] : []));
}

async function seedStatements(
  db: D1Database,
  workspaceId: string,
  now: number,
  guard?: SeedGuard,
): Promise<D1PreparedStatement[]> {
  const seed = await createWorkspaceSeed(workspaceId);
  const corpus = await createWorkspaceCorpusSeed(workspaceId);
  const statements: D1PreparedStatement[] = [];
  for (const variant of seed.variants) {
    statements.push(
      seedInsert(
        db,
        `component_variants (
           id, workspace_id, product, family, use_case, slug,
           active_implemented_revision, created_at
         )`,
        `?, ?, 'focus-contract-studio', 'modal-dialog', 'delete-account', ?, 1, ?`,
        [variant.id, workspaceId, variant.slug, now],
        guard,
      ),
      seedInsert(
        db,
        `implemented_focus_revisions (
           id, workspace_id, variant_id, revision, configuration_json,
           configuration_hash, created_at
         )`,
        `?, ?, ?, 1, ?, ?, ?`,
        [
          variant.revisionId,
          workspaceId,
          variant.id,
          variant.configurationJson,
          variant.configurationHash,
          now,
        ],
        guard,
      ),
    );
  }
  statements.push(
    seedInsert(
      db,
      `workspace_view_state (
         workspace_id, active_variant_id, view_revision, updated_at
       )`,
      `?, ?, 1, ?`,
      [workspaceId, seed.activeVariantId, now],
      guard,
    ),
  );

  for (const record of corpus) {
    statements.push(
      seedInsert(
        db,
        `precedent_records (
           id, workspace_id, record_key, dataset_version, scope_kind, scope_key,
           behavior, normalized_outcome_key, status, valid_from, valid_until,
           rationale, tags_json, provenance_kind, provenance_ref, created_at
         )`,
        `?, ?, ?, 'fcs-precedent-v2', ?, ?, ?, ?, ?, ?, ?, ?, ?,
         'synthetic-seed', ?, ?`,
        [
          record.recordId,
          workspaceId,
          record.source.id,
          record.scopeKind,
          record.scopeKey,
          record.source.behavior,
          record.source.outcomeKey,
          record.databaseStatus,
          record.validFrom,
          record.validUntil,
          record.source.rationale,
          JSON.stringify(record.source.tags),
          record.source.id,
          now,
        ],
        guard,
      ),
    );
  }

  for (const record of corpus) {
    statements.push(
      seedInsert(
        db,
        `precedent_retrieval_profiles (
           record_id, workspace_id, product, component_family, use_case,
           variants_json, intent, risk, source_status, hostile,
           mismatch_tags_json, shape_tags_json, relationships_json,
           supersedes_record_key
         )`,
        `?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?`,
        [
          record.recordId,
          workspaceId,
          record.source.product,
          record.source.componentFamily,
          record.source.useCase,
          JSON.stringify(record.source.variants),
          record.source.intent,
          record.source.risk,
          record.source.status,
          record.source.hostile ? 1 : 0,
          JSON.stringify(record.source.mismatchTags),
          JSON.stringify(record.source.shapeTags),
          JSON.stringify(record.source.relationships),
          record.source.supersedes,
        ],
        guard,
      ),
    );
    for (const edge of record.edges) {
      statements.push(
        seedInsert(
          db,
          `precedent_subject_edges (
             id, workspace_id, record_id, target_kind, target_key, edge_type, weight
           )`,
          `?, ?, ?, ?, ?, ?, ?`,
          [
            edge.id,
            workspaceId,
            record.recordId,
            edge.targetKind,
            edge.targetKey,
            edge.edgeType,
            edge.weight,
          ],
          guard,
        ),
      );
    }
  }

  for (const record of corpus) {
    if (!record.lineageId || !record.supersededRecordId) continue;
    statements.push(
      seedInsert(
        db,
        `precedent_lineage (
           id, workspace_id, from_record_id, to_record_id, relationship, created_at
         )`,
        `?, ?, ?, ?, 'supersedes', ?`,
        [
          record.lineageId,
          workspaceId,
          record.recordId,
          record.supersededRecordId,
          now,
        ],
        guard,
      ),
    );
  }
  return statements;
}

async function createSeededWorkspace(options: {
  db: D1Database;
  workspaceId: string;
  subjectKey: string;
  admissionSubjectKey: string;
  csrfDigest: string;
  generation: number;
  now: number;
  prefixStatements?: D1PreparedStatement[];
  suffixStatements?: D1PreparedStatement[];
  admittedSuffixIndex?: number;
  guard?: SeedGuard;
}): Promise<void> {
  const {
    db,
    workspaceId,
    subjectKey,
    admissionSubjectKey,
    csrfDigest,
    generation,
    now,
    prefixStatements = [],
    suffixStatements = [],
    admittedSuffixIndex,
    guard,
  } = options;
  const seed = await seedStatements(db, workspaceId, now, guard);
  const results = await db.batch([
    ...prefixStatements,
    seedInsert(
      db,
      `workspaces (
         id, subject_kind, subject_key, admission_subject_key, csrf_digest, generation,
         created_at, last_access_at, access_expires_at, grace_expires_at
       )`,
      `?, 'anonymous', ?, ?, ?, ?, ?, ?, ?, ?`,
      [
        workspaceId,
        subjectKey,
        admissionSubjectKey,
        csrfDigest,
        generation,
        now,
        now,
        now + ACCESS_TTL_SECONDS,
        now + ACCESS_TTL_SECONDS + GRACE_SECONDS,
      ],
      guard,
    ),
    ...seed,
    ...suffixStatements,
  ]);
  if (guard && results.every((result) => result.success && result.meta.changes === 0)) {
    throw new FcsError(
      'RESET_ALREADY_COMPLETED',
      'The current workspace was already reset.',
      409,
    );
  }
  for (const [index, result] of results.entries()) {
    const suffixIndex = index - prefixStatements.length - seed.length - 1;
    assertResultChanges(
      result,
      suffixIndex === admittedSuffixIndex ? 2 : 1,
      `seed statement ${index + 1}`,
    );
  }
}

async function findWorkspaceBySubject(
  db: D1Database,
  subjectKey: string,
  currentOnly: boolean,
): Promise<WorkspaceRow | null> {
  return db
    .prepare(
      currentOnly
        ? workspaceQueryInventory.resolveCurrentWorkspace.sql
        : workspaceQueryInventory.resolveWorkspaceHistory.sql,
    )
    .bind('anonymous', subjectKey)
    .first<WorkspaceRow>();
}

export async function resolveWorkspaceSession(input: {
  db: D1Database;
  cookieHeader: string | null;
  now: number;
  sessionSecret: string;
  csrfSecret: string;
  includePurged?: boolean;
}): Promise<{
  workspace: WorkspaceSummary;
  csrfToken: string;
  csrfDigest: string;
}> {
  const resolved = await resolveWorkspaceEvidenceSession({
    db: input.db,
    cookieHeader: input.cookieHeader,
    now: input.now,
    sessionSecret: input.sessionSecret,
    includePurged: input.includePurged,
  });
  return {
    workspace: resolved.workspace,
    csrfToken: await csrfTokenForSession(resolved.sessionToken, input.csrfSecret),
    csrfDigest: resolved.csrfDigest,
  };
}

export async function resolveWorkspaceEvidenceSession(input: {
  db: D1Database;
  cookieHeader: string | null;
  now: number;
  sessionSecret: string;
  includePurged?: boolean;
}): Promise<{
  workspace: WorkspaceSummary;
  csrfDigest: string;
  sessionToken: Uint8Array;
}> {
  const parsed = await parseSessionCookie(input.cookieHeader, {
    now: input.now,
    sessionSecret: input.sessionSecret,
  });
  if (!parsed) throw new FcsError('SESSION_INVALID', 'The session is invalid.', 401);
  const subjectKey = await anonymousSubjectKey(parsed.token, input.sessionSecret);
  const workspace = await findWorkspaceBySubject(
    input.db,
    subjectKey,
    !(input.includePurged ?? false),
  );
  if (!workspace) throw new FcsError('SESSION_INVALID', 'The session is invalid.', 401);
  if (
    !(input.includePurged ?? false) &&
    (workspace.purged_at !== null || workspace.access_expires_at < input.now)
  ) {
    throw new FcsError('SESSION_EXPIRED', 'The session has expired.', 401);
  }
  return {
    workspace: { id: workspace.id, generation: workspace.generation },
    csrfDigest: workspace.csrf_digest,
    sessionToken: parsed.token,
  };
}

export async function bootstrapWorkspace(
  input: BootstrapInput,
): Promise<{
  workspace: WorkspaceSummary;
  csrfToken: string;
  setCookie: string | null;
  created: boolean;
}> {
  const hadCookie = input.cookieHeader?.includes('__Host-fcs_session=') ?? false;
  const parsed = await parseSessionCookie(input.cookieHeader, {
    now: input.now,
    sessionSecret: input.sessionSecret,
  });
  if (hadCookie && !parsed) {
    throw new FcsError('SESSION_INVALID', 'The session is invalid.', 401);
  }
  if (parsed) {
    const subjectKey = await anonymousSubjectKey(parsed.token, input.sessionSecret);
    const workspace = await findWorkspaceBySubject(input.db, subjectKey, true);
    if (!workspace) {
      const expired = await findWorkspaceBySubject(input.db, subjectKey, false);
      throw new FcsError(
        expired ? 'SESSION_EXPIRED' : 'SESSION_INVALID',
        expired ? 'The session has expired.' : 'The session is invalid.',
        401,
      );
    }
    if (workspace.access_expires_at < input.now) {
      throw new FcsError('SESSION_EXPIRED', 'The session has expired.', 401);
    }
    const csrfToken = await csrfTokenForSession(parsed.token, input.csrfSecret);
    return {
      workspace: { id: workspace.id, generation: workspace.generation },
      csrfToken,
      setCookie: null,
      created: false,
    };
  }

  const token = input.tokenBytes ?? randomTokenBytes();
  if (token.byteLength !== 32) throw new Error('Session token must be 256 bits.');
  const subjectKey = await anonymousSubjectKey(token, input.sessionSecret);
  const csrfToken = await csrfTokenForSession(token, input.csrfSecret);
  const csrfDigest = await csrfDigestForSession(token, input.csrfSecret);
  const workspaceId = await workspaceIdForSubject(subjectKey);
  await input.admitCreate?.();
  await createSeededWorkspace({
    db: input.db,
    workspaceId,
    subjectKey,
    admissionSubjectKey: subjectKey,
    csrfDigest,
    generation: 1,
    now: input.now,
  });
  const cookie = await issueSessionCookie({
    token,
    now: input.now,
    sessionSecret: input.sessionSecret,
  });
  return {
    workspace: { id: workspaceId, generation: 1 },
    csrfToken,
    setCookie: cookie.header,
    created: true,
  };
}

export async function getVariantForWorkspace(
  db: D1Database,
  workspaceId: string,
  variantId: string,
): Promise<{ id: string; slug: string; activeImplementedRevision: number }> {
  const row = await db
    .prepare(workspaceQueryInventory.getVariantForWorkspace.sql)
    .bind(workspaceId, variantId)
    .first<{ id: string; slug: string; active_implemented_revision: number }>();
  if (!row) throw unavailableVariant();
  return {
    id: row.id,
    slug: row.slug,
    activeImplementedRevision: row.active_implemented_revision,
  };
}

export async function getVariantForWorkspaceBySlug(
  db: D1Database,
  workspaceId: string,
  slug: string,
): Promise<{ id: string; slug: string; activeImplementedRevision: number }> {
  const row = await db
    .prepare(workspaceQueryInventory.getVariantForWorkspaceBySlug.sql)
    .bind(workspaceId, slug)
    .first<{ id: string; slug: string; active_implemented_revision: number }>();
  if (!row) throw unavailableVariant();
  return {
    id: row.id,
    slug: row.slug,
    activeImplementedRevision: row.active_implemented_revision,
  };
}

export async function getActiveSeedState(
  db: D1Database,
  workspaceId: string,
): Promise<{
  slug: string;
  implementedRevision: number;
  viewRevision: number;
}> {
  const row = await db
    .prepare(workspaceQueryInventory.getActiveSeedState.sql)
    .bind(workspaceId)
    .first<{
      slug: string;
      active_implemented_revision: number;
      view_revision: number;
    }>();
  if (!row) {
    throw new FcsError('NO_ACTIVE_VARIANT', 'No active variant is available.', 409);
  }
  return {
    slug: row.slug,
    implementedRevision: row.active_implemented_revision,
    viewRevision: row.view_revision,
  };
}

async function recoverVariantSelection(input: {
  db: D1Database;
  workspaceId: string;
  idempotencyKey: string;
  requestHash: string;
}): Promise<{ variant: string; viewRevision: number } | null> {
  const row = await input.db.prepare(
    `SELECT selection.request_hash, selection.to_view_revision, variant.slug
       FROM variant_selection_commits selection
       JOIN component_variants variant
         ON variant.workspace_id = selection.workspace_id
        AND variant.id = selection.variant_id
      WHERE selection.workspace_id = ? AND selection.idempotency_key = ?`,
  ).bind(input.workspaceId, input.idempotencyKey).first<{
    request_hash: string;
    to_view_revision: number;
    slug: string;
  }>();
  if (!row) return null;
  if (row.request_hash !== input.requestHash) {
    throw new FcsError('IDEMPOTENCY_CONFLICT', 'The request key was already used.', 409);
  }
  return { variant: row.slug, viewRevision: row.to_view_revision };
}

export async function setActiveVariantBySlug(input: {
  db: D1Database;
  workspaceId: string;
  slug: string;
  expectedViewRevision: number;
  idempotencyKey: string;
  now: number;
  admitOperation?: (workspaceId: string) => Promise<void>;
}): Promise<{ variant: string; viewRevision: number }> {
  const variant = await getVariantForWorkspaceBySlug(
    input.db,
    input.workspaceId,
    input.slug,
  );
  const requestHash = await sha256Hex(JSON.stringify({
    operation: 'select_active_variant',
    variant: input.slug,
    expectedViewRevision: input.expectedViewRevision,
    idempotencyKey: input.idempotencyKey,
  }));
  const replay = await recoverVariantSelection({ ...input, requestHash });
  if (replay) return replay;
  await input.admitOperation?.(input.workspaceId);

  const selectionId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const nextViewRevision = input.expectedViewRevision + 1;
  const statements = [
    input.db.prepare(
      `INSERT INTO variant_selection_commits (
         id, workspace_id, variant_id, idempotency_key, request_hash,
         from_view_revision, to_view_revision, created_at
       )
       SELECT ?, state.workspace_id, variant.id, ?, ?, state.view_revision,
              state.view_revision + 1, ?
         FROM workspace_view_state state
         JOIN component_variants variant
           ON variant.workspace_id = state.workspace_id AND variant.id = ?
        WHERE state.workspace_id = ? AND state.view_revision = ?
          AND NOT EXISTS (
            SELECT 1 FROM variant_selection_commits existing
             WHERE existing.workspace_id = state.workspace_id
               AND (existing.idempotency_key = ?
                 OR existing.from_view_revision = state.view_revision)
          )`,
    ).bind(
      selectionId,
      input.idempotencyKey,
      requestHash,
      input.now,
      variant.id,
      input.workspaceId,
      input.expectedViewRevision,
      input.idempotencyKey,
    ),
    input.db.prepare(
      `UPDATE workspace_view_state
          SET active_variant_id = ?, view_revision = view_revision + 1,
              updated_at = ?
        WHERE workspace_id = ? AND view_revision = ?
          AND EXISTS (
            SELECT 1 FROM variant_selection_commits selection
             WHERE selection.workspace_id = workspace_view_state.workspace_id
               AND selection.id = ?
               AND selection.variant_id = ?
               AND selection.from_view_revision = workspace_view_state.view_revision
          )`,
    ).bind(
      variant.id,
      input.now,
      input.workspaceId,
      input.expectedViewRevision,
      selectionId,
      variant.id,
    ),
    input.db.prepare(
      `INSERT INTO audit_events (
         id, workspace_id, actor_kind, action, target_kind, target_id,
         result, correlation_id, safe_detail_json, occurred_at
       ) VALUES (?, ?, 'browser', 'variant.selected', 'variant-selection', ?,
                 'success', ?, ?, ?)`,
    ).bind(
      auditId,
      input.workspaceId,
      selectionId,
      selectionId,
      JSON.stringify({
        fromViewRevision: input.expectedViewRevision,
        toViewRevision: nextViewRevision,
      }),
      input.now,
    ),
  ];
  try {
    assertExactBatch(await input.db.batch(statements), [1, 1, 2], 'variant selection');
  } catch (error) {
    rethrowRateLimitError(error);
    const raced = await recoverVariantSelection({ ...input, requestHash });
    if (raced) return raced;
    const state = await input.db.prepare(
      `SELECT view_revision FROM workspace_view_state WHERE workspace_id = ?`,
    ).bind(input.workspaceId).first<{ view_revision: number }>();
    if (!state || state.view_revision !== input.expectedViewRevision) {
      throw new FcsError('VIEW_STATE_STALE', 'The current view changed. Reload and retry.', 409);
    }
    throw new FcsError(
      'VARIANT_SELECTION_WRITE_FAILED',
      'The active variant could not be committed.',
      503,
      true,
    );
  }
  return { variant: variant.slug, viewRevision: nextViewRevision };
}

export async function cleanupExpiredWorkspaces(
  db: D1Database,
  now: number,
): Promise<number> {
  const candidates = await db
    .prepare(workspaceQueryInventory.cleanupExpiredWorkspaces.sql)
    .bind(now)
    .all<{ id: string }>();
  if (candidates.results.length === 0) return 0;
  const results = await db.batch(
    candidates.results.map(({ id }) =>
      db
        .prepare(
          `DELETE FROM workspaces
            WHERE id = ? AND subject_kind = 'anonymous' AND grace_expires_at < ?`,
        )
        .bind(id, now),
    ),
  );
  let deleted = 0;
  for (const result of results) {
    if (!result.success || result.meta.changes < 0) {
      throw new Error('Workspace cleanup did not delete every selected graph.');
    }
    if (result.meta.changes > 0) deleted += 1;
  }
  return deleted;
}

export async function resetWorkspace(input: {
  db: D1Database;
  cookieHeader: string;
  csrfToken: string;
  idempotencyKey: string;
  now: number;
  sessionSecret: string;
  csrfSecret: string;
  admitReset?: (workspaceId: string) => Promise<void>;
}): Promise<{
  workspace: WorkspaceSummary;
  csrfToken: string;
  setCookie: string;
  replayed: boolean;
}> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
      input.idempotencyKey,
    )
  ) {
    throw new FcsError('INVALID_REQUEST', 'The request is invalid.', 400);
  }
  const parsed = await parseSessionCookie(input.cookieHeader, {
    now: input.now,
    sessionSecret: input.sessionSecret,
  });
  if (!parsed) throw new FcsError('SESSION_INVALID', 'The session is invalid.', 401);
  const subjectKey = await anonymousSubjectKey(parsed.token, input.sessionSecret);
  const prior = await findWorkspaceBySubject(input.db, subjectKey, false);
  if (!prior) throw new FcsError('SESSION_INVALID', 'The session is invalid.', 401);
  const expectedCsrfDigest = hexToBytes(prior.csrf_digest);
  const suppliedCsrfDigest = await sha256Bytes(input.csrfToken);
  if (
    !expectedCsrfDigest ||
    !constantTimeEqual(expectedCsrfDigest, suppliedCsrfDigest)
  ) {
    throw new FcsError('CSRF_REJECTED', 'The request token is invalid.', 403);
  }
  const requestHash = await sha256Hex(
    `fcs-reset-request-v1:${prior.id}:${prior.generation}:${input.idempotencyKey}`,
  );
  type ResetRecord = {
    request_hash: string;
    result_id: string | null;
    created_at: number;
  };
  const existing = await input.db
    .prepare(workspaceQueryInventory.getResetIdempotency.sql)
    .bind(prior.id, input.idempotencyKey)
    .first<ResetRecord>();
  if (existing && existing.request_hash !== requestHash) {
    throw new FcsError('IDEMPOTENCY_CONFLICT', 'The request key was already used.', 409);
  }
  const nextToken = await resetTokenForSession(
    parsed.token,
    input.idempotencyKey,
    input.sessionSecret,
  );
  const nextSubjectKey = await anonymousSubjectKey(nextToken, input.sessionSecret);
  const nextCsrfToken = await csrfTokenForSession(nextToken, input.csrfSecret);
  const nextCsrfDigest = await csrfDigestForSession(nextToken, input.csrfSecret);
  const nextWorkspaceId = await deterministicUuid(
    `fcs-reset-workspace-v1:${prior.id}:${prior.generation}:${input.idempotencyKey}`,
  );
  const replayResult = async (record: ResetRecord) => {
    if (!record.result_id) {
      throw new FcsError('RESET_IN_PROGRESS', 'The reset is still completing.', 409, true);
    }
    const workspace = await input.db
      .prepare(workspaceQueryInventory.getWorkspaceById.sql)
      .bind(record.result_id)
      .first<WorkspaceSummary>();
    if (!workspace) throw new Error('Committed reset workspace is unavailable.');
    const cookie = await issueSessionCookie({
      token: nextToken,
      now: record.created_at,
      sessionSecret: input.sessionSecret,
    });
    return {
      workspace,
      csrfToken: nextCsrfToken,
      setCookie: cookie.header,
      replayed: true,
    };
  };
  if (existing) {
    return replayResult(existing);
  }
  if (prior.purged_at !== null || prior.access_expires_at < input.now) {
    throw new FcsError('SESSION_EXPIRED', 'The session has expired.', 401);
  }
  await input.admitReset?.(prior.id);
  const idempotencyId = await deterministicUuid(
    `fcs-reset-idempotency-v1:${prior.id}:${input.idempotencyKey}`,
  );
  try {
    await createSeededWorkspace({
      db: input.db,
      workspaceId: nextWorkspaceId,
      subjectKey: nextSubjectKey,
      admissionSubjectKey: prior.admission_subject_key ?? prior.subject_key,
      csrfDigest: nextCsrfDigest,
      generation: prior.generation + 1,
      now: input.now,
      prefixStatements: [
      input.db
        .prepare(
          `INSERT INTO idempotency_records (
             id, workspace_id, operation, idempotency_key, request_hash,
             state, created_at, expires_at
           )
           SELECT ?, ?, 'reset', ?, ?, 'started', ?, ?
             FROM workspaces
            WHERE id = ? AND subject_kind = 'anonymous'
              AND purged_at IS NULL AND access_expires_at >= ?`,
        )
        .bind(
          idempotencyId,
          prior.id,
          input.idempotencyKey,
          requestHash,
          input.now,
          input.now + GRACE_SECONDS,
          prior.id,
          input.now,
        ),
      input.db
        .prepare(
          `UPDATE workspaces
              SET last_access_at = ?, access_expires_at = ?, grace_expires_at = ?, purged_at = ?
            WHERE id = ? AND purged_at IS NULL
              AND EXISTS (
                SELECT 1 FROM idempotency_records
                 WHERE id = ? AND workspace_id = ?
                   AND operation = 'reset' AND state = 'started'
              )`,
        )
        .bind(
          input.now,
          input.now,
          input.now + GRACE_SECONDS,
          input.now,
          prior.id,
          idempotencyId,
          prior.id,
        ),
      ],
      suffixStatements: [
      input.db
        .prepare(
          `UPDATE idempotency_records
              SET state = 'committed', result_kind = 'workspace', result_id = ?
            WHERE id = ? AND workspace_id = ? AND state = 'started'`,
        )
        .bind(nextWorkspaceId, idempotencyId, prior.id),
      input.db
        .prepare(
          `INSERT INTO audit_events (
             id, workspace_id, actor_kind, action, target_kind, target_id,
             result, correlation_id, safe_detail_json, occurred_at
           )
           SELECT ?, successor.id, 'reviewer', 'workspace.reset', 'workspace',
                  successor.id, 'success', ?, ?, ?
             FROM workspaces successor
             JOIN idempotency_records reset
               ON reset.workspace_id = ? AND reset.id = ?
              AND reset.operation = 'reset' AND reset.state = 'committed'
              AND reset.result_id = successor.id
            WHERE successor.id = ?`,
        )
        .bind(
          crypto.randomUUID(),
          crypto.randomUUID(),
          JSON.stringify({ generation: prior.generation + 1 }),
          input.now,
          prior.id,
          idempotencyId,
          nextWorkspaceId,
        )
      ],
      admittedSuffixIndex: 1,
      guard: { idempotencyId, priorWorkspaceId: prior.id },
    });
  } catch (error) {
    rethrowRateLimitError(error);
    const raced = await input.db
      .prepare(workspaceQueryInventory.getResetIdempotency.sql)
      .bind(prior.id, input.idempotencyKey)
      .first<ResetRecord>();
    if (raced) {
      if (raced.request_hash !== requestHash) {
        throw new FcsError(
          'IDEMPOTENCY_CONFLICT',
          'The request key was already used.',
          409,
        );
      }
      return replayResult(raced);
    }
    if (error instanceof FcsError) throw error;
    const retainedPrior = await findWorkspaceBySubject(
      input.db,
      subjectKey,
      false,
    );
    if (
      retainedPrior?.id === prior.id &&
      retainedPrior.purged_at === null &&
      retainedPrior.access_expires_at >= input.now
    ) {
      throw new FcsError(
        'RESET_FAILED',
        'The workspace reset could not be completed.',
        503,
        true,
      );
    }
    throw new FcsError(
      'RESET_ALREADY_COMPLETED',
      'The current workspace was already reset.',
      409,
    );
  }
  const cookie = await issueSessionCookie({
    token: nextToken,
    now: input.now,
    sessionSecret: input.sessionSecret,
  });
  return {
    workspace: { id: nextWorkspaceId, generation: prior.generation + 1 },
    csrfToken: nextCsrfToken,
    setCookie: cookie.header,
    replayed: false,
  };
}
