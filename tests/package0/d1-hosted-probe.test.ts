import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import { Miniflare } from 'miniflare';

import {
  finalizeDisposableHostedD1Probe,
  HostedD1ProbeError,
  runDisposableHostedD1Probe,
} from '../../probes/d1/hosted-probe.ts';

const upMigrationUrl = new URL(
  '../../probes/d1/migrations/0001_package0_probe.up.sql',
  import.meta.url,
);
const downMigrationUrl = new URL(
  '../../probes/d1/migrations/0001_package0_probe.down.sql',
  import.meta.url,
);

test('hosted D1 probe runner proves behavior and removes its disposable schema', async () => {
  const miniflare = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    d1Databases: { DB: 'focus-contract-studio-package0-hosted-runner' },
    d1Persist: false,
  });
  try {
    const database = await miniflare.getD1Database('DB');
    const [upMigration, downMigration] = await Promise.all([
      readFile(upMigrationUrl, 'utf8'),
      readFile(downMigrationUrl, 'utf8'),
    ]);
    const result = await runDisposableHostedD1Probe(
      database,
      upMigration,
      downMigration,
      'a'.repeat(64),
      activeRunWindow(),
    );

    assert.deepEqual(result, {
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
    });

    const residual = await database
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name LIKE 'package0_%'",
      )
      .all();
    assert.deepEqual(residual.results, []);

    const gate = await database
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name LIKE '__fcs_package0_probe_gate_%'",
      )
      .all();
    assert.equal(gate.results.length, 1);
  } finally {
    await miniflare.dispose();
  }
});

test('hosted D1 probe refuses pre-existing reserved tables without changing their data', async () => {
  const miniflare = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    d1Databases: { DB: 'focus-contract-studio-package0-hosted-sentinel' },
    d1Persist: false,
  });

  try {
    const database = await miniflare.getD1Database('DB');
    const [upMigration, downMigration] = await Promise.all([
      readFile(upMigrationUrl, 'utf8'),
      readFile(downMigrationUrl, 'utf8'),
    ]);
    await database.exec(
      "CREATE TABLE package0_parent (id INTEGER PRIMARY KEY, sentinel TEXT NOT NULL) STRICT; INSERT INTO package0_parent VALUES (1, 'preserve-me');",
    );

    await assert.rejects(
      runDisposableHostedD1Probe(
        database,
        upMigration,
        downMigration,
        'b'.repeat(64),
        activeRunWindow(),
      ),
      (error: unknown) =>
        error instanceof Error &&
        'code' in error &&
        error.code === 'HOSTED_D1_SCHEMA_COLLISION',
    );
    const sentinel = await database
      .prepare('SELECT sentinel FROM package0_parent WHERE id = 1')
      .first<{ sentinel: string }>();
    assert.equal(sentinel?.sentinel, 'preserve-me');
    const gate = await database
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name LIKE '__fcs_package0_probe_gate_%'",
      )
      .all();
    assert.deepEqual(gate.results, []);
  } finally {
    await miniflare.dispose();
  }
});

test('pre-existing child and gate names also fail closed without changing sentinels', async () => {
  const [upMigration, downMigration] = await Promise.all([
    readFile(upMigrationUrl, 'utf8'),
    readFile(downMigrationUrl, 'utf8'),
  ]);
  const cases = [
    {
      databaseName: 'focus-contract-studio-package0-child-collision',
      expectedCode: 'HOSTED_D1_SCHEMA_COLLISION',
      name: 'package0_child',
    },
    {
      databaseName: 'focus-contract-studio-package0-gate-collision',
      expectedCode: 'HOSTED_D1_PROBE_ALREADY_USED',
      name: '__fcs_package0_probe_gate_20260829_6f1f3d8c',
    },
  ] as const;

  for (const collision of cases) {
    const miniflare = new Miniflare({
      modules: true,
      script: 'export default { fetch() { return new Response("ok"); } }',
      d1Databases: { DB: collision.databaseName },
      d1Persist: false,
    });
    try {
      const database = await miniflare.getD1Database('DB');
      await database.exec(
        `CREATE TABLE ${collision.name} (id INTEGER PRIMARY KEY, sentinel TEXT NOT NULL) STRICT; INSERT INTO ${collision.name} VALUES (1, 'preserve-me');`,
      );
      await assert.rejects(
        runDisposableHostedD1Probe(
          database,
          upMigration,
          downMigration,
          'c'.repeat(64),
          activeRunWindow(),
        ),
        (error: unknown) =>
          error instanceof HostedD1ProbeError &&
          error.code === collision.expectedCode,
      );
      const sentinel = await database
        .prepare(`SELECT sentinel FROM ${collision.name} WHERE id = 1`)
        .first<{ sentinel: string }>();
      assert.equal(sentinel?.sentinel, 'preserve-me');
    } finally {
      await miniflare.dispose();
    }
  }
});

