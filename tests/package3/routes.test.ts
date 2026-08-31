import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import {
  GET as finalizeGet,
  POST as finalizePost,
} from '../../app/api/rehearsals/[rehearsalSessionId]/finalize/route';
import {
  GET as startGet,
  POST as startPost,
} from '../../app/api/rehearsals/start/route';
import {
  GET as verificationGet,
  POST as verificationPost,
} from '../../app/api/verifications/route';
import { startFocusRehearsal } from '../../lib/server/focus-rehearsal';
import { bootstrapWorkspace } from '../../lib/server/workspaces';

const origin = 'https://focus-contract-studio.example';
const nowSeconds = () => Math.floor(Date.now() / 1000);
const secrets = {
  sessionSecret: env.FCS_SESSION_HMAC_SECRET!,
  csrfSecret: env.FCS_CSRF_HMAC_SECRET!,
};

function request(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
  method = 'POST',
) {
  return new Request(`${origin}${path}`, {
    method,
    headers: { 'content-type': 'application/json', origin, ...headers },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM workspaces').run();
});

test('start route is strict same-origin session/CSRF POST and returns no-store opaque binding', async () => {
  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: nowSeconds(),
    tokenBytes: new Uint8Array(32).fill(71),
    ...secrets,
  });
  const response = await startPost(
    request('/api/rehearsals/start', { environment: 'playwright' }, {
      cookie: session.setCookie!,
      'x-fcs-csrf': session.csrfToken,
    }),
  );
  expect(response.status).toBe(201);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const body = await response.json() as Record<string, unknown>;
  expect(body).toMatchObject({
    ok: true,
    rehearsal: { implementedRevision: 1, state: 'recording' },
  });
  expect(JSON.stringify(body)).not.toContain(session.workspace.id);
  expect(JSON.stringify(body)).not.toContain(session.csrfToken);
});

