import {
  canonicalObservationEvents,
  canonicalRenderedManifest,
  finalizeRehearsalInputSchema,
  sequenceObservationEvents,
  startRehearsalInputSchema,
  type FinalizeRehearsalInput,
  type StartRehearsalInput,
} from '../domain/focus-rehearsal';
import {
  base64UrlEncode,
  constantTimeEqual,
  hexToBytes,
  randomTokenBytes,
  sha256Hex,
} from './crypto';
import { FcsError, rethrowRateLimitError } from './errors';

type ActiveRow = {
  variant_id: string;
  implemented_revision: number;
};

type SessionRow = ActiveRow & {
  id: string;
  environment: 'browser' | 'playwright';
  state: 'recording' | 'finalized' | 'verified_pass' | 'verified_fail' | 'expired';
  created_at: number;
  expires_at: number;
  finalized_at: number | null;
  event_digest: string | null;
  manifest_digest: string | null;
  event_count: number | null;
};

export type StartedFocusRehearsal = {
  rehearsalSessionId: string;
  variantId: string;
  implementedRevision: number;
  expiresAt: number;
  state: 'recording';
};

export type FinalizedFocusRehearsal = {
  rehearsalSessionId: string;
  variantId: string;
  implementedRevision: number;
  environment: 'browser' | 'playwright';
  manifestDigest: string;
  eventDigest: string;
  eventCount: number;
  state: 'finalized';
  idempotentReplay: boolean;
};

function rehearsalError(
  code: string,
  message: string,
  status: number,
  retryable = false,
): FcsError {
  return new FcsError(code, message, status, retryable);
}

