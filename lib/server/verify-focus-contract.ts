import {
  canonicalFocusConfiguration,
  implementedFocusConfigurationSchema,
} from '../domain/focus-configuration';
import {
  CHECK_BEHAVIORS,
  VERIFIER_VERSION,
  canonicalVerifierOutput,
  verifyFocusEvents,
  type VerifierCheck,
  type VerifierInput,
  type VerifierOutput,
} from '../domain/focus-event-verifier';
import {
  canonicalObservationEvents,
  canonicalRenderedManifest,
  finalizeRehearsalInputSchema,
  observationEventSchema,
  renderedManifestSchema,
  type ObservationEvent,
  type RenderedManifest,
  type SequencedObservationEvent,
} from '../domain/focus-rehearsal';
import { constantTimeEqual, hexToBytes, sha256Hex } from './crypto';
import { FcsError } from './errors';

type EvidenceRow = {
  session_id: string;
  variant_id: string;
  implemented_revision: number;
  environment: 'browser' | 'playwright';
  state: 'finalized' | 'verified_pass' | 'verified_fail';
  expires_at: number;
  event_digest: string;
  manifest_digest: string;
  event_count: number;
  commit_event_digest: string;
  commit_manifest_digest: string;
  manifest_version: string;
  target_ids_json: string;
  tabbable_order_json: string;
  dialog_name: string;
  dialog_description: string;
  open_state: number;
  role: string;
  aria_modal: number;
  manifest_hash: string;
  configuration_json: string;
  active_implemented_revision: number;
};

type EventRow = {
  sequence: number;
  event_type: string;
  target_id: string;
  key_name: string | null;
  shift_key: number | null;
  close_reason: string | null;
  client_offset_ms: number;
};

type ReplayRow = {
  receipt_id: string;
  result: 'pass' | 'fail';
  event_digest: string;
  manifest_digest: string;
  environment: 'browser' | 'playwright';
  verifier_output_hash: string;
  implemented_revision: number;
  commit_id: string;
  audit_id: string;
};

type StoredCheck = {
  behavior: VerifierCheck['behavior'];
  result: VerifierCheck['result'];
  evidence_sequences_json: string;
};

export type VerificationResult = {
  receiptId: string;
  implementedRevision: number;
  environment: 'browser' | 'playwright';
  verifierVersion: typeof VERIFIER_VERSION;
  overallResult: 'pass' | 'fail';
  checks: VerifierCheck[];
  manifest: Pick<
    RenderedManifest,
    'dialogName' | 'dialogDescription' | 'role' | 'ariaModal' | 'open'
  >;
  manifestDigest8: string;
  eventDigest8: string;
  idempotentReplay: boolean;
};

function notFound(): FcsError {
  return new FcsError(
    'VERIFICATION_NOT_FOUND',
    'The rehearsal is unavailable for verification.',
    404,
  );
}

function invalidEvidence(): FcsError {
  return new FcsError(
    'VERIFICATION_INVALID',
    'The rehearsal evidence is invalid.',
    409,
  );
}

function equalDigest(left: string, right: string): boolean {
  const leftBytes = hexToBytes(left);
  const rightBytes = hexToBytes(right);
  return leftBytes !== null && rightBytes !== null && constantTimeEqual(leftBytes, rightBytes);
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw invalidEvidence();
  }
}

function eventFromRow(row: EventRow): ObservationEvent {
  let candidate: unknown;
  if (row.event_type === 'keydown') {
    candidate = {
      eventType: row.event_type,
      targetId: row.target_id,
      keyName: row.key_name,
      shiftKey: row.shift_key === 1,
      clientOffsetMs: row.client_offset_ms,
    };
  } else if (row.event_type === 'dialog_close') {
    candidate = {
      eventType: row.event_type,
      targetId: row.target_id,
      closeReason: row.close_reason,
      clientOffsetMs: row.client_offset_ms,
    };
  } else {
    candidate = {
      eventType: row.event_type,
      targetId: row.target_id,
      clientOffsetMs: row.client_offset_ms,
    };
  }
  const parsed = observationEventSchema.safeParse(candidate);
  if (!parsed.success) throw invalidEvidence();
  return parsed.data;
}

