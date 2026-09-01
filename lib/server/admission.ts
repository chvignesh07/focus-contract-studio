import { deterministicUuid, hmacSha256Hex } from './crypto';
import { FcsError } from './errors';

const GLOBAL_WINDOW_SECONDS = 60;
const GLOBAL_RETENTION_SECONDS = 2 * GLOBAL_WINDOW_SECONDS;
export const WORKSPACE_WINDOW_SECONDS = 60 * 60;
const WORKSPACE_RETENTION_SECONDS = 2 * WORKSPACE_WINDOW_SECONDS;

export const GLOBAL_OPERATION_LIMITS = {
  workspace_bootstrap: 32,
  workspace_reset: 32,
} as const;

export type GlobalOperation = keyof typeof GLOBAL_OPERATION_LIMITS;

export const WORKSPACE_OPERATION_LIMITS = {
  proposal: 10,
  review: 10,
  apply: 6,
  rehearsal: 12,
  verification: 12,
  undo: 6,
  reset: 5,
} as const;

export type WorkspaceOperation = keyof typeof WORKSPACE_OPERATION_LIMITS;

async function cleanupExpiredWindows(db: D1Database, now: number): Promise<void> {
  const cleanup = await db
    .prepare(
      `DELETE FROM rate_limit_windows
        WHERE id IN (
          SELECT id FROM rate_limit_windows
           WHERE expires_at < ?
           ORDER BY expires_at, id
           LIMIT 10
        )`,
    )
    .bind(now)
    .run();
  if (!cleanup.success) throw new Error('Admission-window cleanup failed.');
}

export async function admitGlobalOperation(input: {
  db: D1Database;
  operation: GlobalOperation;
  now: number;
  secret: string;
}): Promise<number> {
  const limit = GLOBAL_OPERATION_LIMITS[input.operation];
  const windowStart =
    Math.floor(input.now / GLOBAL_WINDOW_SECONDS) * GLOBAL_WINDOW_SECONDS;
  const keyDigest = await hmacSha256Hex(
    input.secret,
    `fcs-global-admission-v1:${input.operation}`,
  );
  const id = await deterministicUuid(
    `fcs-global-admission-window-v1:${input.operation}:${windowStart}:${keyDigest}`,
  );
  await cleanupExpiredWindows(input.db, input.now);

  const admitted = await input.db
    .prepare(
      `INSERT INTO rate_limit_windows (
         id, workspace_id, key_digest, operation, window_start,
         window_seconds, request_count, expires_at
       ) VALUES (?, NULL, ?, ?, ?, ?, 1, ?)
       ON CONFLICT(key_digest, operation, window_start)
         WHERE workspace_id IS NULL
       DO UPDATE SET request_count = rate_limit_windows.request_count + 1
         WHERE rate_limit_windows.request_count < ?
       RETURNING request_count`,
    )
    .bind(
      id,
      keyDigest,
      input.operation,
      windowStart,
      GLOBAL_WINDOW_SECONDS,
      windowStart + GLOBAL_RETENTION_SECONDS,
      limit,
    )
    .first<{ request_count: number }>();
  if (!admitted) {
    throw new FcsError(
      'RATE_LIMITED',
      'The service is temporarily at its request limit. Try again shortly.',
      429,
      true,
    );
  }
  return admitted.request_count;
}

export async function admitWorkspaceOperation(input: {
  db: D1Database;
  workspaceId: string;
  operation: WorkspaceOperation;
  now: number;
  secret: string;
}): Promise<number> {
  const limit = WORKSPACE_OPERATION_LIMITS[input.operation];
  const subject = await input.db
    .prepare(
      `SELECT COALESCE(admission_subject_key, subject_key) AS admission_subject_key
         FROM workspaces
        WHERE id = ? AND purged_at IS NULL AND access_expires_at >= ?
        LIMIT 1`,
    )
    .bind(input.workspaceId, input.now)
    .first<{ admission_subject_key: string }>();
  if (!subject || !/^[0-9a-f]{64}$/u.test(subject.admission_subject_key)) {
    throw new FcsError('SESSION_EXPIRED', 'The session has expired.', 401);
  }
  const windowStart =
    Math.floor(input.now / WORKSPACE_WINDOW_SECONDS) * WORKSPACE_WINDOW_SECONDS;
  const keyDigest = await hmacSha256Hex(
    input.secret,
    `fcs-workspace-admission-v2:${subject.admission_subject_key}:${input.operation}`,
  );
  const id = await deterministicUuid(
    `fcs-workspace-admission-window-v1:${input.workspaceId}:${input.operation}:${windowStart}:${keyDigest}`,
  );
  await cleanupExpiredWindows(input.db, input.now);
  const admitted = await input.db
    .prepare(
      `INSERT INTO rate_limit_windows (
         id, workspace_id, key_digest, operation, window_start,
         window_seconds, request_count, expires_at
       ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT(key_digest, operation, window_start)
         WHERE workspace_id IS NOT NULL
       DO UPDATE SET request_count = rate_limit_windows.request_count + 1
         WHERE rate_limit_windows.request_count < ?
       RETURNING request_count`,
    )
    .bind(
      id,
      input.workspaceId,
      keyDigest,
      input.operation,
      windowStart,
      WORKSPACE_WINDOW_SECONDS,
      windowStart + WORKSPACE_RETENTION_SECONDS,
      limit,
    )
    .first<{ request_count: number }>();
  if (!admitted) {
    throw new FcsError(
      'RATE_LIMITED',
      'This workspace is temporarily at its operation limit. Try again later.',
      429,
      true,
    );
  }
  return admitted.request_count;
}

export function workspaceAdmission(input: {
  db: D1Database;
  operation: WorkspaceOperation;
  now: number;
  secret: string;
}): (workspaceId: string) => Promise<void> {
  return async (workspaceId) => {
    await admitWorkspaceOperation({ ...input, workspaceId });
  };
}
