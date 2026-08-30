import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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

test('cleanup failure keeps the durable gate and its token can recover every owned table', async () => {
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
    const cleanupToken = Buffer.alloc(32, 9).toString('base64url');
    const cleanupTokenSha256 = createHash('sha256')
      .update(cleanupToken)
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
        cleanupTokenSha256,
      ),
      (error: unknown) =>
        error instanceof HostedD1ProbeError &&
        error.code === 'HOSTED_D1_PROBE_CLEANUP_FAILED' &&
        error.cleanupAuthorized,
    );

    const beforeRecovery = await database
      .prepare(
        "SELECT COUNT(*) AS count FROM sqlite_schema WHERE type = 'table' AND (name LIKE 'package0_%' OR name LIKE '__fcs_package0_probe_gate_%')",
      )
      .first<{ count: number }>();
    assert.equal(beforeRecovery?.count, 3);

    const recovered = await finalizeDisposableHostedD1Probe(
      database,
      cleanupToken,
    );
    assert.deepEqual(recovered, {
      rollback: 'PASS',
      gateCleanup: 'PASS',
      residualProbeTableCount: 0,
    });
    const afterRecovery = await database
      .prepare(
        "SELECT COUNT(*) AS count FROM sqlite_schema WHERE type = 'table' AND (name LIKE 'package0_%' OR name LIKE '__fcs_package0_probe_gate_%')",
      )
      .first<{ count: number }>();
    assert.equal(afterRecovery?.count, 0);
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
    const cleanupToken = Buffer.alloc(32, 11).toString('base64url');
    const cleanupTokenSha256 = createHash('sha256')
      .update(cleanupToken)
      .digest('hex');
    const transitionFailingDatabase = databaseWithFailingGateTransition(database);

    await assert.rejects(
      runDisposableHostedD1Probe(
        transitionFailingDatabase,
        upMigration,
        downMigration,
        cleanupTokenSha256,
      ),
      (error: unknown) =>
        error instanceof HostedD1ProbeError &&
        error.code === 'HOSTED_D1_PROBE_CLEANUP_FAILED' &&
        error.cleanupAuthorized,
    );

    await assert.rejects(
      finalizeDisposableHostedD1Probe(database, cleanupToken, 0),
      (error: unknown) =>
        error instanceof HostedD1ProbeError &&
        error.code === 'HOSTED_D1_FINALIZE_BUSY',
    );
    const recovered = await finalizeDisposableHostedD1Probe(
      database,
      cleanupToken,
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
