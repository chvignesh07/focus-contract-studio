import {
  canonicalFocusConfiguration,
  implementedFocusConfigurationSchema,
  type ImplementedFocusConfiguration,
} from '../domain/focus-configuration';
import {
  changedFocusFields,
  supportRequirementForField,
} from '../domain/proposal.ts';
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
  verified_at: number;
  commit_id: string;
  audit_id: string;
  projected_count: number;
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
  projectedPrecedentCount: number;
  verifiedAt: string;
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
  projectedPrecedentCount: number,
  verifiedAt: number,
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
    projectedPrecedentCount,
    verifiedAt: new Date(verifiedAt * 1_000).toISOString().replace('.000Z', 'Z'),
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
              r.created_at AS verified_at,
              c.id AS commit_id, a.id AS audit_id,
              (SELECT COUNT(*) FROM runtime_precedent_provenance pp
                WHERE pp.workspace_id = r.workspace_id
                  AND pp.verification_receipt_id = r.id) AS projected_count
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
  return result(
    replay.receipt_id,
    value,
    storedOutput,
    true,
    replay.projected_count,
    replay.verified_at,
  );
}

type ProjectionAuthority = {
  proposal_id: string;
  proposal_configuration_json: string;
  base_configuration_json: string;
  review_decision_id: string;
  application_receipt_id: string;
  variant_id: string;
  variant_slug: string;
};

