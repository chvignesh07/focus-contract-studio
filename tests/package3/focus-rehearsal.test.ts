import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import {
  commitInitialFocusObservation,
  INITIAL_FOCUS_MANIFEST,
} from '../../lib/server/initial-focus-observation';
import {
  finalizeFocusRehearsal,
  startFocusRehearsal,
} from '../../lib/server/focus-rehearsal';
import { bootstrapWorkspace } from '../../lib/server/workspaces';

const now = 1_788_200_000;
const secrets = {
  sessionSecret: 'package3-test-session-secret-material-32-bytes-minimum',
  csrfSecret: 'package3-test-csrf-secret-material-32-bytes-minimum',
};

async function workspace(tokenByte = 61) {
  return bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now,
    tokenBytes: new Uint8Array(32).fill(tokenByte),
    ...secrets,
  });
}

async function activeBinding(workspaceId: string) {
  return (await env.DB.prepare(
    `SELECT v.id AS variant_id, v.active_implemented_revision AS revision
       FROM workspace_view_state s
       JOIN component_variants v
         ON v.workspace_id = s.workspace_id AND v.id = s.active_variant_id
      WHERE s.workspace_id = ?`,
  )
    .bind(workspaceId)
    .first<{ variant_id: string; revision: number }>())!;
}

function fullRehearsal(variantId: string, implementedRevision = 1) {
  return {
    manifest: {
      manifestVersion: 'focus-manifest-v1' as const,
      targetIds: [
        'delete-trigger' as const,
        'dialog-title' as const,
        'reason-input' as const,
        'cancel-button' as const,
        'delete-button' as const,
      ],
      tabbableOrder: [
        'reason-input' as const,
        'cancel-button' as const,
        'delete-button' as const,
      ],
      dialogName: 'Delete account' as const,
      dialogDescription:
        'Deleting your account is permanent. You can optionally tell us why.' as const,
      role: 'dialog' as const,
      ariaModal: true as const,
      open: true as const,
      variantId,
      implementedRevision,
    },
    events: [
      { eventType: 'dialog_open' as const, targetId: 'delete-trigger' as const, clientOffsetMs: 0 },
      { eventType: 'focusin' as const, targetId: 'delete-button' as const, clientOffsetMs: 1 },
      { eventType: 'keydown' as const, targetId: 'delete-button' as const, keyName: 'Tab' as const, shiftKey: false, clientOffsetMs: 2 },
      { eventType: 'focusin' as const, targetId: 'reason-input' as const, clientOffsetMs: 3 },
      { eventType: 'keydown' as const, targetId: 'reason-input' as const, keyName: 'Tab' as const, shiftKey: false, clientOffsetMs: 4 },
      { eventType: 'focusin' as const, targetId: 'cancel-button' as const, clientOffsetMs: 5 },
      { eventType: 'keydown' as const, targetId: 'cancel-button' as const, keyName: 'Tab' as const, shiftKey: false, clientOffsetMs: 6 },
      { eventType: 'focusin' as const, targetId: 'delete-button' as const, clientOffsetMs: 7 },
      { eventType: 'keydown' as const, targetId: 'delete-button' as const, keyName: 'Tab' as const, shiftKey: false, clientOffsetMs: 8 },
      { eventType: 'focusin' as const, targetId: 'reason-input' as const, clientOffsetMs: 9 },
      { eventType: 'keydown' as const, targetId: 'reason-input' as const, keyName: 'Tab' as const, shiftKey: true, clientOffsetMs: 10 },
      { eventType: 'focusin' as const, targetId: 'delete-button' as const, clientOffsetMs: 11 },
      { eventType: 'keydown' as const, targetId: 'delete-button' as const, keyName: 'Escape' as const, shiftKey: false, clientOffsetMs: 12 },
      { eventType: 'dialog_close' as const, targetId: 'dialog-title' as const, closeReason: 'escape' as const, clientOffsetMs: 13 },
      { eventType: 'focus_return' as const, targetId: 'delete-trigger' as const, clientOffsetMs: 14 },
    ],
  };
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM workspaces').run();
});

