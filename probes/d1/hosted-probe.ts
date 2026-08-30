import { interpretRequiredSingleRow } from './d1-probe.ts';

export type DisposableHostedD1ProbeResult = {
  migration: 'PASS';
  preparedQuery: 'PASS';
  strictTable: 'PASS';
  uniqueConstraint: 'PASS';
  foreignKeyConstraint: 'PASS';
  checkConstraint: 'PASS';
  batchRollback: 'PASS';
  zeroRowGuard: 'PASS';
  rollback: 'PASS';
  residualWorkTableCount: 0;
  singleUseGate: 'SEALED';
};

export type DisposableHostedD1FinalizeResult = {
  rollback: 'PASS';
  gateCleanup: 'PASS';
  residualProbeTableCount: 0;
};

export type HostedD1ProbeErrorCode =
  | 'HOSTED_D1_SCHEMA_COLLISION'
  | 'HOSTED_D1_PROBE_ALREADY_USED'
  | 'HOSTED_D1_PROBE_ACQUIRE_FAILED'
  | 'HOSTED_D1_PROBE_FAILED'
  | 'HOSTED_D1_PROBE_CLEANUP_FAILED'
  | 'HOSTED_D1_FINALIZE_UNAVAILABLE'
  | 'HOSTED_D1_FINALIZE_FORBIDDEN'
  | 'HOSTED_D1_FINALIZE_BUSY'
  | 'HOSTED_D1_FINALIZE_FAILED';

export class HostedD1ProbeError extends Error {
  readonly cleanupAuthorized: boolean;
  readonly code: HostedD1ProbeErrorCode;

  constructor(
    code: HostedD1ProbeErrorCode,
    message: string,
    options: { cause?: unknown; cleanupAuthorized?: boolean } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'HostedD1ProbeError';
    this.code = code;
    this.cleanupAuthorized = options.cleanupAuthorized ?? false;
  }
}

const parentTableName = 'package0_parent';
const childTableName = 'package0_child';
const gateTableName = '__fcs_package0_probe_gate_20260829_6f1f3d8c';
const gateMarker = 'focus-contract-studio-package0-revision2';
const runningGateRecoveryLeaseSeconds = 120;

const createGateSql = `
CREATE TABLE ${gateTableName} (
  marker TEXT PRIMARY KEY CHECK (marker = '${gateMarker}'),
  cleanup_token_sha256 TEXT NOT NULL CHECK (length(cleanup_token_sha256) = 64),
  state TEXT NOT NULL CHECK (state IN ('RUNNING', 'COMPLETE', 'FAILED', 'FINALIZING')),
  created_at INTEGER NOT NULL
) STRICT
`;

const cleanupOwnedWorkSql = `
DROP TABLE IF EXISTS ${childTableName};
DROP TABLE IF EXISTS ${parentTableName};
`;

