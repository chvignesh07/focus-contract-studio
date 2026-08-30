import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, test } from 'vitest';

import {
  SESSION_COOKIE_NAME,
  issueSessionCookie,
  parseSessionCookie,
} from '../../lib/server/session';
import { bootstrapWorkspace } from '../../lib/server/workspaces';

const sessionSecret = 'package1-test-session-secret-material-32-bytes-minimum';
const csrfSecret = 'package1-test-csrf-secret-material-32-bytes-minimum';
const now = 1_788_100_000;
const token = new Uint8Array(32).fill(7);

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM workspaces').run();
});

describe('signed anonymous session cookie', () => {
  test('uses a 256-bit token and exact host-only security attributes', async () => {
    const issued = await issueSessionCookie({ token, now, sessionSecret });
    expect(issued.name).toBe('__Host-fcs_session');
    expect(issued.header).toMatch(
      /^__Host-fcs_session=[A-Za-z0-9._-]+; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800$/,
    );
    expect(issued.header).not.toContain('Domain=');
    const parsed = await parseSessionCookie(issued.header, {
      now,
      sessionSecret,
    });
    expect(parsed?.token).toEqual(token);
    expect(parsed?.issuedAt).toBe(now);
  });

  test('rejects malformed, tampered, future, and expired cookies', async () => {
    const issued = await issueSessionCookie({ token, now, sessionSecret });
    const value = issued.header.split(';', 1)[0]!.slice(
      `${SESSION_COOKIE_NAME}=`.length,
    );
    const last = value.at(-1)!;
    const tampered = `${value.slice(0, -1)}${last === 'A' ? 'B' : 'A'}`;

    await expect(
      parseSessionCookie(`${SESSION_COOKIE_NAME}=${tampered}`, {
        now,
        sessionSecret,
      }),
    ).resolves.toBeNull();
    await expect(
      parseSessionCookie(`${SESSION_COOKIE_NAME}=not-a-cookie`, {
        now,
        sessionSecret,
      }),
    ).resolves.toBeNull();
    await expect(
      parseSessionCookie(issued.header, {
        now: now - 31,
        sessionSecret,
      }),
    ).resolves.toBeNull();
    await expect(
      parseSessionCookie(issued.header, {
        now: now + 28_801,
        sessionSecret,
      }),
    ).resolves.toBeNull();
  });
});

test('bootstrap creates once, persists on reload, and never stores the raw bearer', async () => {
  const first = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now,
    tokenBytes: token,
    sessionSecret,
    csrfSecret,
  });
  expect(first.created).toBe(true);
  expect(first.setCookie).toContain('__Host-fcs_session=');
  expect(first.workspace.generation).toBe(1);

  const reload = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: first.setCookie,
    now: now + 10,
    sessionSecret,
    csrfSecret,
  });
  expect(reload.created).toBe(false);
  expect(reload.setCookie).toBeNull();
  expect(reload.workspace).toEqual(first.workspace);
  expect(reload.csrfToken).toBe(first.csrfToken);

  const rows = await env.DB.prepare(
    `SELECT subject_key, csrf_digest FROM workspaces`,
  ).all<Record<string, string>>();
  const serialized = JSON.stringify(rows.results);
  const rawCookieValue = first.setCookie!.split(';', 1)[0]!.split('=', 2)[1]!;
  expect(serialized).not.toContain(rawCookieValue);
  expect(serialized).not.toContain(first.csrfToken);
  expect(rows.results[0]?.subject_key).toMatch(/^[a-f0-9]{64}$/);
  expect(rows.results[0]?.csrf_digest).toMatch(/^[a-f0-9]{64}$/);
});

test('a present invalid cookie fails closed instead of silently creating a workspace', async () => {
  await expect(
    bootstrapWorkspace({
      db: env.DB,
      cookieHeader: `${SESSION_COOKIE_NAME}=forged`,
      now,
      sessionSecret,
      csrfSecret,
    }),
  ).rejects.toMatchObject({ code: 'SESSION_INVALID' });
  expect(
    await env.DB.prepare('SELECT COUNT(*) AS count FROM workspaces').first<{
      count: number;
    }>(),
  ).toEqual({ count: 0 });
});
