import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import {
  finalizeFocusRehearsal,
  startFocusRehearsal,
} from '../../lib/server/focus-rehearsal.ts';
import { applyProposal } from '../../lib/server/package5-apply-history-undo.ts';
import { verifyFocusContract } from '../../lib/server/verify-focus-contract.ts';
import {
  approvePackage5Fixture,
  createPackage5Fixture,
  package5Now,
  package5Secrets,
} from './helpers.ts';

function fullRehearsal(
  variantId: string,
  revision: number,
  firstTarget: 'cancel-button' | 'delete-button',
) {
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
      implementedRevision: revision,
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

async function appliedRehearsal(tokenByte: number, firstTarget: 'cancel-button' | 'delete-button') {
  const fixture = await approvePackage5Fixture(tokenByte);
  await applyProposal({
    db: env.DB, cookieHeader: fixture.session.setCookie,
    now: package5Now + 5, sessionSecret: package5Secrets.sessionSecret,
    input: {
      proposalId: fixture.created.proposal.proposalId,
      expectedImplementedRevision: 1,
      idempotencyKey: `30000000-0000-4000-8000-${tokenByte.toString().padStart(12, '0')}`,
    },
  });
  const started = await startFocusRehearsal({
    db: env.DB, workspaceId: fixture.session.workspace.id,
    now: package5Now + 6, environment: 'playwright',
  });
  await finalizeFocusRehearsal({
    db: env.DB, workspaceId: fixture.session.workspace.id,
    rehearsalSessionId: started.rehearsalSessionId,
    now: package5Now + 7,
    input: fullRehearsal(started.variantId, 2, firstTarget),
  });
  return { fixture, started };
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM workspaces').run();
});