function validServerTime(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function equalDigest(left: string | null, right: string): boolean {
  const leftBytes = left === null ? null : hexToBytes(left);
  const rightBytes = hexToBytes(right);
  return leftBytes !== null && rightBytes !== null && constantTimeEqual(leftBytes, rightBytes);
}

async function activeRevision(
  db: D1Database,
  workspaceId: string,
): Promise<ActiveRow | null> {
  return db
    .prepare(
      `SELECT v.id AS variant_id,
              v.active_implemented_revision AS implemented_revision
         FROM workspace_view_state s
         JOIN component_variants v
           ON v.workspace_id = s.workspace_id AND v.id = s.active_variant_id
         JOIN implemented_focus_revisions r
           ON r.workspace_id = v.workspace_id
          AND r.variant_id = v.id
          AND r.revision = v.active_implemented_revision
        WHERE s.workspace_id = ?`,
    )
    .bind(workspaceId)
    .first<ActiveRow>();
}

export async function startFocusRehearsal(input: {
  db: D1Database;
  workspaceId: string;
  now: number;
  environment: StartRehearsalInput['environment'];
  admitOperation?: (workspaceId: string) => Promise<void>;
}): Promise<StartedFocusRehearsal> {
  if (!validServerTime(input.now)) {
    throw rehearsalError('INVALID_REHEARSAL', 'The rehearsal input is invalid.', 400);
  }
  const request = startRehearsalInputSchema.safeParse({ environment: input.environment });
  if (!request.success) {
    throw rehearsalError('INVALID_REHEARSAL', 'The rehearsal input is invalid.', 400);
  }
  await input.admitOperation?.(input.workspaceId);
  const active = await activeRevision(input.db, input.workspaceId);
  if (!active) {
    throw rehearsalError('REHEARSAL_UNAVAILABLE', 'The rehearsal is unavailable.', 409);
  }
  const rehearsalSessionId = crypto.randomUUID();
  const expiresAt = input.now + 30;
  const nonceDigest = await sha256Hex(
    `fcs-focus-rehearsal-v1:${base64UrlEncode(randomTokenBytes())}`,
  );
  const result = await input.db
    .prepare(
      `INSERT INTO observation_sessions (
         id, workspace_id, variant_id, implemented_revision, environment,
         nonce_digest, state, created_at, expires_at
       )
       SELECT ?, s.workspace_id, v.id, v.active_implemented_revision, ?, ?,
              'recording', ?, ?
         FROM workspace_view_state s
         JOIN component_variants v
           ON v.workspace_id = s.workspace_id AND v.id = s.active_variant_id
        WHERE s.workspace_id = ? AND v.id = ?
          AND v.active_implemented_revision = ?`,
    )
    .bind(
      rehearsalSessionId,
      request.data.environment,
      nonceDigest,
      input.now,
      expiresAt,
      input.workspaceId,
      active.variant_id,
      active.implemented_revision,
    )
    .run();
  if (!result.success || result.meta.changes !== 2) {
    throw rehearsalError(
      'REHEARSAL_START_FAILED',
      'The rehearsal could not be started.',
      409,
      true,
    );
  }
  return {
    rehearsalSessionId,
    variantId: active.variant_id,
    implementedRevision: active.implemented_revision,
    expiresAt,
    state: 'recording',
  };
}

async function loadSession(
  db: D1Database,
  workspaceId: string,
  rehearsalSessionId: string,
): Promise<SessionRow | null> {
  return db
    .prepare(
      `SELECT s.id, s.variant_id, s.implemented_revision, s.environment,
              s.state, s.created_at, s.expires_at, s.finalized_at,
              s.event_digest, s.manifest_digest, f.event_count
         FROM observation_sessions s
         LEFT JOIN focus_rehearsal_commits f
           ON f.workspace_id = s.workspace_id AND f.session_id = s.id
        WHERE s.workspace_id = ? AND s.id = ?`,
    )
    .bind(workspaceId, rehearsalSessionId)
    .first<SessionRow>();
}

function finalizedResult(
  row: SessionRow,
  idempotentReplay: boolean,
): FinalizedFocusRehearsal {
  if (
    row.manifest_digest === null ||
    row.event_digest === null ||
    row.event_count === null
  ) {
    throw rehearsalError('REHEARSAL_CONFLICT', 'The rehearsal could not be finalized.', 409);
  }
  return {
    rehearsalSessionId: row.id,
    variantId: row.variant_id,
    implementedRevision: row.implemented_revision,
    environment: row.environment,
    manifestDigest: row.manifest_digest,
    eventDigest: row.event_digest,
    eventCount: row.event_count,
    state: 'finalized',
    idempotentReplay,
  };
}

function isReplay(
  row: SessionRow,
  manifestDigest: string,
  eventDigest: string,
  eventCount: number,
): boolean {
  return (
    row.event_count === eventCount &&
    equalDigest(row.manifest_digest, manifestDigest) &&
    equalDigest(row.event_digest, eventDigest)
  );
}

function assertBatch(
  results: D1Result[],
  count: number,
  admissionIndex: number,
): void {
  if (
    results.length !== count ||
    results.some(
      (result, index) =>
        !result.success || result.meta.changes !== (index === admissionIndex ? 2 : 1),
    )
  ) {
    throw new Error('The rehearsal batch returned unexpected row counts.');
  }
}

export async function finalizeFocusRehearsal(input: {
  db: D1Database;
  workspaceId: string;
  rehearsalSessionId: string;
  now: number;
  admitOperation?: (workspaceId: string) => Promise<void>;
  input: FinalizeRehearsalInput | unknown;
}): Promise<FinalizedFocusRehearsal> {
  if (!validServerTime(input.now) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(input.rehearsalSessionId)) {
    throw rehearsalError('INVALID_REHEARSAL', 'The rehearsal input is invalid.', 400);
  }
  const request = finalizeRehearsalInputSchema.safeParse(input.input);
  if (!request.success) {
    throw rehearsalError('INVALID_REHEARSAL', 'The rehearsal input is invalid.', 400);
  }
  const manifestBytes = canonicalRenderedManifest(request.data.manifest);
  const eventBytes = canonicalObservationEvents(request.data.events);
  const [manifestDigest, eventDigest] = await Promise.all([
    sha256Hex(manifestBytes),
    sha256Hex(eventBytes),
  ]);
  const row = await loadSession(
    input.db,
    input.workspaceId,
    input.rehearsalSessionId,
  );
  if (!row) {
    throw rehearsalError('REHEARSAL_NOT_FOUND', 'The rehearsal is unavailable.', 404);
  }
  if (
    request.data.manifest.variantId !== row.variant_id ||
    request.data.manifest.implementedRevision !== row.implemented_revision
  ) {
    throw rehearsalError('INVALID_REHEARSAL', 'The rehearsal input is invalid.', 400);
  }
  if (row.state !== 'recording') {
    if (
      ['finalized', 'verified_pass', 'verified_fail'].includes(row.state) &&
      isReplay(row, manifestDigest, eventDigest, request.data.events.length)
    ) {
      return finalizedResult(row, true);
    }
    throw rehearsalError('REHEARSAL_CONFLICT', 'The rehearsal could not be finalized.', 409);
  }
  await input.admitOperation?.(input.workspaceId);
  if (input.now > row.expires_at) {
    throw rehearsalError('REHEARSAL_EXPIRED', 'The rehearsal has expired.', 409);
  }
  if (
    request.data.events[0]?.eventType !== 'dialog_open' ||
    request.data.events.at(-1)?.eventType !== 'focus_return'
  ) {
    throw rehearsalError('INVALID_REHEARSAL', 'The rehearsal input is invalid.', 400);
  }

  const manifestId = crypto.randomUUID();
  const sequencedEvents = sequenceObservationEvents(request.data.events);
  const statements: D1PreparedStatement[] = [
    input.db
      .prepare(
        `INSERT INTO rendered_manifests (
           id, workspace_id, session_id, manifest_version, target_ids_json,
           tabbable_order_json, dialog_name, dialog_description, open_state,
           role, aria_modal, manifest_hash, created_at
         )
         SELECT ?, s.workspace_id, s.id, ?, ?, ?, ?, ?, 1, 'dialog', 1, ?, ?
           FROM observation_sessions s
          WHERE s.workspace_id = ? AND s.id = ? AND s.state = 'recording'
            AND s.variant_id = ? AND s.implemented_revision = ?
            AND s.expires_at >= ?`,
      )
      .bind(
        manifestId,
        request.data.manifest.manifestVersion,
        JSON.stringify(request.data.manifest.targetIds),
        JSON.stringify(request.data.manifest.tabbableOrder),
        request.data.manifest.dialogName,
        request.data.manifest.dialogDescription,
        manifestDigest,
        input.now,
        input.workspaceId,
        row.id,
        row.variant_id,
        row.implemented_revision,
        input.now,
      ),
    ...sequencedEvents.map((event) =>
      input.db
        .prepare(
          `INSERT INTO observation_events (
             id, workspace_id, session_id, sequence, event_type, target_id,
             key_name, shift_key, close_reason, client_offset_ms, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          input.workspaceId,
          row.id,
          event.sequence,
          event.eventType,
          event.targetId,
          event.eventType === 'keydown' ? event.keyName : null,
          event.eventType === 'keydown' ? Number(event.shiftKey) : null,
          event.eventType === 'dialog_close' ? event.closeReason : null,
          event.clientOffsetMs,
          input.now,
        ),
    ),
    input.db
      .prepare(
        `UPDATE observation_sessions
            SET state = 'finalized', finalized_at = ?, event_digest = ?,
                manifest_digest = ?
          WHERE workspace_id = ? AND id = ? AND state = 'recording'
            AND variant_id = ? AND implemented_revision = ? AND expires_at >= ?`,
      )
      .bind(
        input.now,
        eventDigest,
        manifestDigest,
        input.workspaceId,
        row.id,
        row.variant_id,
        row.implemented_revision,
        input.now,
      ),
    input.db
      .prepare(
        `INSERT INTO focus_rehearsal_commits (
           session_id, workspace_id, variant_id, implemented_revision,
           manifest_digest, event_digest, event_count, finalized_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        row.id,
        input.workspaceId,
        row.variant_id,
        row.implemented_revision,
        manifestDigest,
        eventDigest,
        sequencedEvents.length,
        input.now,
      ),
    input.db
      .prepare(
        `UPDATE observation_sessions
            SET state = CASE WHEN EXISTS (
              SELECT 1 FROM focus_rehearsal_commits f
               WHERE f.workspace_id = observation_sessions.workspace_id
                 AND f.session_id = observation_sessions.id
            ) THEN state ELSE 'package3_invalid' END
          WHERE workspace_id = ? AND id = ?`,
      )
      .bind(input.workspaceId, row.id),
  ];
  try {
    assertBatch(
      await input.db.batch(statements),
      sequencedEvents.length + 4,
      sequencedEvents.length + 2,
    );
  } catch (error) {
    rethrowRateLimitError(error);
    const raced = await loadSession(
      input.db,
      input.workspaceId,
      input.rehearsalSessionId,
    );
    if (raced && isReplay(raced, manifestDigest, eventDigest, sequencedEvents.length)) {
      return finalizedResult(raced, true);
    }
    if (error instanceof FcsError) throw error;
    throw rehearsalError(
      'REHEARSAL_WRITE_FAILED',
      'The rehearsal could not be finalized.',
      500,
      true,
    );
  }
  return finalizedResult(
    {
      ...row,
      state: 'finalized',
      finalized_at: input.now,
      manifest_digest: manifestDigest,
      event_digest: eventDigest,
      event_count: sequencedEvents.length,
    },
    false,
  );
}