test('migration adds Package 3 guard/finalizer tables and exact immutable triggers', async () => {
  expect((env as Cloudflare.Env & {
    PACKAGE3_TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
  }).PACKAGE3_TEST_MIGRATIONS.map(({ name }) => name)).toEqual([
    '0001_package1_domain.sql',
    '0002_package2_vertical_slice.sql',
    '0003_package3_raw_observer_verifier.sql',
  ]);
  const objects = await env.DB.prepare(
    `SELECT type, name FROM sqlite_master
      WHERE name IN (
        'focus_rehearsal_commits', 'verification_guards', 'verification_commits',
        'trg_focus_rehearsal_commits_immutable_update',
        'trg_focus_rehearsal_commits_immutable_delete',
        'trg_verification_guards_immutable_update',
        'trg_verification_receipt_complete',
        'trg_verification_checks_package3_behavior',
        'trg_verification_commits_immutable_update'
      ) ORDER BY name`,
  ).all<{ type: string; name: string }>();
  expect(objects.results.map(({ name }) => name)).toEqual([
    'focus_rehearsal_commits',
    'trg_focus_rehearsal_commits_immutable_delete',
    'trg_focus_rehearsal_commits_immutable_update',
    'trg_verification_checks_package3_behavior',
    'trg_verification_commits_immutable_update',
    'trg_verification_guards_immutable_update',
    'trg_verification_receipt_complete',
    'verification_commits',
    'verification_guards',
  ]);
  const receiptColumns = await env.DB.prepare(
    `SELECT name FROM pragma_table_info('verification_receipts') ORDER BY cid`,
  ).all<{ name: string }>();
  expect(receiptColumns.results.map(({ name }) => name)).toContain('environment');
  expect(receiptColumns.results.map(({ name }) => name)).toContain(
    'verifier_output_hash',
  );
  const checkColumns = await env.DB.prepare(
    `SELECT name FROM pragma_table_info('verification_checks') ORDER BY cid`,
  ).all<{ name: string }>();
  expect(checkColumns.results.map(({ name }) => name)).toContain(
    'verifier_output_hash',
  );
  const behaviorTrigger = await env.DB.prepare(
    `SELECT sql FROM sqlite_master
      WHERE type = 'trigger' AND name = 'trg_verification_checks_package3_behavior'`,
  ).first<{ sql: string }>();
  expect(behaviorTrigger?.sql).toContain(
    "r.verifier_version = 'focus-event-verifier-v1'",
  );
  expect(behaviorTrigger?.sql).toContain("'initialFocus', 'focusOrder'");
});

test('full-rehearsal finalizer rejects an incomplete graph and freezes a complete marker', async () => {
  const session = await workspace();
  const active = await activeBinding(session.workspace.id);
  const sessionId = '00000000-0000-4000-8000-000000000361';
  const digest = 'a'.repeat(64);
  await env.DB.prepare(
    `INSERT INTO observation_sessions (
       id, workspace_id, variant_id, implemented_revision, environment,
       nonce_digest, state, created_at, expires_at, finalized_at,
       event_digest, manifest_digest
     ) VALUES (?, ?, ?, ?, 'browser', ?, 'finalized', ?, ?, ?, ?, ?)`,
  )
    .bind(
      sessionId,
      session.workspace.id,
      active.variant_id,
      active.revision,
      'b'.repeat(64),
      now + 1,
      now + 31,
      now + 2,
      digest,
      digest,
    )
    .run();
  await expect(
    env.DB.prepare(
      `INSERT INTO focus_rehearsal_commits (
         session_id, workspace_id, variant_id, implemented_revision,
         manifest_digest, event_digest, event_count, finalized_at
       ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    )
      .bind(
        sessionId,
        session.workspace.id,
        active.variant_id,
        active.revision,
        digest,
        digest,
        now + 2,
      )
      .run(),
  ).rejects.toThrow(/FOCUS_REHEARSAL_INCOMPLETE/u);
});

test('Package 2 opening-report replay remains one immutable two-event graph', async () => {
  const session = await workspace(62);
  const input = {
    db: env.DB,
    workspaceId: session.workspace.id,
    now: now + 1,
    environment: 'playwright' as const,
    firstTargetId: 'delete-button' as const,
    clientOffsetMs: 5,
    manifest: INITIAL_FOCUS_MANIFEST,
  };
  const first = await commitInitialFocusObservation(input);
  const replay = await commitInitialFocusObservation({ ...input, now: now + 2 });
  expect(replay.rehearsalSessionId).toBe(first.rehearsalSessionId);
  const counts = await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM observation_sessions WHERE workspace_id = ?) AS sessions,
      (SELECT COUNT(*) FROM observation_events WHERE workspace_id = ?) AS events,
      (SELECT COUNT(*) FROM initial_focus_observation_commits WHERE workspace_id = ?) AS commits`,
  )
    .bind(session.workspace.id, session.workspace.id, session.workspace.id)
    .first();
  expect(counts).toEqual({ sessions: 1, events: 2, commits: 1 });
  await expect(
    env.DB.prepare(
      `UPDATE initial_focus_observation_commits SET first_target_id = 'cancel-button'
        WHERE workspace_id = ?`,
    )
      .bind(session.workspace.id)
      .run(),
  ).rejects.toThrow(/INITIAL_FOCUS_OBSERVATION_IMMUTABLE/u);
});

test('start binds a generated recording session to the server active revision without product mutation', async () => {
  const session = await workspace(63);
  const before = await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM implemented_focus_revisions WHERE workspace_id = ?) AS revisions,
      (SELECT COUNT(*) FROM proposals WHERE workspace_id = ?) AS proposals,
      (SELECT COUNT(*) FROM review_decisions WHERE workspace_id = ?) AS reviews`,
  )
    .bind(session.workspace.id, session.workspace.id, session.workspace.id)
    .first();
  const started = await startFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    now: now + 1,
    environment: 'playwright',
  });
  expect(started).toMatchObject({
    implementedRevision: 1,
    expiresAt: now + 31,
    state: 'recording',
  });
  expect(started.rehearsalSessionId).toMatch(/^[0-9a-f-]{36}$/u);
  const row = await env.DB.prepare(
    `SELECT workspace_id, variant_id, implemented_revision, environment,
            nonce_digest, state, created_at, expires_at
       FROM observation_sessions WHERE id = ?`,
  )
    .bind(started.rehearsalSessionId)
    .first<Record<string, unknown>>();
  expect(row).toMatchObject({
    workspace_id: session.workspace.id,
    variant_id: started.variantId,
    implemented_revision: 1,
    environment: 'playwright',
    state: 'recording',
    created_at: now + 1,
    expires_at: now + 31,
  });
  expect(row!.nonce_digest).toMatch(/^[0-9a-f]{64}$/u);
  expect(await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM implemented_focus_revisions WHERE workspace_id = ?) AS revisions,
      (SELECT COUNT(*) FROM proposals WHERE workspace_id = ?) AS proposals,
      (SELECT COUNT(*) FROM review_decisions WHERE workspace_id = ?) AS reviews`,
  ).bind(session.workspace.id, session.workspace.id, session.workspace.id).first()).toEqual(before);
});