export async function runDisposableHostedD1Probe(
  database: D1Database,
  upMigration: string,
  downMigration: string,
  cleanupTokenSha256: string,
): Promise<DisposableHostedD1ProbeResult> {
  if (!/^[a-f0-9]{64}$/u.test(cleanupTokenSha256)) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_PROBE_ACQUIRE_FAILED',
      'Hosted D1 cleanup-token digest is invalid',
    );
  }

  await assertReservedSchemaIsClear(database);
  await acquireSingleUseGate(database, cleanupTokenSha256);

  let operationError: unknown = null;
  let cleanupError: unknown = null;
  let result: DisposableHostedD1ProbeResult | null = null;

  try {
    await database.exec(upMigration);

    const schema = await database
      .prepare(
        "SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = ?",
      )
      .bind(parentTableName)
      .first<{ sql: string }>();
    requireProbe(schema?.sql?.endsWith(' STRICT') === true, 'STRICT table');

    await database
      .prepare(`INSERT INTO ${parentTableName} (id, slug) VALUES (?, ?)`)
      .bind(1, 'prepared-query')
      .run();
    const preparedRow = await database
      .prepare(`SELECT id, slug FROM ${parentTableName} WHERE id = ?`)
      .bind(1)
      .first<{ id: number; slug: string }>();
    requireProbe(
      preparedRow?.id === 1 && preparedRow.slug === 'prepared-query',
      'prepared query',
    );

    const uniqueRejected = await rejectsWith(
      database
        .prepare(`INSERT INTO ${parentTableName} (id, slug) VALUES (?, ?)`)
        .bind(2, 'prepared-query')
        .run(),
      /UNIQUE constraint failed/u,
    );
    const foreignKeyRejected = await rejectsWith(
      database
        .prepare(
          `INSERT INTO ${childTableName} (id, parent_id, score) VALUES (?, ?, ?)`,
        )
        .bind(1, 404, 1)
        .run(),
      /FOREIGN KEY constraint failed/u,
    );
    const checkRejected = await rejectsWith(
      database
        .prepare(
          `INSERT INTO ${childTableName} (id, parent_id, score) VALUES (?, ?, ?)`,
        )
        .bind(1, 1, 0)
        .run(),
      /CHECK constraint failed/u,
    );
    requireProbe(uniqueRejected, 'unique constraint');
    requireProbe(foreignKeyRejected, 'foreign-key constraint');
    requireProbe(checkRejected, 'check constraint');

    await database.prepare(`DELETE FROM ${parentTableName}`).run();

    const batchRejected = await rejectsWith(
      database.batch([
        database
          .prepare(`INSERT INTO ${parentTableName} (id, slug) VALUES (?, ?)`)
          .bind(10, 'rollback'),
        database
          .prepare(`INSERT INTO ${parentTableName} (id, slug) VALUES (?, ?)`)
          .bind(11, 'rollback'),
      ]),
      /UNIQUE constraint failed/u,
    );
    const afterBatch = await database
      .prepare(`SELECT COUNT(*) AS count FROM ${parentTableName}`)
      .first<{ count: number }>();
    requireProbe(batchRejected && afterBatch?.count === 0, 'batch rollback');

    const zeroRow = await database
      .prepare(`UPDATE ${parentTableName} SET slug = ? WHERE id = ?`)
      .bind('never-written', 404)
      .run();
    const interpretedZeroRow = interpretRequiredSingleRow(zeroRow);
    requireProbe(
      zeroRow.success === true &&
        zeroRow.meta.changes === 0 &&
        interpretedZeroRow.ok === false &&
        interpretedZeroRow.code === 'ZERO_ROW_REJECTED',
      'zero-row guard',
    );

    await database.exec(downMigration);
    await requireNoWorkTables(database);

    result = {
      migration: 'PASS',
      preparedQuery: 'PASS',
      strictTable: 'PASS',
      uniqueConstraint: 'PASS',
      foreignKeyConstraint: 'PASS',
      checkConstraint: 'PASS',
      batchRollback: 'PASS',
      zeroRowGuard: 'PASS',
      rollback: 'PASS',
      residualWorkTableCount: 0,
      singleUseGate: 'SEALED',
    };
  } catch (error) {
    operationError = error;
  }

  try {
    await database.exec(cleanupOwnedWorkSql);
    await requireNoWorkTables(database);
  } catch (error) {
    cleanupError = error;
  }

  try {
    await updateGateState(
      database,
      cleanupTokenSha256,
      operationError || cleanupError ? 'FAILED' : 'COMPLETE',
    );
  } catch (error) {
    cleanupError ??= error;
  }

  if (cleanupError) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_PROBE_CLEANUP_FAILED',
      'Hosted D1 probe could not prove cleanup of its owned work tables',
      { cause: cleanupError, cleanupAuthorized: true },
    );
  }
  if (operationError || !result) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_PROBE_FAILED',
      'Hosted D1 behavior probe failed',
      { cause: operationError, cleanupAuthorized: true },
    );
  }

  return result;
}

export async function finalizeDisposableHostedD1Probe(
  database: D1Database,
  cleanupToken: string,
  nowUnixSeconds = Math.floor(Date.now() / 1000),
): Promise<DisposableHostedD1FinalizeResult> {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(cleanupToken)) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_FINALIZE_FORBIDDEN',
      'Hosted D1 cleanup token is invalid',
    );
  }
  const cleanupTokenSha256 = await sha256Hex(cleanupToken);

  let gate: {
    cleanup_token_sha256: string;
    created_at: number;
    marker: string;
    state: string;
  } | null;
  try {
    gate = await database
      .prepare(
        `SELECT marker, cleanup_token_sha256, state, created_at FROM ${gateTableName} WHERE marker = ?`,
      )
      .bind(gateMarker)
      .first<{
        cleanup_token_sha256: string;
        created_at: number;
        marker: string;
        state: string;
      }>();
  } catch (error) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_FINALIZE_UNAVAILABLE',
      'Hosted D1 single-use gate was not found',
      { cause: error },
    );
  }

  if (!gate || !constantTimeTextEqual(gate.cleanup_token_sha256, cleanupTokenSha256)) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_FINALIZE_FORBIDDEN',
      'Hosted D1 cleanup token did not match the gate',
    );
  }
  const runningGateLeaseExpired =
    gate.state === 'RUNNING' &&
    Number.isInteger(nowUnixSeconds) &&
    nowUnixSeconds - gate.created_at >= runningGateRecoveryLeaseSeconds;
  if (
    gate.state !== 'COMPLETE' &&
    gate.state !== 'FAILED' &&
    !runningGateLeaseExpired
  ) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_FINALIZE_BUSY',
      'Hosted D1 gate is not ready for final cleanup',
    );
  }

  const claimed = await database
    .prepare(
      `UPDATE ${gateTableName} SET state = 'FINALIZING' WHERE marker = ? AND cleanup_token_sha256 = ? AND state = ?`,
    )
    .bind(gateMarker, cleanupTokenSha256, gate.state)
    .run();
  if (claimed.success !== true || claimed.meta.changes !== 1) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_FINALIZE_BUSY',
      'Hosted D1 gate cleanup was already claimed',
    );
  }

  try {
    await database.exec(cleanupOwnedWorkSql);
    await requireNoWorkTables(database);
    await database.exec(`DROP TABLE ${gateTableName};`);
    const residual = await countProbeTables(database);
    requireProbe(residual === 0, 'final gate cleanup');
  } catch (error) {
    try {
      await database
        .prepare(
          `UPDATE ${gateTableName} SET state = 'FAILED' WHERE marker = ? AND cleanup_token_sha256 = ? AND state = 'FINALIZING'`,
        )
        .bind(gateMarker, cleanupTokenSha256)
        .run();
    } catch {
      // Preserve the original cleanup failure; the gate is never dropped early.
    }
    throw new HostedD1ProbeError(
      'HOSTED_D1_FINALIZE_FAILED',
      'Hosted D1 final cleanup failed',
      { cause: error },
    );
  }

  return {
    rollback: 'PASS',
    gateCleanup: 'PASS',
    residualProbeTableCount: 0,
  };
}