test('cleanup failure keeps the durable gate and operator authorization can recover every owned table', async () => {
  const miniflare = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    d1Databases: { DB: 'focus-contract-studio-package0-cleanup-recovery' },
    d1Persist: false,
  });

  try {
    const database = await miniflare.getD1Database('DB');
    const [upMigration, downMigration] = await Promise.all([
      readFile(upMigrationUrl, 'utf8'),
      readFile(downMigrationUrl, 'utf8'),
    ]);
    await database.exec(
      "CREATE TABLE package0_unrelated (id INTEGER PRIMARY KEY, sentinel TEXT NOT NULL) STRICT; INSERT INTO package0_unrelated VALUES (1, 'preserve-me');",
    );
    const operatorToken = Buffer.alloc(32, 9).toString('base64url');
    const operatorTokenSha256 = createHash('sha256')
      .update(operatorToken)
      .digest('hex');
    let forcedDropFailures = 2;
    const failingDatabase = new Proxy(database, {
      get(target, property) {
        if (property === 'exec') {
          return async (sql: string) => {
            if (sql.includes('DROP TABLE') && forcedDropFailures > 0) {
              forcedDropFailures -= 1;
              throw new Error('forced cleanup failure');
            }
            return target.exec(sql);
          };
        }
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1Database;

    await assert.rejects(
      runDisposableHostedD1Probe(
        failingDatabase,
        upMigration,
        downMigration,
        operatorTokenSha256,
        activeRunWindow(),
      ),
      (error: unknown) =>
        error instanceof HostedD1ProbeError &&
        error.code === 'HOSTED_D1_PROBE_CLEANUP_FAILED' &&
        error.recoveryRequired,
    );

    const beforeRecovery = await database
      .prepare(
        "SELECT COUNT(*) AS count FROM sqlite_schema WHERE type = 'table' AND name IN ('package0_parent', 'package0_child', '__fcs_package0_probe_gate_20260829_6f1f3d8c')",
      )
      .first<{ count: number }>();
    assert.equal(beforeRecovery?.count, 3);

    const recovered = await finalizeDisposableHostedD1Probe(
      database,
      operatorToken,
      4_102_444_800,
    );
    assert.deepEqual(recovered, {
      rollback: 'PASS',
      gateCleanup: 'PASS',
      residualProbeTableCount: 0,
    });
    const afterRecovery = await database
      .prepare(
        "SELECT COUNT(*) AS count FROM sqlite_schema WHERE type = 'table' AND name IN ('package0_parent', 'package0_child', '__fcs_package0_probe_gate_20260829_6f1f3d8c')",
      )
      .first<{ count: number }>();
    assert.equal(afterRecovery?.count, 0);
    const unrelated = await database
      .prepare('SELECT sentinel FROM package0_unrelated WHERE id = 1')
      .first<{ sentinel: string }>();
    assert.equal(unrelated?.sentinel, 'preserve-me');
  } finally {
    await miniflare.dispose();
  }
});

test('an expired RUNNING gate recovers after a forced state-transition failure', async () => {
  const miniflare = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    d1Databases: { DB: 'focus-contract-studio-package0-running-recovery' },
    d1Persist: false,
  });

  try {
    const database = await miniflare.getD1Database('DB');
    const [upMigration, downMigration] = await Promise.all([
      readFile(upMigrationUrl, 'utf8'),
      readFile(downMigrationUrl, 'utf8'),
    ]);
    const operatorToken = Buffer.alloc(32, 11).toString('base64url');
    const operatorTokenSha256 = createHash('sha256')
      .update(operatorToken)
      .digest('hex');
    const transitionFailingDatabase = databaseWithFailingGateTransition(database);

    await assert.rejects(
      runDisposableHostedD1Probe(
        transitionFailingDatabase,
        upMigration,
        downMigration,
        operatorTokenSha256,
        activeRunWindow(),
      ),
      (error: unknown) =>
        error instanceof HostedD1ProbeError &&
        error.code === 'HOSTED_D1_PROBE_CLEANUP_FAILED' &&
        error.recoveryRequired,
    );

    await assert.rejects(
      finalizeDisposableHostedD1Probe(database, operatorToken, 0),
      (error: unknown) =>
        error instanceof HostedD1ProbeError &&
        error.code === 'HOSTED_D1_FINALIZE_BUSY',
    );
    const recovered = await finalizeDisposableHostedD1Probe(
      database,
      operatorToken,
      4_102_444_800,
    );
    assert.deepEqual(recovered, {
      rollback: 'PASS',
      gateCleanup: 'PASS',
      residualProbeTableCount: 0,
    });
  } finally {
    await miniflare.dispose();
  }
});

