import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { Miniflare } from 'miniflare';

import { interpretRequiredSingleRow } from '../../probes/d1/d1-probe.ts';

const upMigrationUrl = new URL(
  '../../probes/d1/migrations/0001_package0_probe.up.sql',
  import.meta.url,
);
const downMigrationUrl = new URL(
  '../../probes/d1/migrations/0001_package0_probe.down.sql',
  import.meta.url,
);

async function withFreshD1(
  run: (database: D1Database) => Promise<void>,
): Promise<void> {
  const miniflare = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    d1Databases: { DB: 'focus-contract-studio-package0-probe' },
    d1Persist: false,
  });

  try {
    const database = await miniflare.getD1Database('DB');
    const migration = await readFile(upMigrationUrl, 'utf8');
    await database.exec(migration);
    await run(database);
  } finally {
    await miniflare.dispose();
  }
}

test('disposable migration creates STRICT tables and a prepared query returns the row', async () => {
  await withFreshD1(async (database) => {
    await database
      .prepare('INSERT INTO package0_parent (id, slug) VALUES (?, ?)')
      .bind(1, 'first')
      .run();
    const row = await database
      .prepare('SELECT id, slug FROM package0_parent WHERE id = ?')
      .bind(1)
      .first<{ id: number; slug: string }>();
    const schema = await database
      .prepare(
        "SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = ?",
      )
      .bind('package0_parent')
      .first<{ sql: string }>();

    assert.deepEqual(row, { id: 1, slug: 'first' });
    assert.match(schema?.sql ?? '', /STRICT$/);
  });
});

test('foreign-key, unique, and check constraints reject invalid writes', async () => {
  await withFreshD1(async (database) => {
    await database
      .prepare('INSERT INTO package0_parent (id, slug) VALUES (?, ?)')
      .bind(1, 'unique-slug')
      .run();

    await assert.rejects(
      database
        .prepare('INSERT INTO package0_parent (id, slug) VALUES (?, ?)')
        .bind(2, 'unique-slug')
        .run(),
      /UNIQUE constraint failed/,
    );
    await assert.rejects(
      database
        .prepare(
          'INSERT INTO package0_child (id, parent_id, score) VALUES (?, ?, ?)',
        )
        .bind(1, 999, 1)
        .run(),
      /FOREIGN KEY constraint failed/,
    );
    await assert.rejects(
      database
        .prepare(
          'INSERT INTO package0_child (id, parent_id, score) VALUES (?, ?, ?)',
        )
        .bind(1, 1, 0)
        .run(),
      /CHECK constraint failed/,
    );
  });
});

test('D1 batch rolls back earlier statements when a later statement errors', async () => {
  await withFreshD1(async (database) => {
    await assert.rejects(
      database.batch([
        database
          .prepare('INSERT INTO package0_parent (id, slug) VALUES (?, ?)')
          .bind(1, 'rollback-me'),
        database
          .prepare('INSERT INTO package0_parent (id, slug) VALUES (?, ?)')
          .bind(2, 'rollback-me'),
      ]),
      /UNIQUE constraint failed/,
    );

    const row = await database
      .prepare('SELECT COUNT(*) AS count FROM package0_parent')
      .first<{ count: number }>();
    assert.equal(row?.count, 0);
  });
});

test('successful zero-row D1 write is rejected by the application guard interpreter', async () => {
  await withFreshD1(async (database) => {
    const result = await database
      .prepare('UPDATE package0_parent SET slug = ? WHERE id = ?')
      .bind('never-written', 404)
      .run();

    assert.equal(result.success, true);
    assert.equal(result.meta.changes, 0);
    assert.deepEqual(interpretRequiredSingleRow(result), {
      ok: false,
      code: 'ZERO_ROW_REJECTED',
      changes: 0,
    });
  });
});

test('multi-row D1 write is rejected when exactly one guarded row is required', async () => {
  await withFreshD1(async (database) => {
    await database.batch([
      database
        .prepare('INSERT INTO package0_parent (id, slug) VALUES (?, ?)')
        .bind(1, 'first'),
      database
        .prepare('INSERT INTO package0_parent (id, slug) VALUES (?, ?)')
        .bind(2, 'second'),
    ]);
    const result = await database
      .prepare("UPDATE package0_parent SET slug = slug || '-updated'")
      .run();

    assert.equal(result.success, true);
    assert.equal(result.meta.changes, 2);
    assert.deepEqual(interpretRequiredSingleRow(result), {
      ok: false,
      code: 'UNEXPECTED_ROW_COUNT',
      changes: 2,
    });
  });
});

test('down migration removes the disposable probe schema', async () => {
  await withFreshD1(async (database) => {
    const rollback = await readFile(downMigrationUrl, 'utf8');
    await database.exec(rollback);
    const rows = await database
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name LIKE 'package0_%' ORDER BY name",
      )
      .all<{ name: string }>();

    assert.deepEqual(rows.results, []);
  });
});
