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

export type DisposableHostedD1RunWindow = {
  expiresAt: number;
  notBefore: number;
};

export type HostedD1ProbeErrorCode =
  | 'HOSTED_D1_SCHEMA_COLLISION'
  | 'HOSTED_D1_PROBE_ALREADY_USED'
  | 'HOSTED_D1_PROBE_ACQUIRE_FAILED'
  | 'HOSTED_D1_PROBE_FAILED'
  | 'HOSTED_D1_PROBE_CLEANUP_FAILED'
  | 'HOSTED_D1_SCHEMA_OWNERSHIP_LOST'
  | 'HOSTED_D1_FINALIZE_UNAVAILABLE'
  | 'HOSTED_D1_FINALIZE_FORBIDDEN'
  | 'HOSTED_D1_FINALIZE_BUSY'
  | 'HOSTED_D1_FINALIZE_FAILED';

export class HostedD1ProbeError extends Error {
  readonly code: HostedD1ProbeErrorCode;
  readonly recoveryRequired: boolean;

  constructor(
    code: HostedD1ProbeErrorCode,
    message: string,
    options: { cause?: unknown; recoveryRequired?: boolean } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'HostedD1ProbeError';
    this.code = code;
    this.recoveryRequired = options.recoveryRequired ?? false;
  }
}

const parentTableName = 'package0_parent';
const childTableName = 'package0_child';
const gateTableName = '__fcs_package0_probe_gate_20260829_6f1f3d8c';
const gateMarker = 'focus-contract-studio-package0-revision2';
const runningGateRecoveryLeaseSeconds = 120;
export const hostedD1RunDrainGraceSeconds = 5;
const maxD1WindowSeconds = 900;

const parentCreateSql = `CREATE TABLE ${parentTableName} (id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE) STRICT`;
const childCreateSql = `CREATE TABLE ${childTableName} (id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES ${parentTableName}(id), score INTEGER NOT NULL CHECK (score > 0)) STRICT`;
const expectedUpMigrationStatements = [
  'PRAGMA foreign_keys = ON',
  parentCreateSql,
  childCreateSql,
];
const expectedDownMigrationStatements = [
  `DROP TABLE ${childTableName}`,
  `DROP TABLE ${parentTableName}`,
];

