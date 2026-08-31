import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import {
  finalizeFocusRehearsal,
  startFocusRehearsal,
} from '../../lib/server/focus-rehearsal';
import { verifyFocusContract } from '../../lib/server/verify-focus-contract';
import { bootstrapWorkspace, setActiveVariant } from '../../lib/server/workspaces';

const now = 1_788_300_000;
const secrets = {
  sessionSecret: 'package3-verify-session-secret-material-32-bytes-minimum',
  csrfSecret: 'package3-verify-csrf-secret-material-32-bytes-minimum',
};

async function workspace(tokenByte: number) {
  return bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now,
    tokenBytes: new Uint8Array(32).fill(tokenByte),
    ...secrets,
  });
}

function fullRehearsal(variantId: string, firstTarget: 'delete-button' | 'cancel-button' = 'delete-button') {
  return {
    manifest: {
      manifestVersion: 'focus-manifest-v1' as const,
      targetIds: ['delete-trigger' as const, 'dialog-title' as const, 'reason-input' as const, 'cancel-button' as const, 'delete-button' as const],
      tabbableOrder: ['reason-input' as const, 'cancel-button' as const, 'delete-button' as const],
      dialogName: 'Delete account' as const,
      dialogDescription: 'Deleting your account is permanent. You can optionally tell us why.' as const,
      role: 'dialog' as const,
      ariaModal: true as const,
      open: true as const,
      variantId,
      implementedRevision: 1,
    },
    events: [
      { eventType: 'dialog_open' as const, targetId: 'delete-trigger' as const, clientOffsetMs: 0 },
      { eventType: 'focusin' as const, targetId: firstTarget, clientOffsetMs: 1 },
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

async function finalized(tokenByte: number, firstTarget: 'delete-button' | 'cancel-button' = 'delete-button') {
  const session = await workspace(tokenByte);
  const started = await startFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    now: now + 1,
    environment: 'playwright',
  });
  await finalizeFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    rehearsalSessionId: started.rehearsalSessionId,
    now: now + 2,
    input: fullRehearsal(started.variantId, firstTarget),
  });
  return { session, started };
}