test('a fresh passing reviewed revision-2 verification projects one exact immutable runtime precedent', async () => {
  const { fixture, started } = await appliedRehearsal(165, 'cancel-button');
  const first = await verifyFocusContract({
    db: env.DB, workspaceId: fixture.session.workspace.id,
    rehearsalSessionId: started.rehearsalSessionId,
    implementedRevision: 2, now: package5Now + 8,
  });
  const replay = await verifyFocusContract({
    db: env.DB, workspaceId: fixture.session.workspace.id,
    rehearsalSessionId: started.rehearsalSessionId,
    implementedRevision: 2, now: package5Now + 9,
  });
  expect(first).toMatchObject({ overallResult: 'pass', projectedPrecedentCount: 1, idempotentReplay: false });
  expect(replay).toMatchObject({ receiptId: first.receiptId, projectedPrecedentCount: 1, idempotentReplay: true });
  expect(await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM precedent_records WHERE workspace_id = ? AND provenance_kind = 'synthetic-seed') AS seeds,
       (SELECT COUNT(*) FROM precedent_records WHERE workspace_id = ? AND provenance_kind = 'verified-runtime') AS runtime,
       (SELECT COUNT(*) FROM runtime_precedent_provenance WHERE workspace_id = ?) AS provenance,
       (SELECT COUNT(*) FROM precedent_projection_commits WHERE workspace_id = ?) AS commits,
       (SELECT COUNT(*) FROM precedent_retrieval_profiles p JOIN precedent_records r ON r.workspace_id = p.workspace_id AND r.id = p.record_id WHERE p.workspace_id = ? AND r.provenance_kind = 'verified-runtime') AS profiles,
       (SELECT COUNT(*) FROM precedent_subject_edges e JOIN precedent_records r ON r.workspace_id = e.workspace_id AND r.id = e.record_id WHERE e.workspace_id = ? AND r.provenance_kind = 'verified-runtime') AS edges,
       (SELECT COUNT(*) FROM audit_events WHERE workspace_id = ? AND action = 'precedent.projected') AS audits`,
  ).bind(
    fixture.session.workspace.id, fixture.session.workspace.id,
    fixture.session.workspace.id, fixture.session.workspace.id,
    fixture.session.workspace.id, fixture.session.workspace.id,
    fixture.session.workspace.id,
  ).first()).toEqual({
    seeds: 34, runtime: 1, provenance: 1, commits: 1,
    profiles: 1, edges: 4, audits: 1,
  });
  const lineage = await env.DB.prepare(
    `SELECT pp.proposal_id, pp.review_decision_id, pp.application_receipt_id,
            pp.verification_receipt_id, pp.changed_field, pp.behavior,
            pp.normalized_outcome_key, r.provenance_ref, r.record_key
       FROM runtime_precedent_provenance pp JOIN precedent_records r
         ON r.workspace_id = pp.workspace_id AND r.id = pp.record_id
      WHERE pp.workspace_id = ?`,
  ).bind(fixture.session.workspace.id).first<Record<string, unknown>>();
  expect(lineage).toMatchObject({
    proposal_id: fixture.created.proposal.proposalId,
    verification_receipt_id: first.receiptId,
    changed_field: 'initialFocus', behavior: 'initial-focus',
    normalized_outcome_key: 'cancel-button', provenance_ref: first.receiptId,
    record_key: 'R001',
  });
});

test('failed verification projects nothing', async () => {
  const { fixture, started } = await appliedRehearsal(166, 'delete-button');
  const result = await verifyFocusContract({
    db: env.DB, workspaceId: fixture.session.workspace.id,
    rehearsalSessionId: started.rehearsalSessionId,
    implementedRevision: 2, now: package5Now + 8,
  });
  expect(result).toMatchObject({ overallResult: 'fail', projectedPrecedentCount: 0 });
  expect(await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM runtime_precedent_provenance WHERE workspace_id = ?',
  ).bind(fixture.session.workspace.id).first()).toEqual({ count: 0 });
});

test('passing revision 1 and an unreviewed revision 2 project nothing', async () => {
  const revision1 = await createPackage5Fixture(174);
  const firstStarted = await startFocusRehearsal({
    db: env.DB, workspaceId: revision1.session.workspace.id,
    now: package5Now + 4, environment: 'playwright',
  });
  await finalizeFocusRehearsal({
    db: env.DB, workspaceId: revision1.session.workspace.id,
    rehearsalSessionId: firstStarted.rehearsalSessionId, now: package5Now + 5,
    input: fullRehearsal(firstStarted.variantId, 1, 'delete-button'),
  });
  expect(await verifyFocusContract({
    db: env.DB, workspaceId: revision1.session.workspace.id,
    rehearsalSessionId: firstStarted.rehearsalSessionId,
    implementedRevision: 1, now: package5Now + 6,
  })).toMatchObject({ overallResult: 'pass', projectedPrecedentCount: 0 });

  await env.DB.prepare('DELETE FROM workspaces').run();
  const unreviewed = await createPackage5Fixture(175);
  const variant = await env.DB.prepare(
    'SELECT active_variant_id FROM workspace_view_state WHERE workspace_id = ?',
  ).bind(unreviewed.session.workspace.id).first<{ active_variant_id: string }>();
  const variantId = variant!.active_variant_id;
  await env.DB.prepare(
    `INSERT INTO implemented_focus_revisions (
       id, workspace_id, variant_id, revision, configuration_json,
       configuration_hash, parent_revision, source_proposal_id,
       source_receipt_id, created_at
     ) SELECT ?, ?, ?, 2, configuration_json, configuration_hash, 1, NULL, NULL, ?
         FROM fcs_focus_configuration_catalog_v2 WHERE configuration_json = ?`,
  ).bind(
    '00000000-0000-4000-8000-000000005601',
    unreviewed.session.workspace.id, variantId, package5Now + 4,
    JSON.stringify({
      initialFocus: 'cancel-button',
      focusOrder: ['reason-input', 'cancel-button', 'delete-button'],
      trapTab: 'wrap', trapShiftTab: 'wrap', escapeAction: 'close',
      returnFocus: 'delete-trigger',
    }),
  ).run();
  await env.DB.prepare(
    'UPDATE component_variants SET active_implemented_revision = 2 WHERE workspace_id = ? AND id = ?',
  ).bind(unreviewed.session.workspace.id, variantId).run();
  const secondStarted = await startFocusRehearsal({
    db: env.DB, workspaceId: unreviewed.session.workspace.id,
    now: package5Now + 5, environment: 'playwright',
  });
  await finalizeFocusRehearsal({
    db: env.DB, workspaceId: unreviewed.session.workspace.id,
    rehearsalSessionId: secondStarted.rehearsalSessionId, now: package5Now + 6,
    input: fullRehearsal(secondStarted.variantId, 2, 'cancel-button'),
  });
  expect(await verifyFocusContract({
    db: env.DB, workspaceId: unreviewed.session.workspace.id,
    rehearsalSessionId: secondStarted.rehearsalSessionId,
    implementedRevision: 2, now: package5Now + 7,
  })).toMatchObject({ overallResult: 'pass', projectedPrecedentCount: 0 });
  expect(await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM runtime_precedent_provenance',
  ).first()).toEqual({ count: 0 });
});
