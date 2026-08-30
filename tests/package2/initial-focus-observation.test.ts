import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import {
  commitInitialFocusObservation,
  INITIAL_FOCUS_MANIFEST,
} from '../../lib/server/initial-focus-observation';
import { bootstrapWorkspace } from '../../lib/server/workspaces';

const secrets = {
  sessionSecret: 'package2-test-session-secret-material-32-bytes-minimum',
  csrfSecret: 'package2-test-csrf-secret-material-32-bytes-minimum',
};
const now = 1_788_100_000;

async function workspace(): Promise<string> {
  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now,
    tokenBytes: new Uint8Array(32).fill(52),
    ...secrets,
  });
  return session.workspace.id;
}

async function observationCounts(workspaceId: string): Promise<Record<string, number>> {
  return (await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM observation_sessions WHERE workspace_id = ?) AS sessions,
      (SELECT COUNT(*) FROM rendered_manifests WHERE workspace_id = ?) AS manifests,
      (SELECT COUNT(*) FROM observation_events WHERE workspace_id = ?) AS events,
      (SELECT COUNT(*) FROM initial_focus_observation_commits WHERE workspace_id = ?) AS commits`,
  )
    .bind(workspaceId, workspaceId, workspaceId, workspaceId)
    .first<Record<string, number>>())!;
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM workspaces').run();
  await env.DB.prepare('DROP TRIGGER IF EXISTS package2_test_observation_failure').run();
});

test('commits the actual opening as one immutable two-event observation', async () => {
  const workspaceId = await workspace();
  const result = await commitInitialFocusObservation({
    db: env.DB,
    workspaceId,
    now: now + 1,
    environment: 'playwright',
    firstTargetId: 'delete-button',
    clientOffsetMs: 17,
    manifest: INITIAL_FOCUS_MANIFEST,
  });

  expect(result).toMatchObject({
    implementedRevision: 1,
    observedInitialFocus: 'delete-button',
    trust: 'untrusted-browser-telemetry',
  });
  expect(result.manifestDigest).toMatch(/^[0-9a-f]{64}$/u);
  expect(result.eventDigest).toMatch(/^[0-9a-f]{64}$/u);
  expect(await observationCounts(workspaceId)).toEqual({
    sessions: 1,
    manifests: 1,
    events: 2,
    commits: 1,
  });

  const events = await env.DB.prepare(
    `SELECT sequence, event_type, target_id, key_name, close_reason, client_offset_ms
       FROM observation_events WHERE workspace_id = ? ORDER BY sequence`,
  )
    .bind(workspaceId)
    .all<Record<string, unknown>>();
  expect(events.results).toEqual([
    {
      sequence: 1,
      event_type: 'dialog_open',
      target_id: 'delete-trigger',
      key_name: null,
      close_reason: null,
      client_offset_ms: 0,
    },
    {
      sequence: 2,
      event_type: 'focusin',
      target_id: 'delete-button',
      key_name: null,
      close_reason: null,
      client_offset_ms: 17,
    },
  ]);
  expect(JSON.stringify(events.results)).not.toContain('reason value');
});

test('rejects arbitrary targets, manifest drift, and revision mismatch without rows', async () => {
  const workspaceId = await workspace();
  const base = {
    db: env.DB,
    workspaceId,
    now: now + 1,
    environment: 'browser' as const,
    firstTargetId: 'delete-button' as const,
    clientOffsetMs: 1,
    manifest: INITIAL_FOCUS_MANIFEST,
  };

  await expect(
    commitInitialFocusObservation({
      ...base,
      firstTargetId: 'reason-input',
    }),
  ).rejects.toMatchObject({ code: 'OBSERVATION_INVALID' });
  await expect(
    commitInitialFocusObservation({
      ...base,
      manifest: { ...INITIAL_FOCUS_MANIFEST, dialogName: '<script>alert(1)</script>' },
    }),
  ).rejects.toMatchObject({ code: 'OBSERVATION_INVALID' });
  expect(await observationCounts(workspaceId)).toEqual({
    sessions: 0,
    manifests: 0,
    events: 0,
    commits: 0,
  });
});

test('a downstream D1 failure rolls back the full observation graph', async () => {
  const workspaceId = await workspace();
  await env.DB.prepare(
    `CREATE TRIGGER package2_test_observation_failure
       BEFORE INSERT ON observation_events WHEN NEW.sequence = 2
       BEGIN SELECT RAISE(ABORT, 'PACKAGE2_INJECTED_OBSERVATION_FAILURE'); END`,
  ).run();

  await expect(
    commitInitialFocusObservation({
      db: env.DB,
      workspaceId,
      now: now + 1,
      environment: 'browser',
      firstTargetId: 'delete-button',
      clientOffsetMs: 5,
      manifest: INITIAL_FOCUS_MANIFEST,
    }),
  ).rejects.toThrow();
  expect(await observationCounts(workspaceId)).toEqual({
    sessions: 0,
    manifests: 0,
    events: 0,
    commits: 0,
  });
});

test('replay and concurrent opening reports converge on one bounded graph per implemented revision', async () => {
  const workspaceId = await workspace();
  const input = {
    db: env.DB,
    workspaceId,
    now: now + 1,
    environment: 'browser' as const,
    firstTargetId: 'delete-button' as const,
    clientOffsetMs: 7,
    manifest: INITIAL_FOCUS_MANIFEST,
  };

  const [left, right] = await Promise.all([
    commitInitialFocusObservation(input),
    commitInitialFocusObservation(input),
  ]);
  expect(left.rehearsalSessionId).toBe(right.rehearsalSessionId);
  expect(await observationCounts(workspaceId)).toEqual({
    sessions: 1,
    manifests: 1,
    events: 2,
    commits: 1,
  });

  const replay = await commitInitialFocusObservation({
    ...input,
    now: now + 2,
    clientOffsetMs: 19,
  });
  expect(replay.rehearsalSessionId).toBe(left.rehearsalSessionId);
  expect(await observationCounts(workspaceId)).toEqual({
    sessions: 1,
    manifests: 1,
    events: 2,
    commits: 1,
  });
});