async function projectionStatements(input: {
  db: D1Database;
  value: VerifierInput;
  receiptId: string;
  overallResult: 'pass' | 'fail';
  now: number;
}): Promise<{ statements: D1PreparedStatement[]; count: number }> {
  if (input.overallResult !== 'pass' || input.value.implementedRevision <= 1) {
    return { statements: [], count: 0 };
  }
  const authority = await input.db.prepare(
    `SELECT p.id AS proposal_id,
            p.configuration_json AS proposal_configuration_json,
            base.configuration_json AS base_configuration_json,
            d.id AS review_decision_id,
            application.id AS application_receipt_id,
            revision.variant_id, variant.slug AS variant_slug
       FROM implemented_focus_revisions revision
       JOIN proposals p
         ON p.workspace_id = revision.workspace_id
        AND p.id = revision.source_proposal_id
        AND p.variant_id = revision.variant_id
        AND p.status = 'applied'
       JOIN implemented_focus_revisions base
         ON base.workspace_id = p.workspace_id
        AND base.variant_id = p.variant_id
        AND base.revision = p.base_implemented_revision
       JOIN application_receipts application
         ON application.workspace_id = revision.workspace_id
        AND application.id = revision.source_receipt_id
        AND application.proposal_id = p.id
        AND application.proposal_hash = p.proposal_hash
        AND application.to_revision = revision.revision
       JOIN review_decisions d
         ON d.workspace_id = p.workspace_id AND d.proposal_id = p.id
        AND d.action = 'approve' AND d.proposal_hash = p.proposal_hash
        AND d.base_implemented_revision = p.base_implemented_revision
        AND d.reviewer_kind = 'ui-mediated'
       JOIN review_commits review_commit
         ON review_commit.workspace_id = d.workspace_id
        AND review_commit.decision_id = d.id
        AND review_commit.proposal_id = p.id
        AND review_commit.action = 'approve'
       JOIN component_variants variant
         ON variant.workspace_id = revision.workspace_id
        AND variant.id = revision.variant_id
        AND variant.active_implemented_revision = revision.revision
      WHERE revision.workspace_id = ? AND revision.variant_id = ?
        AND revision.revision = ?
        AND NOT EXISTS (
          SELECT 1 FROM review_decisions later
           WHERE later.workspace_id = d.workspace_id
             AND later.proposal_id = d.proposal_id
             AND (later.created_at > d.created_at OR
                  (later.created_at = d.created_at AND later.id > d.id))
        )`,
  ).bind(
    input.value.workspaceId,
    input.value.variantId,
    input.value.implementedRevision,
  ).first<ProjectionAuthority>();
  if (!authority) return { statements: [], count: 0 };
  const [before, after] = [
    authority.base_configuration_json,
    authority.proposal_configuration_json,
  ].map((configuration) =>
    implementedFocusConfigurationSchema.parse(JSON.parse(configuration)),
  ) as [ImplementedFocusConfiguration, ImplementedFocusConfiguration];
  const fields = changedFocusFields(before, after);
  if (fields.length === 0) return { statements: [], count: 0 };
  const existing = await input.db.prepare(
    `SELECT COUNT(*) AS count FROM precedent_records
      WHERE workspace_id = ? AND provenance_kind = 'verified-runtime'`,
  ).bind(input.value.workspaceId).first<{ count: number }>();
  if ((existing?.count ?? 0) + fields.length > 999) {
    throw new Error('Runtime precedent capacity is exhausted.');
  }
  const statements: D1PreparedStatement[] = [];
  for (const [index, field] of fields.entries()) {
    const support = supportRequirementForField(field, after);
    const sequence = (existing?.count ?? 0) + index + 1;
    const recordKey = `R${sequence.toString().padStart(3, '0')}`;
    const recordId = crypto.randomUUID();
    const provenanceId = recordId;
    const auditId = crypto.randomUUID();
    const commitId = crypto.randomUUID();
    const contextKey = `focus-contract-studio|modal-dialog|delete-account|${authority.variant_slug}`;
    const edgeTargets = [
      ['context', contextKey],
      ['variant', authority.variant_slug],
      ['use_case', 'delete-account'],
      ['family', 'modal-dialog'],
    ] as const;
    statements.push(
      input.db.prepare(
        `INSERT INTO precedent_records (
           id, workspace_id, record_key, dataset_version, scope_kind, scope_key,
           behavior, normalized_outcome_key, status, valid_from, valid_until,
           rationale, tags_json, provenance_kind, provenance_ref, created_at
         )
         SELECT ?, r.workspace_id, ?, 'fcs-runtime-v1', 'context', ?, ?, ?,
                'active', ?, NULL, ?, ?, 'verified-runtime', r.id, ?
           FROM verification_receipts r
          WHERE r.workspace_id = ? AND r.id = ? AND r.result = 'pass'
            AND r.implemented_revision = ? AND r.active_at_verification = 1`,
      ).bind(
        recordId, recordKey, contextKey, support.behavior,
        support.normalizedOutcomeKey, input.now,
        `Verified runtime decision for ${support.behavior} in delete-account.`,
        JSON.stringify(['verified-runtime', field, authority.variant_slug]),
        input.now, input.value.workspaceId, input.receiptId,
        input.value.implementedRevision,
      ),
      input.db.prepare(
        `INSERT INTO precedent_retrieval_profiles (
           record_id, workspace_id, product, component_family, use_case,
           variants_json, intent, risk, source_status, hostile,
           mismatch_tags_json, shape_tags_json, relationships_json,
           supersedes_record_key
         )
         SELECT p.id, p.workspace_id, 'focus-contract-studio', 'modal-dialog',
                'delete-account', ?, 'destructive-confirmation', 'irreversible',
                'active', 0, ?, ?, ?, NULL
           FROM precedent_records p
          WHERE p.workspace_id = ? AND p.id = ?`,
      ).bind(
        JSON.stringify([authority.variant_slug]),
        JSON.stringify(['initial-focus-destructive']),
        JSON.stringify(['reason-input-present']),
        JSON.stringify([
          { type: 'applies-to', target: `context:${contextKey}` },
          { type: 'applies-to', target: `variant:${authority.variant_slug}` },
          { type: 'applies-to', target: 'use-case:delete-account' },
          { type: 'applies-to', target: 'family:modal-dialog' },
        ]),
        input.value.workspaceId, recordId,
      ),
      ...edgeTargets.map(([targetKind, targetKey]) => input.db.prepare(
        `INSERT INTO precedent_subject_edges (
           id, workspace_id, record_id, target_kind, target_key, edge_type, weight
         )
         SELECT ?, p.workspace_id, p.id, ?, ?, 'applies-to', 1000
           FROM precedent_records p
          WHERE p.workspace_id = ? AND p.id = ?`,
      ).bind(
        crypto.randomUUID(), targetKind, targetKey,
        input.value.workspaceId, recordId,
      )),
      input.db.prepare(
        `INSERT INTO runtime_precedent_provenance (
           record_id, workspace_id, proposal_id, review_decision_id,
           application_receipt_id, verification_receipt_id, variant_id,
           changed_field, behavior, normalized_outcome_key, created_at
         )
         SELECT ?, r.workspace_id, ?, ?, ?, r.id, r.variant_id, ?, ?, ?, ?
           FROM verification_receipts r
          WHERE r.workspace_id = ? AND r.id = ? AND r.result = 'pass'`,
      ).bind(
        provenanceId, authority.proposal_id, authority.review_decision_id,
        authority.application_receipt_id, field, support.behavior,
        support.normalizedOutcomeKey, input.now,
        input.value.workspaceId, input.receiptId,
      ),
      input.db.prepare(
        `INSERT INTO audit_events (
           id, workspace_id, actor_kind, action, target_kind, target_id,
           result, correlation_id, safe_detail_json, occurred_at
         )
         SELECT ?, p.workspace_id, 'system', 'precedent.projected',
                'precedent', p.id, 'success', ?, ?, ?
           FROM runtime_precedent_provenance provenance
           JOIN precedent_records p
             ON p.workspace_id = provenance.workspace_id
            AND p.id = provenance.record_id
          WHERE provenance.workspace_id = ? AND provenance.record_id = ?`,
      ).bind(
        auditId, commitId,
        JSON.stringify({ behavior: support.behavior, outcomeKey: support.normalizedOutcomeKey }),
        input.now, input.value.workspaceId, recordId,
      ),
      input.db.prepare(
        `INSERT INTO precedent_projection_commits (
           id, workspace_id, verification_receipt_id, record_id, created_at
         ) VALUES (?, ?, ?, ?, ?)`,
      ).bind(commitId, input.value.workspaceId, input.receiptId, recordId, input.now),
    );
  }
  return { statements, count: fields.length };
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
  const projection = await projectionStatements({
    db: input.db,
    value,
    receiptId,
    overallResult: output.overallResult,
    now: input.now,
  });
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
    ...projection.statements,
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
    const results = await input.db.batch(statements);
    if (
      results.length !== statements.length ||
      results.some((entry) => !entry.success || entry.meta.changes !== 1)
    ) {
      throw new Error('The verification batch returned unexpected row counts.');
    }
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
  return result(receiptId, value, output, false, projection.count, input.now);
}