test('stale RUNNING recovery cannot be followed by delayed probe DDL', async () => {
  const miniflare = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    d1Databases: { DB: 'focus-contract-studio-package0-stale-writer' },
    d1Persist: false,
  });

  try {
    const database = await miniflare.getD1Database('DB');
    const [upMigration, downMigration] = await Promise.all([
      readFile(upMigrationUrl, 'utf8'),
      readFile(downMigrationUrl, 'utf8'),
    ]);
    const operatorToken = Buffer.alloc(32, 15).toString('base64url');
    const operatorTokenSha256 = createHash('sha256')
      .update(operatorToken)
      .digest('hex');
    const acquisitionReached = deferred();
    const releaseAcquisition = deferred();
    const lateDdlReached = deferred();
    const releaseLateDdl = deferred();
    let firstBatch = true;

    const pausingDatabase = new Proxy(database, {
      get(target, property) {
        if (property === 'batch') {
          return async (statements: D1PreparedStatement[]) => {
            const result = await target.batch(statements);
            if (firstBatch) {
              firstBatch = false;
              acquisitionReached.resolve();
              await releaseAcquisition.promise;
            }
            return result;
          };
        }
        if (property === 'exec') {
          return async (sql: string) => {
            const result = await target.exec(sql);
            if (sql.includes('CREATE TABLE package0_parent')) {
              lateDdlReached.resolve();
              await releaseLateDdl.promise;
            }
            return result;
          };
        }
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1Database;

    const runPromise = runDisposableHostedD1Probe(
      pausingDatabase,
      upMigration,
      downMigration,
      operatorTokenSha256,
      activeRunWindow(),
    );
    const settled = runPromise.then(
      () => 'settled' as const,
      () => 'settled' as const,
    );
    await acquisitionReached.promise;
    const finalized = await finalizeDisposableHostedD1Probe(
      database,
      operatorToken,
      4_102_444_800,
    );
    assert.equal(finalized.residualProbeTableCount, 0);

    releaseAcquisition.resolve();
    const raceOutcome = await Promise.race([
      settled,
      lateDdlReached.promise.then(() => 'late-ddl' as const),
    ]);
    releaseLateDdl.resolve();
    await assert.rejects(runPromise);

    assert.equal(raceOutcome, 'settled');
    const residual = await database
      .prepare(
        "SELECT COUNT(*) AS count FROM sqlite_schema WHERE type = 'table' AND name IN ('package0_parent', 'package0_child', '__fcs_package0_probe_gate_20260829_6f1f3d8c')",
      )
      .first<{ count: number }>();
    assert.equal(residual?.count, 0);
  } finally {
    await miniflare.dispose();
  }
});

test('cleanup drain prevents a pre-acquisition request from recreating the gate', async () => {
  const miniflare = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    d1Databases: { DB: 'focus-contract-studio-package0-pre-acquisition-drain' },
    d1Persist: false,
  });
  const releasePreflight = deferred();

  try {
    const database = await miniflare.getD1Database('DB');
    const [upMigration, downMigration] = await Promise.all([
      readFile(upMigrationUrl, 'utf8'),
      readFile(downMigrationUrl, 'utf8'),
    ]);
    const operatorToken = Buffer.alloc(32, 16).toString('base64url');
    const operatorTokenSha256 = createHash('sha256')
      .update(operatorToken)
      .digest('hex');
    const now = Math.floor(Date.now() / 1000);
    const runWindow = { notBefore: now - 1, expiresAt: now + 2 };
    const preflightReached = deferred();
    const pausingDatabase = databaseWithPausedReservedSchemaCheck(
      database,
      preflightReached,
      releasePreflight,
    );

    const delayedRun = runDisposableHostedD1Probe(
      pausingDatabase,
      upMigration,
      downMigration,
      operatorTokenSha256,
      runWindow,
    );
    await preflightReached.promise;
    await runDisposableHostedD1Probe(
      database,
      upMigration,
      downMigration,
      operatorTokenSha256,
      runWindow,
    );

    const cleanupReadyAt = runWindow.expiresAt + 5;
    await delay(Math.max(0, cleanupReadyAt * 1000 - Date.now() + 100));
    const finalized = await finalizeDisposableHostedD1Probe(
      database,
      operatorToken,
      Math.floor(Date.now() / 1000),
    );
    assert.equal(finalized.residualProbeTableCount, 0);

    releasePreflight.resolve();
    await assert.rejects(delayedRun);
    const residual = await database
      .prepare(
        "SELECT COUNT(*) AS count FROM sqlite_schema WHERE type = 'table' AND name IN ('package0_parent', 'package0_child', '__fcs_package0_probe_gate_20260829_6f1f3d8c')",
      )
      .first<{ count: number }>();
    assert.equal(residual?.count, 0);
  } finally {
    releasePreflight.resolve();
    await miniflare.dispose();
  }
});