async function verificationCounts(workspaceId?: string) {
  const predicate = workspaceId ? ' WHERE workspace_id = ?' : '';
  const values = workspaceId ? [workspaceId, workspaceId, workspaceId, workspaceId, workspaceId] : [];
  return env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM verification_guards${predicate}) AS guards,
      (SELECT COUNT(*) FROM verification_receipts${predicate}) AS receipts,
      (SELECT COUNT(*) FROM verification_checks${predicate}) AS checks,
      (SELECT COUNT(*) FROM audit_events${predicate}${workspaceId ? " AND action = 'verification.completed'" : " WHERE action = 'verification.completed'"}) AS audits,
      (SELECT COUNT(*) FROM verification_commits${predicate}) AS commits`,
  ).bind(...values).first<Record<string, number>>();
}

beforeEach(async () => {
  await env.DB.prepare('DROP TRIGGER IF EXISTS package3_test_verification_failure').run();
  await env.DB.prepare('DELETE FROM workspaces').run();
});

test('pre-evaluation rejects nonexistent, foreign, unfinished, stale, and wrong revision with zero receipt', async () => {
  const left = await workspace(81);
  const right = await workspace(82);
  const unfinished = await startFocusRehearsal({
    db: env.DB,
    workspaceId: left.workspace.id,
    now: now + 1,
    environment: 'browser',
  });
  for (const probe of [
    { workspaceId: left.workspace.id, rehearsalSessionId: '00000000-0000-4000-8000-000000000499', implementedRevision: 1 },
    { workspaceId: right.workspace.id, rehearsalSessionId: unfinished.rehearsalSessionId, implementedRevision: 1 },
    { workspaceId: left.workspace.id, rehearsalSessionId: unfinished.rehearsalSessionId, implementedRevision: 1 },
  ]) {
    await expect(verifyFocusContract({ db: env.DB, now: now + 2, ...probe })).rejects.toMatchObject({
      code: 'VERIFICATION_NOT_FOUND',
    });
  }
  expect(await verificationCounts()).toEqual({ guards: 0, receipts: 0, checks: 0, audits: 0, commits: 0 });

  const complete = await finalized(83);
  await expect(verifyFocusContract({
    db: env.DB,
    workspaceId: complete.session.workspace.id,
    rehearsalSessionId: complete.started.rehearsalSessionId,
    implementedRevision: 2,
    now: now + 3,
  })).rejects.toMatchObject({ code: 'VERIFICATION_NOT_FOUND' });
  const variants = await env.DB.prepare(
    `SELECT v.id FROM component_variants v WHERE v.workspace_id = ? AND v.id <> ?`,
  ).bind(complete.session.workspace.id, complete.started.variantId).first<{ id: string }>();
  await setActiveVariant(env.DB, complete.session.workspace.id, variants!.id, 1);
  await expect(verifyFocusContract({
    db: env.DB,
    workspaceId: complete.session.workspace.id,
    rehearsalSessionId: complete.started.rehearsalSessionId,
    implementedRevision: 1,
    now: now + 3,
  })).rejects.toMatchObject({ code: 'VERIFICATION_NOT_FOUND' });
  expect(await verificationCounts(complete.session.workspace.id)).toEqual({ guards: 0, receipts: 0, checks: 0, audits: 0, commits: 0 });
});

test('incomplete and duplicate-lifecycle traces cannot become finalized verifier evidence', async () => {
  const candidates = [
    (variantId: string) => ({
      ...fullRehearsal(variantId),
      events: [
        { eventType: 'dialog_open' as const, targetId: 'delete-trigger' as const, clientOffsetMs: 0 },
        { eventType: 'focus_return' as const, targetId: 'delete-trigger' as const, clientOffsetMs: 1 },
      ],
    }),
    (variantId: string) => {
      const input = fullRehearsal(variantId);
      return {
        ...input,
        events: [
          ...input.events.slice(0, -1),
          { eventType: 'dialog_close' as const, targetId: 'dialog-title' as const, closeReason: 'delete' as const, clientOffsetMs: 14 },
          { ...input.events.at(-1)!, clientOffsetMs: 15 },
        ],
      };
    },
  ];
  for (const [index, candidate] of candidates.entries()) {
    const session = await workspace(121 + index);
    const started = await startFocusRehearsal({
      db: env.DB,
      workspaceId: session.workspace.id,
      now: now + 1,
      environment: 'playwright',
    });
    await expect(finalizeFocusRehearsal({
      db: env.DB,
      workspaceId: session.workspace.id,
      rehearsalSessionId: started.rehearsalSessionId,
      now: now + 2,
      input: candidate(started.variantId),
    })).rejects.toMatchObject({ code: 'INVALID_REHEARSAL' });
  }
  expect(await verificationCounts()).toEqual({ guards: 0, receipts: 0, checks: 0, audits: 0, commits: 0 });
  expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM focus_rehearsal_commits').first()).toEqual({ count: 0 });
});

test('a finalized rehearsal past its server expiry is rejected before evaluation and guard insertion', async () => {
  const fixture = await finalized(123);
  await expect(verifyFocusContract({
    db: env.DB,
    workspaceId: fixture.session.workspace.id,
    rehearsalSessionId: fixture.started.rehearsalSessionId,
    implementedRevision: 1,
    now: fixture.started.expiresAt + 1,
  })).rejects.toMatchObject({ code: 'VERIFICATION_NOT_FOUND' });
  expect(await verificationCounts(fixture.session.workspace.id)).toEqual({ guards: 0, receipts: 0, checks: 0, audits: 0, commits: 0 });
});

test('a complete immutable receipt remains replayable after the rehearsal expiry', async () => {
  const fixture = await finalized(125);
  const first = await verifyFocusContract({
    db: env.DB,
    workspaceId: fixture.session.workspace.id,
    rehearsalSessionId: fixture.started.rehearsalSessionId,
    implementedRevision: 1,
    now: now + 3,
  });
  const replay = await verifyFocusContract({
    db: env.DB,
    workspaceId: fixture.session.workspace.id,
    rehearsalSessionId: fixture.started.rehearsalSessionId,
    implementedRevision: 1,
    now: fixture.started.expiresAt + 1,
  });
  expect(replay).toMatchObject({ receiptId: first.receiptId, idempotentReplay: true });
  expect(await verificationCounts(fixture.session.workspace.id)).toEqual({ guards: 1, receipts: 1, checks: 6, audits: 1, commits: 1 });
});

test('an immutable receipt replays after a later revision activates while an unverified stale session fails', async () => {
  const fixture = await finalized(126);
  const stale = await startFocusRehearsal({
    db: env.DB,
    workspaceId: fixture.session.workspace.id,
    now: now + 3,
    environment: 'playwright',
  });
  await finalizeFocusRehearsal({
    db: env.DB,
    workspaceId: fixture.session.workspace.id,
    rehearsalSessionId: stale.rehearsalSessionId,
    now: now + 4,
    input: fullRehearsal(stale.variantId),
  });
  const request = {
    db: env.DB,
    workspaceId: fixture.session.workspace.id,
    rehearsalSessionId: fixture.started.rehearsalSessionId,
    implementedRevision: 1,
    now: now + 5,
  };
  const first = await verifyFocusContract(request);
  await env.DB.prepare(
    `INSERT INTO implemented_focus_revisions (
       id, workspace_id, variant_id, revision, configuration_json,
       configuration_hash, parent_revision, created_at
     )
     SELECT ?, workspace_id, variant_id, 2, configuration_json,
            configuration_hash, 1, ?
       FROM implemented_focus_revisions
      WHERE workspace_id = ? AND variant_id = ? AND revision = 1`,
  ).bind(
    '00000000-0000-4000-8000-000000000498',
    now + 6,
    fixture.session.workspace.id,
    fixture.started.variantId,
  ).run();
  await env.DB.prepare(
    `UPDATE component_variants SET active_implemented_revision = 2
      WHERE workspace_id = ? AND id = ?`,
  ).bind(fixture.session.workspace.id, fixture.started.variantId).run();

  const replay = await verifyFocusContract({ ...request, now: now + 7 });
  expect(replay).toEqual({ ...first, idempotentReplay: true });
  await expect(verifyFocusContract({
    db: env.DB,
    workspaceId: fixture.session.workspace.id,
    rehearsalSessionId: stale.rehearsalSessionId,
    implementedRevision: 1,
    now: now + 7,
  })).rejects.toMatchObject({ code: 'VERIFICATION_NOT_FOUND' });
  expect(await verificationCounts(fixture.session.workspace.id)).toEqual({ guards: 1, receipts: 1, checks: 6, audits: 1, commits: 1 });
});

test('bounded trap, Escape-stays-open, and alternate-return divergences persist truthful fail receipts', async () => {
  const cases = [
    {
      behavior: 'trapTab',
      mutate: (events: ReturnType<typeof fullRehearsal>['events']) =>
        events.map((event, index) => index === 3 ? { ...event, targetId: 'delete-trigger' } : event),
    },
    {
      behavior: 'trapShiftTab',
      mutate: (events: ReturnType<typeof fullRehearsal>['events']) =>
        events.map((event, index) => index === 11 ? { ...event, targetId: 'delete-trigger' } : event),
    },
    {
      behavior: 'escapeAction',
      mutate: (events: ReturnType<typeof fullRehearsal>['events']) => [
        ...events.slice(0, -2),
        { eventType: 'focusin', targetId: 'delete-button', clientOffsetMs: 13 },
        { ...events.at(-2)!, clientOffsetMs: 14 },
        { ...events.at(-1)!, clientOffsetMs: 15 },
      ],
    },
    {
      behavior: 'returnFocus',
      mutate: (events: ReturnType<typeof fullRehearsal>['events']) =>
        events.map((event, index) => index === events.length - 1 ? { ...event, targetId: 'dialog-title' } : event),
    },
  ] as const;
  for (const [index, vector] of cases.entries()) {
    const session = await workspace(130 + index);
    const started = await startFocusRehearsal({
      db: env.DB,
      workspaceId: session.workspace.id,
      now: now + 1,
      environment: 'playwright',
    });
    const rehearsal = fullRehearsal(started.variantId);
    await finalizeFocusRehearsal({
      db: env.DB,
      workspaceId: session.workspace.id,
      rehearsalSessionId: started.rehearsalSessionId,
      now: now + 2,
      input: { ...rehearsal, events: vector.mutate(rehearsal.events) },
    });
    const result = await verifyFocusContract({
      db: env.DB,
      workspaceId: session.workspace.id,
      rehearsalSessionId: started.rehearsalSessionId,
      implementedRevision: 1,
      now: now + 3,
    });
    expect(result.overallResult).toBe('fail');
    expect(result.checks.find(({ behavior }) => behavior === vector.behavior)?.result).toBe('fail');
    expect(await verificationCounts(session.workspace.id)).toEqual({ guards: 1, receipts: 1, checks: 6, audits: 1, commits: 1 });
  }
});

test('one valid pass persists a guard, bound receipt, exact six checks, audit, and commit atomically', async () => {
  const fixture = await finalized(84);
  const before = await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM implemented_focus_revisions WHERE workspace_id = ?) AS revisions,
      (SELECT COUNT(*) FROM proposals WHERE workspace_id = ?) AS proposals,
      (SELECT COUNT(*) FROM review_decisions WHERE workspace_id = ?) AS reviews,
      (SELECT COUNT(*) FROM precedent_records WHERE workspace_id = ?) AS precedents`,
  ).bind(fixture.session.workspace.id, fixture.session.workspace.id, fixture.session.workspace.id, fixture.session.workspace.id).first();
  const result = await verifyFocusContract({
    db: env.DB,
    workspaceId: fixture.session.workspace.id,
    rehearsalSessionId: fixture.started.rehearsalSessionId,
    implementedRevision: 1,
    now: now + 3,
  });
  expect(result).toMatchObject({
    overallResult: 'pass',
    verifierVersion: 'focus-event-verifier-v1',
    implementedRevision: 1,
    idempotentReplay: false,
  });
  expect(result.checks).toHaveLength(6);
  expect(await verificationCounts(fixture.session.workspace.id)).toEqual({ guards: 1, receipts: 1, checks: 6, audits: 1, commits: 1 });
  expect(await env.DB.prepare(
    `SELECT COUNT(*) AS count
       FROM verification_checks c
       JOIN verification_receipts r
         ON r.workspace_id = c.workspace_id AND r.id = c.verification_receipt_id
      WHERE c.workspace_id = ? AND c.verifier_output_hash <> r.verifier_output_hash`,
  ).bind(fixture.session.workspace.id).first()).toEqual({ count: 0 });
  expect(await env.DB.prepare(
    `SELECT state FROM observation_sessions WHERE workspace_id = ? AND id = ?`,
  ).bind(fixture.session.workspace.id, fixture.started.rehearsalSessionId).first()).toEqual({ state: 'verified_pass' });
  expect(await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM implemented_focus_revisions WHERE workspace_id = ?) AS revisions,
      (SELECT COUNT(*) FROM proposals WHERE workspace_id = ?) AS proposals,
      (SELECT COUNT(*) FROM review_decisions WHERE workspace_id = ?) AS reviews,
      (SELECT COUNT(*) FROM precedent_records WHERE workspace_id = ?) AS precedents`,
  ).bind(fixture.session.workspace.id, fixture.session.workspace.id, fixture.session.workspace.id, fixture.session.workspace.id).first()).toEqual(before);
});

test('valid behavioral mismatch creates one truthful fail receipt and same/concurrent replay recovers it', async () => {
  const fixture = await finalized(85, 'cancel-button');
  const input = {
    db: env.DB,
    workspaceId: fixture.session.workspace.id,
    rehearsalSessionId: fixture.started.rehearsalSessionId,
    implementedRevision: 1,
    now: now + 3,
  };
  const [left, right] = await Promise.all([
    verifyFocusContract(input),
    verifyFocusContract(input),
  ]);
  expect(left.receiptId).toBe(right.receiptId);
  expect(left.overallResult).toBe('fail');
  expect(right.overallResult).toBe('fail');
  expect([left.idempotentReplay, right.idempotentReplay].sort()).toEqual([false, true]);
  const replay = await verifyFocusContract({ ...input, now: now + 4 });
  expect(replay).toMatchObject({ receiptId: left.receiptId, idempotentReplay: true });
  expect(await verificationCounts(fixture.session.workspace.id)).toEqual({ guards: 1, receipts: 1, checks: 6, audits: 1, commits: 1 });
  expect(await env.DB.prepare(
    `SELECT state FROM observation_sessions WHERE workspace_id = ? AND id = ?`,
  ).bind(fixture.session.workspace.id, fixture.started.rehearsalSessionId).first()).toEqual({ state: 'verified_fail' });
});

test('sensitive typed content is rejected and absent from persistence, errors, and safe results', async () => {
  const sensitiveMarker = 'P3_PRIVATE_MARKER_DO_NOT_PERSIST_9f31';
  const session = await workspace(124);
  const started = await startFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    now: now + 1,
    environment: 'playwright',
  });
  const rehearsal = fullRehearsal(started.variantId);
  let rejected: unknown;
  try {
    await finalizeFocusRehearsal({
      db: env.DB,
      workspaceId: session.workspace.id,
      rehearsalSessionId: started.rehearsalSessionId,
      now: now + 2,
      input: { ...rehearsal, typedValue: sensitiveMarker },
    });
  } catch (error) {
    rejected = error;
  }
  expect(rejected).toMatchObject({ code: 'INVALID_REHEARSAL' });
  expect(JSON.stringify(rejected)).not.toContain(sensitiveMarker);

  const finalized = await finalizeFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    rehearsalSessionId: started.rehearsalSessionId,
    now: now + 2,
    input: rehearsal,
  });
  const verified = await verifyFocusContract({
    db: env.DB,
    workspaceId: session.workspace.id,
    rehearsalSessionId: started.rehearsalSessionId,
    implementedRevision: 1,
    now: now + 3,
  });
  expect(JSON.stringify({ finalized, verified })).not.toContain(sensitiveMarker);

  const stored = await env.DB.prepare(
    `SELECT
      (SELECT group_concat(id || workspace_id || variant_id || environment || nonce_digest || state || coalesce(event_digest, '') || coalesce(manifest_digest, '')) FROM observation_sessions WHERE workspace_id = ?) AS sessions,
      (SELECT group_concat(id || session_id || manifest_version || target_ids_json || tabbable_order_json || dialog_name || dialog_description || role || manifest_hash) FROM rendered_manifests WHERE workspace_id = ?) AS manifests,
      (SELECT group_concat(id || session_id || event_type || target_id || coalesce(key_name, '') || coalesce(close_reason, '')) FROM observation_events WHERE workspace_id = ?) AS events,
      (SELECT group_concat(session_id || variant_id || manifest_digest || event_digest) FROM focus_rehearsal_commits WHERE workspace_id = ?) AS rehearsal_commits,
      (SELECT group_concat(id || observation_session_id || variant_id || environment || verifier_version || result || verifier_output_hash) FROM verification_guards WHERE workspace_id = ?) AS guards,
      (SELECT group_concat(id || observation_session_id || variant_id || environment || verifier_version || result || verifier_output_hash) FROM verification_receipts WHERE workspace_id = ?) AS receipts,
      (SELECT group_concat(id || verification_receipt_id || behavior || result || evidence_sequences_json || verifier_output_hash) FROM verification_checks WHERE workspace_id = ?) AS checks,
      (SELECT group_concat(id || guard_id || receipt_id || audit_event_id) FROM verification_commits WHERE workspace_id = ?) AS commits,
      (SELECT group_concat(id || action || target_kind || result || safe_detail_json) FROM audit_events WHERE workspace_id = ? AND action = 'verification.completed') AS audits`,
  ).bind(...Array(9).fill(session.workspace.id)).first();
  expect(JSON.stringify(stored)).not.toContain(sensitiveMarker);
});

test('tamper, reordered frozen rows, and post-finalize mutation fail closed with no receipt', async () => {
  const tamperedManifest = await finalized(86);
  await env.DB.prepare('DROP TRIGGER trg_rendered_manifests_immutable_update').run();
  await env.DB.prepare(
    `UPDATE rendered_manifests SET manifest_hash = ?
      WHERE workspace_id = ? AND session_id = ?`,
  ).bind(
    'c'.repeat(64),
    tamperedManifest.session.workspace.id,
    tamperedManifest.started.rehearsalSessionId,
  ).run();
  await env.DB.prepare(
    `CREATE TRIGGER trg_rendered_manifests_immutable_update
       BEFORE UPDATE ON rendered_manifests
       BEGIN SELECT RAISE(ABORT, 'RENDERED_MANIFESTS_IMMUTABLE'); END`,
  ).run();
  await expect(verifyFocusContract({
    db: env.DB,
    workspaceId: tamperedManifest.session.workspace.id,
    rehearsalSessionId: tamperedManifest.started.rehearsalSessionId,
    implementedRevision: 1,
    now: now + 3,
  })).rejects.toMatchObject({ code: 'VERIFICATION_INVALID' });

  const reordered = await finalized(87);
  await env.DB.prepare('DROP TRIGGER trg_observation_events_immutable_update').run();
  await env.DB.prepare(
    `UPDATE observation_events SET sequence = 64
      WHERE workspace_id = ? AND session_id = ? AND sequence = 6`,
  ).bind(reordered.session.workspace.id, reordered.started.rehearsalSessionId).run();
  await env.DB.prepare(
    `UPDATE observation_events SET sequence = 6
      WHERE workspace_id = ? AND session_id = ? AND sequence = 8`,
  ).bind(reordered.session.workspace.id, reordered.started.rehearsalSessionId).run();
  await env.DB.prepare(
    `UPDATE observation_events SET sequence = 8
      WHERE workspace_id = ? AND session_id = ? AND sequence = 64`,
  ).bind(reordered.session.workspace.id, reordered.started.rehearsalSessionId).run();
  await env.DB.prepare(
    `CREATE TRIGGER trg_observation_events_immutable_update
       BEFORE UPDATE ON observation_events
       BEGIN SELECT RAISE(ABORT, 'OBSERVATION_EVENTS_IMMUTABLE'); END`,
  ).run();
  await expect(verifyFocusContract({
    db: env.DB,
    workspaceId: reordered.session.workspace.id,
    rehearsalSessionId: reordered.started.rehearsalSessionId,
    implementedRevision: 1,
    now: now + 3,
  })).rejects.toMatchObject({ code: 'VERIFICATION_INVALID' });
  await expect(env.DB.prepare(
    `DELETE FROM observation_events WHERE workspace_id = ? AND session_id = ?`,
  ).bind(reordered.session.workspace.id, reordered.started.rehearsalSessionId).run()).rejects.toThrow(
    /OBSERVATION_EVENTS_IMMUTABLE/u,
  );
  expect(await verificationCounts()).toEqual({ guards: 0, receipts: 0, checks: 0, audits: 0, commits: 0 });
});

test('guard, receipt, every check, audit, and finalizer zero/error rolls back the complete graph', async () => {
  const positions = [
    { table: 'verification_guards', when: '' },
    { table: 'verification_receipts', when: '' },
    ...['initialFocus', 'focusOrder', 'trapTab', 'trapShiftTab', 'escapeAction', 'returnFocus'].map(
      (behavior) => ({ table: 'verification_checks', when: ` WHEN NEW.behavior = '${behavior}'` }),
    ),
    { table: 'audit_events', when: " WHEN NEW.action = 'verification.completed'" },
    { table: 'verification_commits', when: '' },
  ];
  let tokenByte = 90;
  for (const mode of ['IGNORE', 'ABORT'] as const) {
    for (const position of positions) {
      await env.DB.prepare('DROP TRIGGER IF EXISTS package3_test_verification_failure').run();
      const fixture = await finalized(tokenByte++);
      const action =
        mode === 'IGNORE'
          ? 'SELECT RAISE(IGNORE);'
          : "SELECT RAISE(ABORT, 'PACKAGE3_INJECTED_VERIFICATION_FAILURE');";
      await env.DB.prepare(
        `CREATE TRIGGER package3_test_verification_failure
           BEFORE INSERT ON ${position.table}${position.when}
           BEGIN ${action} END`,
      ).run();
      await expect(verifyFocusContract({
        db: env.DB,
        workspaceId: fixture.session.workspace.id,
        rehearsalSessionId: fixture.started.rehearsalSessionId,
        implementedRevision: 1,
        now: now + 3,
      })).rejects.toMatchObject({ code: 'VERIFICATION_WRITE_FAILED' });
      expect(
        await verificationCounts(fixture.session.workspace.id),
        `${mode} at ${position.table}${position.when}`,
      ).toEqual({ guards: 0, receipts: 0, checks: 0, audits: 0, commits: 0 });
      await env.DB.prepare('DROP TRIGGER IF EXISTS package3_test_verification_failure').run();
    }
  }
}, 30_000);

test('verification rows and natural-key winner are immutable after concurrent completion', async () => {
  const fixture = await finalized(120);
  const input = {
    db: env.DB,
    workspaceId: fixture.session.workspace.id,
    rehearsalSessionId: fixture.started.rehearsalSessionId,
    implementedRevision: 1,
    now: now + 3,
  };
  const results = await Promise.all(Array.from({ length: 4 }, () => verifyFocusContract(input)));
  expect(new Set(results.map(({ receiptId }) => receiptId)).size).toBe(1);
  expect(await verificationCounts(fixture.session.workspace.id)).toEqual({ guards: 1, receipts: 1, checks: 6, audits: 1, commits: 1 });
  for (const statement of [
    `UPDATE verification_guards SET result = 'fail' WHERE workspace_id = ?`,
    `UPDATE verification_receipts SET result = 'fail' WHERE workspace_id = ?`,
    `UPDATE verification_checks SET result = 'fail' WHERE workspace_id = ?`,
    `UPDATE verification_commits SET created_at = created_at + 1 WHERE workspace_id = ?`,
  ]) {
    await expect(env.DB.prepare(statement).bind(fixture.session.workspace.id).run()).rejects.toThrow(/IMMUTABLE/u);
  }
  await expect(
    env.DB.prepare(
      `UPDATE observation_sessions SET event_digest = ?
        WHERE workspace_id = ? AND id = ?`,
    )
      .bind(
        'd'.repeat(64),
        fixture.session.workspace.id,
        fixture.started.rehearsalSessionId,
      )
      .run(),
  ).rejects.toThrow(/OBSERVATION_FINALIZATION_IMMUTABLE/u);
  await expect(verifyFocusContract({ ...input, implementedRevision: 2 })).rejects.toMatchObject({
    code: 'VERIFICATION_NOT_FOUND',
  });
  expect(await verificationCounts(fixture.session.workspace.id)).toEqual({ guards: 1, receipts: 1, checks: 6, audits: 1, commits: 1 });
});