test('finalize assigns contiguous server order, canonical digests, and one immutable full marker', async () => {
  const session = await workspace(64);
  const started = await startFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    now: now + 1,
    environment: 'browser',
  });
  const input = fullRehearsal(started.variantId, started.implementedRevision);
  const finalized = await finalizeFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    rehearsalSessionId: started.rehearsalSessionId,
    now: now + 2,
    input,
  });
  expect(finalized).toMatchObject({
    rehearsalSessionId: started.rehearsalSessionId,
    implementedRevision: 1,
    eventCount: 15,
    state: 'finalized',
    idempotentReplay: false,
  });
  expect(finalized.manifestDigest).toMatch(/^[0-9a-f]{64}$/u);
  expect(finalized.eventDigest).toMatch(/^[0-9a-f]{64}$/u);
  const events = await env.DB.prepare(
    `SELECT sequence FROM observation_events
      WHERE workspace_id = ? AND session_id = ? ORDER BY sequence`,
  ).bind(session.workspace.id, started.rehearsalSessionId).all<{ sequence: number }>();
  expect(events.results.map(({ sequence }) => sequence)).toEqual(
    Array.from({ length: 15 }, (_, index) => index + 1),
  );
  expect(await env.DB.prepare(
    `SELECT event_count, manifest_digest, event_digest FROM focus_rehearsal_commits
      WHERE workspace_id = ? AND session_id = ?`,
  ).bind(session.workspace.id, started.rehearsalSessionId).first()).toEqual({
    event_count: 15,
    manifest_digest: finalized.manifestDigest,
    event_digest: finalized.eventDigest,
  });
  await expect(env.DB.prepare(
    `UPDATE observation_events SET client_offset_ms = 99
      WHERE workspace_id = ? AND session_id = ? AND sequence = 2`,
  ).bind(session.workspace.id, started.rehearsalSessionId).run()).rejects.toThrow(
    /OBSERVATION_EVENTS_IMMUTABLE/u,
  );
});

test('identical finalize retry recovers while conflict, expiry, and partial order leave no finalization', async () => {
  const session = await workspace(65);
  const first = await startFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    now: now + 1,
    environment: 'browser',
  });
  const input = fullRehearsal(first.variantId);
  const saved = await finalizeFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    rehearsalSessionId: first.rehearsalSessionId,
    now: now + 2,
    input,
  });
  const replay = await finalizeFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    rehearsalSessionId: first.rehearsalSessionId,
    now: now + 3,
    input,
  });
  expect(replay).toEqual({ ...saved, idempotentReplay: true });
  await expect(finalizeFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    rehearsalSessionId: first.rehearsalSessionId,
    now: now + 3,
    input: {
      ...input,
      events: input.events.map((event, index) =>
        index === 1 ? { ...event, clientOffsetMs: 2 } : event,
      ),
    },
  })).rejects.toMatchObject({ code: 'REHEARSAL_CONFLICT' });

  const expired = await startFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    now: now + 10,
    environment: 'browser',
  });
  await expect(finalizeFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    rehearsalSessionId: expired.rehearsalSessionId,
    now: expired.expiresAt + 1,
    input: fullRehearsal(expired.variantId),
  })).rejects.toMatchObject({ code: 'REHEARSAL_EXPIRED' });
  expect(await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM focus_rehearsal_commits
      WHERE workspace_id = ? AND session_id = ?`,
  ).bind(session.workspace.id, expired.rehearsalSessionId).first()).toEqual({ count: 0 });

  const invalid = await startFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    now: now + 12,
    environment: 'browser',
  });
  const reversed = fullRehearsal(invalid.variantId);
  reversed.events[3] = { ...reversed.events[3], clientOffsetMs: 0 };
  await expect(finalizeFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    rehearsalSessionId: invalid.rehearsalSessionId,
    now: now + 13,
    input: reversed,
  })).rejects.toMatchObject({ code: 'INVALID_REHEARSAL' });
});