test('finalizer refuses an exact-name table whose ownership schema was replaced', async () => {
  const miniflare = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    d1Databases: { DB: 'focus-contract-studio-package0-ownership-loss' },
    d1Persist: false,
  });

  try {
    const database = await miniflare.getD1Database('DB');
    const [upMigration, downMigration] = await Promise.all([
      readFile(upMigrationUrl, 'utf8'),
      readFile(downMigrationUrl, 'utf8'),
    ]);
    const operatorToken = Buffer.alloc(32, 17).toString('base64url');
    const operatorTokenSha256 = createHash('sha256')
      .update(operatorToken)
      .digest('hex');
    let forcedDropFailures = 2;
    const failingDatabase = new Proxy(database, {
      get(target, property) {
        if (property === 'exec') {
          return async (sql: string) => {
            if (sql.includes('DROP TABLE') && forcedDropFailures > 0) {
              forcedDropFailures -= 1;
              throw new Error('forced cleanup failure');
            }
            return target.exec(sql);
          };
        }
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1Database;

    await assert.rejects(
      runDisposableHostedD1Probe(
        failingDatabase,
        upMigration,
        downMigration,
        operatorTokenSha256,
        activeRunWindow(),
      ),
    );
    await database.exec(
      "DROP TABLE package0_child; DROP TABLE package0_parent; CREATE TABLE package0_parent (id INTEGER PRIMARY KEY, sentinel TEXT NOT NULL) STRICT; INSERT INTO package0_parent VALUES (1, 'preserve-me');",
    );

    await assert.rejects(
      finalizeDisposableHostedD1Probe(
        database,
        operatorToken,
        4_102_444_800,
      ),
      (error: unknown) =>
        error instanceof HostedD1ProbeError &&
        error.code === 'HOSTED_D1_SCHEMA_OWNERSHIP_LOST',
    );
    const sentinel = await database
      .prepare('SELECT sentinel FROM package0_parent WHERE id = 1')
      .first<{ sentinel: string }>();
    assert.equal(sentinel?.sentinel, 'preserve-me');
  } finally {
    await miniflare.dispose();
  }
});

test('finalizer refuses an exact-name gate whose ownership schema was replaced', async () => {
  const miniflare = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    d1Databases: { DB: 'focus-contract-studio-package0-gate-ownership-loss' },
    d1Persist: false,
  });

  try {
    const database = await miniflare.getD1Database('DB');
    const [upMigration, downMigration] = await Promise.all([
      readFile(upMigrationUrl, 'utf8'),
      readFile(downMigrationUrl, 'utf8'),
    ]);
    const operatorToken = Buffer.alloc(32, 19).toString('base64url');
    const operatorTokenSha256 = createHash('sha256')
      .update(operatorToken)
      .digest('hex');
    await runDisposableHostedD1Probe(
      database,
      upMigration,
      downMigration,
      operatorTokenSha256,
      activeRunWindow(),
    );
    await database.exec(
      'DROP TABLE __fcs_package0_probe_gate_20260829_6f1f3d8c;',
    );
    await database.exec(
      'CREATE TABLE __fcs_package0_probe_gate_20260829_6f1f3d8c (marker TEXT PRIMARY KEY, operator_token_sha256 TEXT NOT NULL, state TEXT NOT NULL, created_at INTEGER NOT NULL, sentinel TEXT NOT NULL) STRICT;',
    );
    await database
      .prepare(
        `INSERT INTO __fcs_package0_probe_gate_20260829_6f1f3d8c
          (marker, operator_token_sha256, state, created_at, sentinel)
          VALUES (?, ?, 'COMPLETE', 0, 'preserve-me')`,
      )
      .bind('focus-contract-studio-package0-revision2', operatorTokenSha256)
      .run();

    await assert.rejects(
      finalizeDisposableHostedD1Probe(database, operatorToken),
      (error: unknown) =>
        error instanceof HostedD1ProbeError &&
        error.code === 'HOSTED_D1_SCHEMA_OWNERSHIP_LOST',
    );
    const sentinel = await database
      .prepare(
        'SELECT sentinel FROM __fcs_package0_probe_gate_20260829_6f1f3d8c',
      )
      .first<{ sentinel: string }>();
    assert.equal(sentinel?.sentinel, 'preserve-me');
  } finally {
    await miniflare.dispose();
  }
});