async function loadVerifierInput(input: {
  db: D1Database;
  workspaceId: string;
  rehearsalSessionId: string;
  implementedRevision: number;
  now: number;
}): Promise<{ verifierInput: VerifierInput; evidence: EvidenceRow }> {
  const evidence = await input.db
    .prepare(
      `SELECT s.id AS session_id, s.variant_id, s.implemented_revision,
              s.environment, s.state, s.expires_at,
              s.event_digest, s.manifest_digest,
              f.event_count, f.event_digest AS commit_event_digest,
              f.manifest_digest AS commit_manifest_digest,
              m.manifest_version, m.target_ids_json, m.tabbable_order_json,
              m.dialog_name, m.dialog_description, m.open_state, m.role,
              m.aria_modal, m.manifest_hash, r.configuration_json,
              v.active_implemented_revision
         FROM observation_sessions s
         JOIN focus_rehearsal_commits f
           ON f.workspace_id = s.workspace_id AND f.session_id = s.id
         JOIN rendered_manifests m
           ON m.workspace_id = s.workspace_id AND m.session_id = s.id
         JOIN component_variants v
           ON v.workspace_id = s.workspace_id AND v.id = s.variant_id
         JOIN workspace_view_state view
           ON view.workspace_id = v.workspace_id AND view.active_variant_id = v.id
         JOIN implemented_focus_revisions r
           ON r.workspace_id = s.workspace_id AND r.variant_id = s.variant_id
          AND r.revision = s.implemented_revision
        WHERE s.workspace_id = ? AND s.id = ? AND s.implemented_revision = ?
          AND s.state IN ('finalized', 'verified_pass', 'verified_fail')`,
    )
    .bind(input.workspaceId, input.rehearsalSessionId, input.implementedRevision)
    .first<EvidenceRow>();
  if (!evidence) throw notFound();
  if (
    evidence.environment !== 'browser' &&
    evidence.environment !== 'playwright'
  ) {
    throw invalidEvidence();
  }
  const manifest = renderedManifestSchema.safeParse({
    manifestVersion: evidence.manifest_version,
    targetIds: parseJson(evidence.target_ids_json),
    tabbableOrder: parseJson(evidence.tabbable_order_json),
    dialogName: evidence.dialog_name,
    dialogDescription: evidence.dialog_description,
    open: evidence.open_state === 1,
    role: evidence.role,
    ariaModal: evidence.aria_modal === 1,
    variantId: evidence.variant_id,
    implementedRevision: evidence.implemented_revision,
  });
  const configuration = implementedFocusConfigurationSchema.safeParse(
    parseJson(evidence.configuration_json),
  );
  if (!manifest.success || !configuration.success) throw invalidEvidence();
  if (canonicalFocusConfiguration(configuration.data) !== evidence.configuration_json) {
    throw invalidEvidence();
  }
  const eventRows = await input.db
    .prepare(
      `SELECT sequence, event_type, target_id, key_name, shift_key,
              close_reason, client_offset_ms
         FROM observation_events
        WHERE workspace_id = ? AND session_id = ? ORDER BY sequence`,
    )
    .bind(input.workspaceId, input.rehearsalSessionId)
    .all<EventRow>();
  if (
    eventRows.results.length !== evidence.event_count ||
    eventRows.results.some((row, index) => row.sequence !== index + 1)
  ) {
    throw invalidEvidence();
  }
  const events = eventRows.results.map(eventFromRow);
  if (!finalizeRehearsalInputSchema.safeParse({ manifest: manifest.data, events }).success) {
    throw invalidEvidence();
  }
  const [manifestDigest, eventDigest] = await Promise.all([
    sha256Hex(canonicalRenderedManifest(manifest.data)),
    sha256Hex(canonicalObservationEvents(events)),
  ]);
  if (
    !equalDigest(manifestDigest, evidence.manifest_digest) ||
    !equalDigest(manifestDigest, evidence.manifest_hash) ||
    !equalDigest(manifestDigest, evidence.commit_manifest_digest) ||
    !equalDigest(eventDigest, evidence.event_digest) ||
    !equalDigest(eventDigest, evidence.commit_event_digest)
  ) {
    throw invalidEvidence();
  }
  return {
    evidence,
    verifierInput: {
      rehearsalSessionId: evidence.session_id,
      workspaceId: input.workspaceId,
      variantId: evidence.variant_id,
      implementedRevision: evidence.implemented_revision,
      environment: evidence.environment,
      manifestDigest,
      eventDigest,
      configuration: configuration.data,
      manifest: manifest.data,
      events: events.map((event, index) => ({
        ...event,
        sequence: index + 1,
      })) as SequencedObservationEvent[],
    },
  };
}