test('start/finalize routes reject method, type, schema, session, Origin, CSRF, and malformed ID before writes', async () => {
  expect((await startGet()).status).toBe(405);
  expect((await finalizeGet()).status).toBe(405);
  expect((await startPost(request('/api/rehearsals/start', { environment: 'browser' }))).status).toBe(401);

  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: nowSeconds(),
    tokenBytes: new Uint8Array(32).fill(72),
    ...secrets,
  });
  const authorized = {
    cookie: session.setCookie!,
    'x-fcs-csrf': session.csrfToken,
  };
  const badOrigin = request('/api/rehearsals/start', { environment: 'browser' }, authorized);
  badOrigin.headers.set('origin', 'https://attacker.example');
  expect((await startPost(badOrigin)).status).toBe(403);
  expect((await startPost(request('/api/rehearsals/start', { environment: 'browser' }, {
    cookie: session.setCookie!,
  }))).status).toBe(403);
  expect((await startPost(request('/api/rehearsals/start', {
    environment: 'browser', workspaceId: session.workspace.id,
  }, authorized))).status).toBe(400);
  const wrongType = request('/api/rehearsals/start', { environment: 'browser' }, authorized);
  wrongType.headers.set('content-type', 'text/plain');
  expect((await startPost(wrongType)).status).toBe(415);
  expect((await finalizePost(
    request('/api/rehearsals/not-an-id/finalize', {}, authorized),
    { params: Promise.resolve({ rehearsalSessionId: 'not-an-id' }) },
  )).status).toBe(400);
  expect(await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM focus_rehearsal_commits`,
  ).first()).toEqual({ count: 0 });
});

test('verify route rejects GET and strict-boundary negatives with no-store safe errors', async () => {
  expect((await verificationGet()).status).toBe(405);
  const missingSession = await verificationPost(
    request('/api/verifications', {
      rehearsalSessionId: '00000000-0000-4000-8000-000000000491',
      implementedRevision: 1,
    }),
  );
  expect(missingSession.status).toBe(401);
  expect(missingSession.headers.get('cache-control')).toBe('no-store');

  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: nowSeconds(),
    tokenBytes: new Uint8Array(32).fill(73),
    ...secrets,
  });
  const headers = {
    cookie: session.setCookie!,
    'x-fcs-csrf': session.csrfToken,
  };
  for (const body of [
    {},
    { rehearsalSessionId: 'bad', implementedRevision: 1 },
    { rehearsalSessionId: '00000000-0000-4000-8000-000000000491', implementedRevision: 0 },
    { rehearsalSessionId: '00000000-0000-4000-8000-000000000491', implementedRevision: 1, result: 'pass' },
  ]) {
    const response = await verificationPost(request('/api/verifications', body, headers));
    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
  }
  expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM verification_receipts').first()).toEqual({ count: 0 });
});

test('foreign and nonexistent finalize/verify identifiers share public code, status, size, timing class, and safe output', async () => {
  const left = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: nowSeconds(),
    tokenBytes: new Uint8Array(32).fill(74),
    ...secrets,
  });
  const right = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: nowSeconds(),
    tokenBytes: new Uint8Array(32).fill(75),
    ...secrets,
  });
  const started = await startFocusRehearsal({
    db: env.DB,
    workspaceId: left.workspace.id,
    now: nowSeconds(),
    environment: 'browser',
  });
  const nonexistent = '00000000-0000-4000-8000-000000000498';
  const headers = {
    cookie: right.setCookie!,
    'x-fcs-csrf': right.csrfToken,
  };
  const body = {
    manifest: {
      manifestVersion: 'focus-manifest-v1',
      targetIds: ['delete-trigger', 'dialog-title', 'reason-input', 'cancel-button', 'delete-button'],
      tabbableOrder: ['reason-input', 'cancel-button', 'delete-button'],
      dialogName: 'Delete account',
      dialogDescription: 'Deleting your account is permanent. You can optionally tell us why.',
      role: 'dialog',
      ariaModal: true,
      open: true,
      variantId: started.variantId,
      implementedRevision: 1,
    },
    events: [
      { eventType: 'dialog_open', targetId: 'delete-trigger', clientOffsetMs: 0 },
      { eventType: 'focusin', targetId: 'delete-button', clientOffsetMs: 1 },
      { eventType: 'keydown', targetId: 'delete-button', keyName: 'Tab', shiftKey: false, clientOffsetMs: 2 },
      { eventType: 'focusin', targetId: 'reason-input', clientOffsetMs: 3 },
      { eventType: 'keydown', targetId: 'reason-input', keyName: 'Tab', shiftKey: false, clientOffsetMs: 4 },
      { eventType: 'focusin', targetId: 'cancel-button', clientOffsetMs: 5 },
      { eventType: 'keydown', targetId: 'cancel-button', keyName: 'Tab', shiftKey: false, clientOffsetMs: 6 },
      { eventType: 'focusin', targetId: 'delete-button', clientOffsetMs: 7 },
      { eventType: 'keydown', targetId: 'delete-button', keyName: 'Tab', shiftKey: false, clientOffsetMs: 8 },
      { eventType: 'focusin', targetId: 'reason-input', clientOffsetMs: 9 },
      { eventType: 'keydown', targetId: 'reason-input', keyName: 'Tab', shiftKey: true, clientOffsetMs: 10 },
      { eventType: 'focusin', targetId: 'delete-button', clientOffsetMs: 11 },
      { eventType: 'keydown', targetId: 'delete-button', keyName: 'Escape', shiftKey: false, clientOffsetMs: 12 },
      { eventType: 'dialog_close', targetId: 'dialog-title', closeReason: 'escape', clientOffsetMs: 13 },
      { eventType: 'focus_return', targetId: 'delete-trigger', clientOffsetMs: 14 },
    ],
  };
  async function finalizeProbe(id: string) {
    const startedAt = performance.now();
    const response = await finalizePost(
      request(`/api/rehearsals/${id}/finalize`, body, headers),
      { params: Promise.resolve({ rehearsalSessionId: id }) },
    );
    return { response, text: await response.text(), duration: performance.now() - startedAt };
  }
  async function verifyProbe(id: string) {
    const startedAt = performance.now();
    const response = await verificationPost(request('/api/verifications', {
      rehearsalSessionId: id,
      implementedRevision: 1,
    }, headers));
    return { response, text: await response.text(), duration: performance.now() - startedAt };
  }
  for (const pair of [
    [await finalizeProbe(started.rehearsalSessionId), await finalizeProbe(nonexistent)],
    [await verifyProbe(started.rehearsalSessionId), await verifyProbe(nonexistent)],
  ] as const) {
    const [foreign, missing] = pair;
    expect(foreign.response.status).toBe(404);
    expect(missing.response.status).toBe(404);
    expect(foreign.text.length).toBe(missing.text.length);
    expect(Math.abs(foreign.duration - missing.duration)).toBeLessThan(100);
    const normalize = (value: string) => value.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gu,
      '<correlation>',
    );
    expect(normalize(foreign.text)).toBe(normalize(missing.text));
    expect(foreign.text).not.toContain(started.rehearsalSessionId);
    expect(foreign.text).not.toContain(left.workspace.id);
    expect(foreign.response.headers.get('cache-control')).toBe('no-store');
  }
});