function activeRunWindow(): { expiresAt: number; notBefore: number } {
  const now = Math.floor(Date.now() / 1000);
  return { expiresAt: now + 300, notBefore: now - 30 };
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function databaseWithPausedReservedSchemaCheck(
  database: D1Database,
  reached: { resolve: () => void },
  release: { promise: Promise<void> },
): D1Database {
  return new Proxy(database, {
    get(target, property) {
      if (property !== 'prepare') {
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      }

      return (sql: string) => {
        const statement = target.prepare(sql);
        if (!sql.includes('name IN (?, ?, ?)')) return statement;

        return new Proxy(statement, {
          get(statementTarget, statementProperty) {
            if (statementProperty !== 'bind') {
              const value = Reflect.get(statementTarget, statementProperty);
              return typeof value === 'function'
                ? value.bind(statementTarget)
                : value;
            }
            return (...values: unknown[]) => {
              const bound = statementTarget.bind(...values);
              return new Proxy(bound, {
                get(boundTarget, boundProperty) {
                  if (boundProperty === 'all') {
                    return async () => {
                      reached.resolve();
                      await release.promise;
                      return boundTarget.all();
                    };
                  }
                  const value = Reflect.get(boundTarget, boundProperty);
                  return typeof value === 'function'
                    ? value.bind(boundTarget)
                    : value;
                },
              });
            };
          },
        });
      };
    },
  }) as D1Database;
}

function databaseWithFailingGateTransition(
  database: D1Database,
): D1Database {
  return new Proxy(database, {
    get(target, property) {
      if (property !== 'prepare') {
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      }

      return (sql: string) => {
        const statement = target.prepare(sql);
        if (!sql.includes('SET state = ?')) return statement;

        return new Proxy(statement, {
          get(statementTarget, statementProperty) {
            if (statementProperty !== 'bind') {
              const value = Reflect.get(statementTarget, statementProperty);
              return typeof value === 'function'
                ? value.bind(statementTarget)
                : value;
            }
            return (...values: unknown[]) => {
              const bound = statementTarget.bind(...values);
              return new Proxy(bound, {
                get(boundTarget, boundProperty) {
                  if (boundProperty === 'run') {
                    return async () => {
                      throw new Error('forced state-transition failure');
                    };
                  }
                  const value = Reflect.get(boundTarget, boundProperty);
                  return typeof value === 'function'
                    ? value.bind(boundTarget)
                    : value;
                },
              });
            };
          },
        });
      };
    },
  }) as D1Database;
}