function result(
  receiptId: string,
  input: VerifierInput,
  output: VerifierOutput,
  idempotentReplay: boolean,
): VerificationResult {
  return {
    receiptId,
    implementedRevision: input.implementedRevision,
    environment: input.environment,
    verifierVersion: output.verifierVersion,
    overallResult: output.overallResult,
    checks: output.checks,
    manifest: {
      dialogName: input.manifest.dialogName,
      dialogDescription: input.manifest.dialogDescription,
      role: input.manifest.role,
      ariaModal: input.manifest.ariaModal,
      open: input.manifest.open,
    },
    manifestDigest8: input.manifestDigest.slice(0, 8),
    eventDigest8: input.eventDigest.slice(0, 8),
    idempotentReplay,
  };
}

async function loadReplay(input: {
  db: D1Database;
  verifierInput: VerifierInput;
  output: VerifierOutput;
  outputHash: string;
}): Promise<VerificationResult | null> {
  const value = input.verifierInput;
  const replay = await input.db
    .prepare(
      `SELECT r.id AS receipt_id, r.result, r.event_digest, r.manifest_digest,
              r.environment, r.verifier_output_hash, r.implemented_revision,
              c.id AS commit_id, a.id AS audit_id
         FROM verification_receipts r
         JOIN verification_guards g
           ON g.workspace_id = r.workspace_id
          AND g.observation_session_id = r.observation_session_id
          AND g.verifier_version = r.verifier_version
         JOIN verification_commits c
           ON c.workspace_id = r.workspace_id AND c.receipt_id = r.id
          AND c.guard_id = g.id
         JOIN audit_events a
           ON a.workspace_id = c.workspace_id AND a.id = c.audit_event_id
          AND a.action = 'verification.completed' AND a.result = 'success'
        WHERE r.workspace_id = ? AND r.observation_session_id = ?
          AND r.verifier_version = ?`,
    )
    .bind(value.workspaceId, value.rehearsalSessionId, VERIFIER_VERSION)
    .first<ReplayRow>();
  if (!replay) return null;
  if (
    replay.implemented_revision !== value.implementedRevision ||
    replay.environment !== value.environment ||
    replay.result !== input.output.overallResult ||
    !equalDigest(replay.event_digest, value.eventDigest) ||
    !equalDigest(replay.manifest_digest, value.manifestDigest) ||
    !equalDigest(replay.verifier_output_hash, input.outputHash)
  ) {
    throw new FcsError(
      'VERIFICATION_CONFLICT',
      'The verification already has a different immutable result.',
      409,
    );
  }
  const stored = await input.db
    .prepare(
      `SELECT behavior, result, evidence_sequences_json
         FROM verification_checks
        WHERE workspace_id = ? AND verification_receipt_id = ?
        ORDER BY CASE behavior
          WHEN 'initialFocus' THEN 1 WHEN 'focusOrder' THEN 2
          WHEN 'trapTab' THEN 3 WHEN 'trapShiftTab' THEN 4
          WHEN 'escapeAction' THEN 5 WHEN 'returnFocus' THEN 6 END`,
    )
    .bind(value.workspaceId, replay.receipt_id)
    .all<StoredCheck>();
  if (stored.results.length !== 6) throw invalidEvidence();
  const checks = stored.results.map((check, index) => {
    const evidenceSequences = parseJson(check.evidence_sequences_json);
    if (
      check.behavior !== CHECK_BEHAVIORS[index] ||
      !Array.isArray(evidenceSequences) ||
      evidenceSequences.some((sequence) => !Number.isSafeInteger(sequence))
    ) {
      throw invalidEvidence();
    }
    return {
      behavior: check.behavior,
      result: check.result,
      evidenceSequences,
    } as VerifierCheck;
  });
  const storedOutput: VerifierOutput = {
    verifierVersion: VERIFIER_VERSION,
    overallResult: replay.result,
    checks,
  };
  if (
    !equalDigest(
      await sha256Hex(canonicalVerifierOutput(storedOutput)),
      input.outputHash,
    )
  ) {
    throw invalidEvidence();
  }
  return result(replay.receipt_id, value, storedOutput, true);
}

