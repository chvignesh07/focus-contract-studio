import { z } from 'zod';

import { canonicalFocusConfiguration } from '../domain/focus-configuration';
import { sha256Hex } from './crypto';
import { FcsError } from './errors';

export { INITIAL_FOCUS_MANIFEST } from '../domain/initial-focus-manifest';

const manifestSchema = z
  .object({
    targetIds: z.tuple([
      z.literal('dialog-title'),
      z.literal('reason-input'),
      z.literal('cancel-button'),
      z.literal('delete-button'),
    ]),
    tabbableOrder: z.tuple([
      z.literal('reason-input'),
      z.literal('cancel-button'),
      z.literal('delete-button'),
    ]),
    dialogName: z.literal('Delete account'),
    dialogDescription: z.literal(
      'Deleting your account is permanent. You can optionally tell us why.',
    ),
    role: z.literal('dialog'),
    ariaModal: z.literal(true),
    open: z.literal(true),
  })
  .strict();

const firstTargetSchema = z.enum([
  'dialog-title',
  'reason-input',
  'cancel-button',
  'delete-button',
]);

export const initialFocusObservationPayloadSchema = z
  .object({
    firstTargetId: firstTargetSchema,
    clientOffsetMs: z.number().int().min(0).max(30_000),
    manifest: manifestSchema,
  })
  .strict();

export type InitialFocusManifest = z.infer<typeof manifestSchema>;

type ActiveRevisionRow = {
  variant_id: string;
  slug: 'delete-account-standard' | 'delete-account-danger-emphasis';
  implemented_revision: number;
  configuration_json: string;
};

type ExistingObservationRow = {
  session_id: string;
  first_target_id: 'dialog-title' | 'reason-input' | 'cancel-button' | 'delete-button';
  manifest_digest: string;
  event_digest: string;
};

type ObservationResult = {
  rehearsalSessionId: string;
  variant: ActiveRevisionRow['slug'];
  implementedRevision: number;
  observedInitialFocus: ExistingObservationRow['first_target_id'];
  manifestDigest: string;
  eventDigest: string;
  trust: 'untrusted-browser-telemetry';
};

function observationFailure(): FcsError {
  return new FcsError(
    'OBSERVATION_INVALID',
    'The opening observation does not match the rendered revision.',
    409,
  );
}

function canonicalManifest(manifest: InitialFocusManifest): string {
  return JSON.stringify({
    targetIds: manifest.targetIds,
    tabbableOrder: manifest.tabbableOrder,
    dialogName: manifest.dialogName,
    dialogDescription: manifest.dialogDescription,
    role: manifest.role,
    ariaModal: manifest.ariaModal,
    open: manifest.open,
  });
}

function assertBatch(results: D1Result[]): void {
  if (
    results.length !== 6 ||
    results.some((result) => !result.success || result.meta.changes !== 1)
  ) {
    throw new Error('The opening observation batch was incomplete.');
  }
}

async function existingObservation(
  db: D1Database,
  workspaceId: string,
  active: ActiveRevisionRow,
): Promise<ExistingObservationRow | null> {
  return db
    .prepare(
      `SELECT c.session_id, c.first_target_id,
              s.manifest_digest, s.event_digest
         FROM initial_focus_observation_commits c
         JOIN observation_sessions s
           ON s.workspace_id = c.workspace_id AND s.id = c.session_id
        WHERE c.workspace_id = ? AND s.variant_id = ?
          AND s.implemented_revision = ?
          AND s.state IN ('finalized', 'verified_pass', 'verified_fail')
        ORDER BY c.created_at, c.session_id
        LIMIT 1`,
    )
    .bind(workspaceId, active.variant_id, active.implemented_revision)
    .first<ExistingObservationRow>();
}

function observationResult(
  active: ActiveRevisionRow,
  row: ExistingObservationRow,
): ObservationResult {
  return {
    rehearsalSessionId: row.session_id,
    variant: active.slug,
    implementedRevision: active.implemented_revision,
    observedInitialFocus: row.first_target_id,
    manifestDigest: row.manifest_digest,
    eventDigest: row.event_digest,
    trust: 'untrusted-browser-telemetry',
  };
}

