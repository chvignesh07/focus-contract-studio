import { env } from 'cloudflare:workers';
import type { D1Migration } from 'cloudflare:test';
import { expect, test } from 'vitest';

const expectedMigrationNames = [
  '0001_package1_domain.sql',
  '0002_package2_vertical_slice.sql',
  '0003_package3_raw_observer_verifier.sql',
  '0004_package5_review_apply_undo.sql',
  '0005_package8_admission_lineage.sql',
  '0006_package8_atomic_admission.sql',
] as const;

const package9Env = env as Cloudflare.Env & {
  PACKAGE9_DB: D1Database;
  PACKAGE9_SITES_MIGRATIONS: D1Migration[];
};

async function schema(database: D1Database) {
  return database
    .prepare(
      `SELECT type, name, tbl_name, sql
         FROM sqlite_schema
        WHERE name NOT LIKE 'sqlite_%'
          AND name NOT IN ('_cf_METADATA', 'package9_sites_migrations')
        ORDER BY type, name`,
    )
    .all<{ type: string; name: string; tbl_name: string; sql: string }>();
}

async function applyOneStatementPerPrepare(
  database: D1Database,
  migrations: D1Migration[],
) {
  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS package9_sites_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )`,
    )
    .run();
  const applied = new Set(
    (
      await database
        .prepare('SELECT name FROM package9_sites_migrations')
        .all<{ name: string }>()
    ).results.map(({ name }) => name),
  );
  let executedStatements = 0;

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    for (const statement of migration.queries) {
      await database.prepare(statement).run();
      executedStatements += 1;
    }
    await database
      .prepare('INSERT INTO package9_sites_migrations (name) VALUES (?)')
      .bind(migration.name)
      .run();
  }

  return executedStatements;
}

test('Sites-packaged Drizzle chunks apply to fresh D1 one prepare at a time and rerun after a complete successful application', async () => {
  expect(
    await applyOneStatementPerPrepare(
      package9Env.PACKAGE9_DB,
      package9Env.PACKAGE9_SITES_MIGRATIONS,
    ),
  ).toBe(180);

  expect(
    package9Env.PACKAGE9_SITES_MIGRATIONS.map(({ name }) => name),
  ).toEqual(expectedMigrationNames);

  const firstSchema = await schema(package9Env.PACKAGE9_DB);
  expect(firstSchema.results.map(({ name }) => name)).toEqual(
    expect.arrayContaining([
      'workspaces',
      'proposals',
      'verification_receipts',
      'trg_package8_admit_audit_mutation',
      'trg_package8_admit_rehearsal_finalize',
    ]),
  );

  expect(
    await applyOneStatementPerPrepare(
      package9Env.PACKAGE9_DB,
      package9Env.PACKAGE9_SITES_MIGRATIONS,
    ),
  ).toBe(0);

  expect((await schema(package9Env.PACKAGE9_DB)).results).toEqual(
    firstSchema.results,
  );
  expect(
    await package9Env.PACKAGE9_DB.prepare(
      'SELECT COUNT(*) AS count FROM package9_sites_migrations',
    ).first<{ count: number }>(),
  ).toEqual({ count: 6 });
});
