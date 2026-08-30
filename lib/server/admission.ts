import { deterministicUuid, hmacSha256Hex } from './crypto';
import { FcsError } from './errors';

const WINDOW_SECONDS = 60;
const RETENTION_SECONDS = 2 * WINDOW_SECONDS;

export const GLOBAL_OPERATION_LIMITS = {
  workspace_bootstrap: 32,
  workspace_reset: 32,
} as const;

export type GlobalOperation = keyof typeof GLOBAL_OPERATION_LIMITS;

export async function admitGlobalOperation(input: {
  db: D1Database;
  operation: GlobalOperation;
  now: number;
  secret: string;
}): Promise<number> {
  const limit = GLOBAL_OPERATION_LIMITS[input.operation];
  const windowStart = Math.floor(input.now / WINDOW_SECONDS) * WINDOW_SECONDS;
  const keyDigest = await hmacSha256Hex(
    input.secret,
    `fcs-global-admission-v1:${input.operation}`,
  );
  const id = await deterministicUuid(
    `fcs-global-admission-window-v1:${input.operation}:${windowStart}:${keyDigest}`,
  );
  const cleanup = await input.db
    .prepare(
      `DELETE FROM rate_limit_windows
        WHERE id IN (
          SELECT id FROM rate_limit_windows
           WHERE expires_at < ?
           ORDER BY expires_at, id
           LIMIT 10
        )`,
    )
    .bind(input.now)
    .run();
  if (!cleanup.success) throw new Error('Admission-window cleanup failed.');

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
      WINDOW_SECONDS,
      windowStart + RETENTION_SECONDS,
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