export async function commitInitialFocusObservation(input: {
  db: D1Database;
  workspaceId: string;
  now: number;
  environment: 'browser' | 'playwright';
  firstTargetId: 'dialog-title' | 'reason-input' | 'cancel-button' | 'delete-button';
  clientOffsetMs: number;
  manifest: unknown;
}): Promise<ObservationResult> {
  if (
    !Number.isSafeInteger(input.now) ||
    input.now < 0 ||
    !Number.isSafeInteger(input.clientOffsetMs) ||
    input.clientOffsetMs < 0 ||
    input.clientOffsetMs > 30_000
  ) {
    throw observationFailure();
  }
  const manifest = manifestSchema.safeParse(input.manifest);
  const firstTarget = firstTargetSchema.safeParse(input.firstTargetId);
  if (!manifest.success || !firstTarget.success) throw observationFailure();

  const active = await input.db
    .prepare(
      `SELECT v.id AS variant_id, v.slug,
              v.active_implemented_revision AS implemented_revision,
              r.configuration_json
         FROM workspace_view_state s
         JOIN component_variants v
           ON v.workspace_id = s.workspace_id AND v.id = s.active_variant_id
         JOIN implemented_focus_revisions r
           ON r.workspace_id = v.workspace_id
          AND r.variant_id = v.id
          AND r.revision = v.active_implemented_revision
        WHERE s.workspace_id = ?`,
    )
    .bind(input.workspaceId)
    .first<ActiveRevisionRow>();
  if (!active) throw observationFailure();
  let configuredInitialFocus: string;
  try {
    configuredInitialFocus = JSON.parse(
      canonicalFocusConfiguration(JSON.parse(active.configuration_json)),
    ).initialFocus as string;
  } catch {
    throw observationFailure();
  }
  if (firstTarget.data !== configuredInitialFocus) throw observationFailure();
  const replay = await existingObservation(
    input.db,
    input.workspaceId,
    active,
  );
  if (replay) return observationResult(active, replay);

  const sessionId = crypto.randomUUID();
  const manifestId = crypto.randomUUID();
  const firstEventId = crypto.randomUUID();
  const focusEventId = crypto.randomUUID();
  const manifestJson = canonicalManifest(manifest.data);
  const manifestDigest = await sha256Hex(manifestJson);
  const eventsJson = JSON.stringify([
    {
      sequence: 1,
      eventType: 'dialog_open',
      targetId: 'delete-trigger',
      clientOffsetMs: 0,
    },
    {
      sequence: 2,
      eventType: 'focusin',
      targetId: firstTarget.data,
      clientOffsetMs: input.clientOffsetMs,
    },
  ]);
  const eventDigest = await sha256Hex(eventsJson);
  const nonceDigest = await sha256Hex(
    `fcs-initial-focus-observation-v1:${sessionId}:${input.workspaceId}:${input.now}`,
  );

  try {
    const results = await input.db.batch([
      input.db
        .prepare(
        `INSERT INTO observation_sessions (
           id, workspace_id, variant_id, implemented_revision, environment,
           nonce_digest, state, created_at, expires_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'recording', ?, ?)`,
      )
        .bind(
        sessionId,
        input.workspaceId,
        active.variant_id,
        active.implemented_revision,
        input.environment,
        nonceDigest,
        input.now,
        input.now + 300,
      ),
      input.db
        .prepare(
        `INSERT INTO rendered_manifests (
           id, workspace_id, session_id, manifest_version, target_ids_json,
           tabbable_order_json, dialog_name, dialog_description, open_state,
           role, aria_modal, manifest_hash, created_at
         ) VALUES (?, ?, ?, 'focus-manifest-v1', ?, ?, ?, ?, 1, 'dialog', 1, ?, ?)`,
      )
        .bind(
        manifestId,
        input.workspaceId,
        sessionId,
        JSON.stringify(manifest.data.targetIds),
        JSON.stringify(manifest.data.tabbableOrder),
        manifest.data.dialogName,
        manifest.data.dialogDescription,
        manifestDigest,
        input.now,
      ),
      input.db
        .prepare(
        `INSERT INTO observation_events (
           id, workspace_id, session_id, sequence, event_type, target_id,
           key_name, shift_key, close_reason, client_offset_ms, created_at
         ) VALUES (?, ?, ?, 1, 'dialog_open', 'delete-trigger', NULL, NULL, NULL, 0, ?)`,
      )
        .bind(firstEventId, input.workspaceId, sessionId, input.now),
      input.db
        .prepare(
        `INSERT INTO observation_events (
           id, workspace_id, session_id, sequence, event_type, target_id,
           key_name, shift_key, close_reason, client_offset_ms, created_at
         ) VALUES (?, ?, ?, 2, 'focusin', ?, NULL, NULL, NULL, ?, ?)`,
      )
        .bind(
        focusEventId,
        input.workspaceId,
        sessionId,
        firstTarget.data,
        input.clientOffsetMs,
        input.now,
      ),
      input.db
        .prepare(
        `UPDATE observation_sessions
            SET state = 'finalized', finalized_at = ?, event_digest = ?,
                manifest_digest = ?
          WHERE workspace_id = ? AND id = ? AND state = 'recording'`,
      )
        .bind(
        input.now,
        eventDigest,
        manifestDigest,
        input.workspaceId,
        sessionId,
      ),
      input.db
        .prepare(
        `INSERT INTO initial_focus_observation_commits (
           session_id, workspace_id, first_target_id, created_at
         ) VALUES (?, ?, ?, ?)`,
      )
        .bind(sessionId, input.workspaceId, firstTarget.data, input.now),
    ]);
    assertBatch(results);
  } catch (error) {
    const raced = await existingObservation(
      input.db,
      input.workspaceId,
      active,
    );
    if (raced) return observationResult(active, raced);
    throw error;
  }

  return {
    rehearsalSessionId: sessionId,
    variant: active.slug,
    implementedRevision: active.implemented_revision,
    observedInitialFocus: firstTarget.data,
    manifestDigest,
    eventDigest,
    trust: 'untrusted-browser-telemetry',
  };
}