const createGateSql = `
CREATE TABLE ${gateTableName} (
  marker TEXT PRIMARY KEY CHECK (marker = '${gateMarker}'),
  operator_token_sha256 TEXT NOT NULL CHECK (length(operator_token_sha256) = 64),
  state TEXT NOT NULL CHECK (state IN ('RUNNING', 'COMPLETE', 'FAILED', 'FINALIZING')),
  run_window_not_before INTEGER NOT NULL,
  run_window_expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (run_window_expires_at > run_window_not_before),
  CHECK (run_window_expires_at - run_window_not_before <= ${maxD1WindowSeconds}),
  CHECK (created_at >= run_window_not_before AND created_at < run_window_expires_at)
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
  operatorTokenSha256: string,
  runWindow: DisposableHostedD1RunWindow,
): Promise<DisposableHostedD1ProbeResult> {
  if (!/^[a-f0-9]{64}$/u.test(operatorTokenSha256)) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_PROBE_ACQUIRE_FAILED',
      'Hosted D1 operator-token digest is invalid',
    );
  }
  const runWindowDuration = runWindow.expiresAt - runWindow.notBefore;
  if (
    !Number.isSafeInteger(runWindow.notBefore) ||
    !Number.isSafeInteger(runWindow.expiresAt) ||
    runWindowDuration <= 0 ||
    runWindowDuration > maxD1WindowSeconds
  ) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_PROBE_ACQUIRE_FAILED',
      'Hosted D1 run window is invalid',
    );
  }
  requireExactMigration(
    upMigration,
    expectedUpMigrationStatements,
    'up migration',
  );
  requireExactMigration(
    downMigration,
    expectedDownMigrationStatements,
    'down migration',
  );

  await assertReservedSchemaIsClear(database);
  await database.exec('PRAGMA foreign_keys = ON;');
  await acquireSingleUseGate(database, operatorTokenSha256, runWindow);

  let operationError: unknown = null;
  let cleanupError: unknown = null;
  let result: DisposableHostedD1ProbeResult | null = null;

  try {
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

    await assertOwnedWorkTableSchemas(database, false);
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
    await dropVerifiedOwnedWorkTables(database);
    await requireNoWorkTables(database);
  } catch (error) {
    cleanupError = error;
  }

  try {
    await updateGateState(
      database,
      operatorTokenSha256,
      operationError || cleanupError ? 'FAILED' : 'COMPLETE',
    );
  } catch (error) {
    cleanupError ??= error;
  }

  if (cleanupError) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_PROBE_CLEANUP_FAILED',
      'Hosted D1 probe could not prove cleanup of its owned work tables',
      { cause: cleanupError, recoveryRequired: true },
    );
  }
  if (operationError || !result) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_PROBE_FAILED',
      'Hosted D1 behavior probe failed',
      { cause: operationError, recoveryRequired: true },
    );
  }

  return result;
}

export async function finalizeDisposableHostedD1Probe(
  database: D1Database,
  operatorToken: string,
  nowUnixSeconds = Math.floor(Date.now() / 1000),
): Promise<DisposableHostedD1FinalizeResult> {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(operatorToken)) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_FINALIZE_FORBIDDEN',
      'Hosted D1 operator token is invalid',
    );
  }
  const operatorTokenSha256 = await sha256Hex(operatorToken);

  await assertGateSchemaOwned(database);

  let gate: {
    operator_token_sha256: string;
    created_at: number;
    marker: string;
    run_window_expires_at: number;
    run_window_not_before: number;
    state: string;
  } | null;
  try {
    gate = await database
      .prepare(
        `SELECT marker, operator_token_sha256, state, run_window_not_before, run_window_expires_at, created_at FROM ${gateTableName} WHERE marker = ?`,
      )
      .bind(gateMarker)
      .first<{
        operator_token_sha256: string;
        created_at: number;
        marker: string;
        run_window_expires_at: number;
        run_window_not_before: number;
        state: string;
      }>();
  } catch (error) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_FINALIZE_UNAVAILABLE',
      'Hosted D1 single-use gate was not found',
      { cause: error },
    );
  }

  if (
    !gate ||
    !constantTimeTextEqual(gate.operator_token_sha256, operatorTokenSha256)
  ) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_FINALIZE_FORBIDDEN',
      'Hosted D1 operator token did not match the gate',
    );
  }
  const runWindowDuration =
    gate.run_window_expires_at - gate.run_window_not_before;
  const cleanupReadyAt =
    gate.run_window_expires_at + hostedD1RunDrainGraceSeconds;
  if (
    !Number.isSafeInteger(gate.run_window_not_before) ||
    !Number.isSafeInteger(gate.run_window_expires_at) ||
    runWindowDuration <= 0 ||
    runWindowDuration > maxD1WindowSeconds ||
    !Number.isSafeInteger(cleanupReadyAt)
  ) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_SCHEMA_OWNERSHIP_LOST',
      'Hosted D1 gate window metadata is not probe-owned',
    );
  }
  if (!Number.isInteger(nowUnixSeconds) || nowUnixSeconds < cleanupReadyAt) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_FINALIZE_BUSY',
      'Hosted D1 run window has not completed its cleanup drain',
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
      `UPDATE ${gateTableName} SET state = 'FINALIZING' WHERE marker = ? AND operator_token_sha256 = ? AND state = ?`,
    )
    .bind(gateMarker, operatorTokenSha256, gate.state)
    .run();
  if (claimed.success !== true || claimed.meta.changes !== 1) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_FINALIZE_BUSY',
      'Hosted D1 gate cleanup was already claimed',
    );
  }

  try {
    await dropVerifiedOwnedWorkTables(database);
    await requireNoWorkTables(database);
    await assertGateSchemaOwned(database);
    await database.exec(`DROP TABLE ${gateTableName};`);
    const residual = await countProbeTables(database);
    requireProbe(residual === 0, 'final gate cleanup');
  } catch (error) {
    try {
      await database
        .prepare(
          `UPDATE ${gateTableName} SET state = 'FAILED' WHERE marker = ? AND operator_token_sha256 = ? AND state = 'FINALIZING'`,
        )
        .bind(gateMarker, operatorTokenSha256)
        .run();
    } catch {
      // Preserve the original cleanup failure; the gate is never dropped early.
    }
    if (
      error instanceof HostedD1ProbeError &&
      error.code === 'HOSTED_D1_SCHEMA_OWNERSHIP_LOST'
    ) {
      throw error;
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
  operatorTokenSha256: string,
  runWindow: DisposableHostedD1RunWindow,
): Promise<void> {
  try {
    await database.batch([
      database.prepare(createGateSql),
      database
        .prepare(
          `INSERT INTO ${gateTableName} (marker, operator_token_sha256, state, run_window_not_before, run_window_expires_at) VALUES (?, ?, 'RUNNING', ?, ?)`,
        )
        .bind(
          gateMarker,
          operatorTokenSha256,
          runWindow.notBefore,
          runWindow.expiresAt,
        ),
      database.prepare(parentCreateSql),
      database.prepare(childCreateSql),
    ]);
  } catch (error) {
    if (await tableExists(database, gateTableName)) {
      throw new HostedD1ProbeError(
        'HOSTED_D1_PROBE_ALREADY_USED',
        'Hosted D1 single-use gate was acquired by another request',
        { cause: error },
      );
    }
    if (
      (await tableExists(database, parentTableName)) ||
      (await tableExists(database, childTableName))
    ) {
      throw new HostedD1ProbeError(
        'HOSTED_D1_SCHEMA_COLLISION',
        'Hosted D1 reserved work-table names were acquired elsewhere',
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

async function assertGateSchemaOwned(database: D1Database): Promise<void> {
  const schema = await database
    .prepare(
      "SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = ?",
    )
    .bind(gateTableName)
    .first<{ sql: string }>();
  if (!schema) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_FINALIZE_UNAVAILABLE',
      'Hosted D1 single-use gate was not found',
    );
  }
  if (normalizeSql(schema.sql) !== normalizeSql(createGateSql)) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_SCHEMA_OWNERSHIP_LOST',
      'Hosted D1 exact-name gate schema is not probe-owned',
    );
  }
}

async function updateGateState(
  database: D1Database,
  operatorTokenSha256: string,
  state: 'COMPLETE' | 'FAILED',
): Promise<void> {
  const updated = await database
    .prepare(
      `UPDATE ${gateTableName} SET state = ? WHERE marker = ? AND operator_token_sha256 = ? AND state = 'RUNNING'`,
    )
    .bind(state, gateMarker, operatorTokenSha256)
    .run();
  requireProbe(
    updated.success === true && updated.meta.changes === 1,
    'single-use gate state',
  );
}

async function dropVerifiedOwnedWorkTables(
  database: D1Database,
): Promise<void> {
  await assertOwnedWorkTableSchemas(database, true);
  await database.exec(cleanupOwnedWorkSql);
}

async function assertOwnedWorkTableSchemas(
  database: D1Database,
  allowAbsent: boolean,
): Promise<void> {
  const rows = await database
    .prepare(
      "SELECT name, sql FROM sqlite_schema WHERE type = 'table' AND name IN (?, ?)",
    )
    .bind(parentTableName, childTableName)
    .all<{ name: string; sql: string }>();
  const schemas = new Map(rows.results.map((row) => [row.name, row.sql]));
  if (
    (!allowAbsent && schemas.size !== 2) ||
    (schemas.has(parentTableName) &&
      normalizeSql(schemas.get(parentTableName)!) !== normalizeSql(parentCreateSql)) ||
    (schemas.has(childTableName) &&
      normalizeSql(schemas.get(childTableName)!) !== normalizeSql(childCreateSql))
  ) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_SCHEMA_OWNERSHIP_LOST',
      'Hosted D1 exact-name work-table schema is not probe-owned',
    );
  }
}

function requireExactMigration(
  migration: string,
  expectedStatements: string[],
  label: string,
): void {
  const statements = migration
    .split(';')
    .map((statement) => normalizeSql(statement))
    .filter(Boolean);
  if (
    statements.length !== expectedStatements.length ||
    statements.some(
      (statement, index) =>
        statement !== normalizeSql(expectedStatements[index] ?? ''),
    )
  ) {
    throw new HostedD1ProbeError(
      'HOSTED_D1_PROBE_ACQUIRE_FAILED',
      `Hosted D1 ${label} is not the sealed Package 0 migration`,
    );
  }
}

function normalizeSql(sql: string): string {
  return sql.trim().replace(/\s+/gu, ' ');
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