function assertBatch(results: D1Result[]): void {
  const changes = results.map((entry) => entry.meta.changes);
  if (
    results.length !== 11 ||
    results.some((entry) => !entry.success) ||
    changes.some((value) => value !== 1)
  ) {
    throw new Error('The verification batch returned unexpected row counts.');
  }
}

export async function verifyFocusContract(input: {
  db: D1Database;
  workspaceId: string;
  rehearsalSessionId: string;
  implementedRevision: number;
  now: number;
}): Promise<VerificationResult> {
  if (
    !Number.isSafeInteger(input.now) ||
    input.now < 0 ||
    !Number.isSafeInteger(input.implementedRevision) ||
    input.implementedRevision < 1 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(input.rehearsalSessionId)
  ) {
    throw notFound();
  }
  const loaded = await loadVerifierInput(input);
  if (
    loaded.evidence.state === 'finalized' &&
    input.now > loaded.evidence.expires_at
  ) {
    throw notFound();
  }
  const output = verifyFocusEvents(loaded.verifierInput);
  const outputHash = await sha256Hex(canonicalVerifierOutput(output));
  const replay = await loadReplay({
    db: input.db,
    verifierInput: loaded.verifierInput,
    output,
    outputHash,
  });
  if (replay) return replay;
  if (
    loaded.evidence.active_implemented_revision !==
    loaded.verifierInput.implementedRevision
  ) {
    throw notFound();
  }
  if (loaded.evidence.state !== 'finalized') throw invalidEvidence();

  const guardId = crypto.randomUUID();
  const receiptId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const commitId = crypto.randomUUID();
  const value = loaded.verifierInput;
  const statements: D1PreparedStatement[] = [
    input.db.prepare(
      `INSERT INTO verification_guards (
         id, workspace_id, observation_session_id, variant_id,
         implemented_revision, environment, verifier_version, result,
         event_digest, manifest_digest, active_at_verification,
         verifier_output_hash, created_at
       )
       SELECT ?, s.workspace_id, s.id, s.variant_id, s.implemented_revision,
              s.environment, ?, ?, s.event_digest, s.manifest_digest, 1, ?, ?
         FROM observation_sessions s
         JOIN focus_rehearsal_commits f
           ON f.workspace_id = s.workspace_id AND f.session_id = s.id
          AND f.event_digest = s.event_digest
          AND f.manifest_digest = s.manifest_digest
         JOIN component_variants v
           ON v.workspace_id = s.workspace_id AND v.id = s.variant_id
          AND v.active_implemented_revision = s.implemented_revision
         JOIN workspace_view_state view
           ON view.workspace_id = v.workspace_id AND view.active_variant_id = v.id
        WHERE s.workspace_id = ? AND s.id = ? AND s.variant_id = ?
          AND s.implemented_revision = ? AND s.state = 'finalized'
          AND s.environment = ? AND s.event_digest = ? AND s.manifest_digest = ?
          AND s.expires_at >= ?
          AND NOT EXISTS (
            SELECT 1 FROM verification_guards prior
             WHERE prior.workspace_id = s.workspace_id
               AND prior.observation_session_id = s.id
               AND prior.verifier_version = ?
          )`,
    ).bind(
      guardId,
      VERIFIER_VERSION,
      output.overallResult,
      outputHash,
      input.now,
      value.workspaceId,
      value.rehearsalSessionId,
      value.variantId,
      value.implementedRevision,
      value.environment,
      value.eventDigest,
      value.manifestDigest,
      input.now,
      VERIFIER_VERSION,
    ),
    input.db.prepare(
      `INSERT INTO verification_receipts (
         id, workspace_id, observation_session_id, variant_id,
         implemented_revision, verifier_version, result, event_digest,
         manifest_digest, active_at_verification, created_at, environment,
         verifier_output_hash
       )
       SELECT ?, g.workspace_id, g.observation_session_id, g.variant_id,
              g.implemented_revision, g.verifier_version, g.result,
              g.event_digest, g.manifest_digest, g.active_at_verification,
              g.created_at, g.environment, g.verifier_output_hash
         FROM verification_guards g
        WHERE g.workspace_id = ? AND g.id = ?`,
    ).bind(receiptId, value.workspaceId, guardId),
    ...output.checks.map((check) =>
      input.db.prepare(
         `INSERT INTO verification_checks (
           id, workspace_id, verification_receipt_id, behavior, result,
           evidence_sequences_json, verifier_output_hash
         )
         SELECT ?, g.workspace_id, r.id, ?, ?, ?, g.verifier_output_hash
           FROM verification_guards g
           JOIN verification_receipts r
             ON r.workspace_id = g.workspace_id
            AND r.observation_session_id = g.observation_session_id
            AND r.verifier_version = g.verifier_version
          WHERE g.workspace_id = ? AND g.id = ? AND r.id = ?`,
      ).bind(
        crypto.randomUUID(),
        check.behavior,
        check.result,
        JSON.stringify(check.evidenceSequences),
        value.workspaceId,
        guardId,
        receiptId,
      ),
    ),
    input.db.prepare(
      `INSERT INTO audit_events (
         id, workspace_id, actor_kind, action, target_kind, target_id,
         result, correlation_id, safe_detail_json, occurred_at
       )
       SELECT ?, g.workspace_id, 'system', 'verification.completed',
              'verification', r.id, 'success', g.id, ?, g.created_at
         FROM verification_guards g
         JOIN verification_receipts r
           ON r.workspace_id = g.workspace_id
          AND r.observation_session_id = g.observation_session_id
          AND r.verifier_version = g.verifier_version
        WHERE g.workspace_id = ? AND g.id = ? AND r.id = ?`,
    ).bind(
      auditId,
      JSON.stringify({
        environment: value.environment,
        verifierVersion: VERIFIER_VERSION,
        result: output.overallResult,
      }),
      value.workspaceId,
      guardId,
      receiptId,
    ),
    input.db.prepare(
      `INSERT INTO verification_commits (
         id, workspace_id, guard_id, receipt_id, audit_event_id, created_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(commitId, value.workspaceId, guardId, receiptId, auditId, input.now),
    input.db.prepare(
      `UPDATE observation_sessions
          SET state = CASE WHEN EXISTS (
            SELECT 1 FROM verification_commits c
             WHERE c.workspace_id = observation_sessions.workspace_id
               AND c.receipt_id = ? AND c.guard_id = ?
          ) THEN CASE ? WHEN 'pass' THEN 'verified_pass' ELSE 'verified_fail' END
          ELSE 'package3_invalid' END
        WHERE workspace_id = ? AND id = ? AND state = 'finalized'`,
    ).bind(
      receiptId,
      guardId,
      output.overallResult,
      value.workspaceId,
      value.rehearsalSessionId,
    ),
  ];
  try {
    assertBatch(await input.db.batch(statements));
  } catch {
    const raced = await loadReplay({
      db: input.db,
      verifierInput: value,
      output,
      outputHash,
    });
    if (raced) return raced;
    throw new FcsError(
      'VERIFICATION_WRITE_FAILED',
      'The verification could not be completed.',
      500,
      true,
    );
  }
  return result(receiptId, value, output, false);
}