async function assertReservedSchemaIsClear(database: D1Database): Promise<void> {
  const reserved = await database
    .prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN (?, ?, ?)",
    )
    .bind(parentTableName, childTableName, gateTableName)
    .all<{ name: string }>();
  const names = new Set(reserved.results.map((row) => row.name));

  if (names.has(gateTableName)) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_PROBE_ALREADY_USED',
      'Hosted D1 single-use gate already exists',
    );
  }
  if (names.has(parentTableName) || names.has(childTableName)) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_SCHEMA_COLLISION',
      'Hosted D1 reserved work-table names already exist',
    );
  }
}

async function acquireSingleUseGate(
  database: D1Database,
  cleanupTokenSha256: string,
): Promise<void> {
  try {
    await database.batch([
      database.prepare(createGateSql),
      database
        .prepare(
          `INSERT INTO ${gateTableName} (marker, cleanup_token_sha256, state, created_at) VALUES (?, ?, 'RUNNING', unixepoch())`,
        )
        .bind(gateMarker, cleanupTokenSha256),
    ]);
  } catch (error) {
    if (await tableExists(database, gateTableName)) {
      throw new HostedD1ProbeError(
        'HOSTED_D1_PROBE_ALREADY_USED',
        'Hosted D1 single-use gate was acquired by another request',
        { cause: error },
      );
    }
    throw new HostedD1ProbeError(
      'HOSTED_D1_PROBE_ACQUIRE_FAILED',
      'Hosted D1 single-use gate could not be acquired',
      { cause: error },
    );
  }
}

async function updateGateState(
  database: D1Database,
  cleanupTokenSha256: string,
  state: 'COMPLETE' | 'FAILED',
): Promise<void> {
  const updated = await database
    .prepare(
      `UPDATE ${gateTableName} SET state = ? WHERE marker = ? AND cleanup_token_sha256 = ? AND state = 'RUNNING'`,
    )
    .bind(state, gateMarker, cleanupTokenSha256)
    .run();
  requireProbe(
    updated.success === true && updated.meta.changes === 1,
    'single-use gate state',
  );
}

async function requireNoWorkTables(database: D1Database): Promise<void> {
  const residual = await database
    .prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN (?, ?)",
    )
    .bind(parentTableName, childTableName)
    .all<{ name: string }>();
  requireProbe(residual.results.length === 0, 'owned work-table cleanup');
}

async function countProbeTables(database: D1Database): Promise<number> {
  const residual = await database
    .prepare(
      "SELECT COUNT(*) AS count FROM sqlite_schema WHERE type = 'table' AND name IN (?, ?, ?)",
    )
    .bind(parentTableName, childTableName, gateTableName)
    .first<{ count: number }>();
  return residual?.count ?? -1;
}

async function tableExists(
  database: D1Database,
  tableName: string,
): Promise<boolean> {
  const result = await database
    .prepare(
      "SELECT 1 AS present FROM sqlite_schema WHERE type = 'table' AND name = ?",
    )
    .bind(tableName)
    .first<{ present: number }>();
  return result?.present === 1;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function constantTimeTextEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function rejectsWith(
  operation: Promise<unknown>,
  pattern: RegExp,
): Promise<boolean> {
  try {
    await operation;
    return false;
  } catch (error) {
    return pattern.test(error instanceof Error ? error.message : String(error));
  }
}

function requireProbe(condition: boolean, check: string): asserts condition {
  if (!condition) {
    throw new Error(`Hosted D1 probe failed: ${check}`);
  }
}
