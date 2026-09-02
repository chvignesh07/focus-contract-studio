import { env } from 'cloudflare:workers';
import { applyD1Migrations, type D1Migration } from 'cloudflare:test';
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

test('Sites-packaged Drizzle chunks apply to fresh D1 one prepare at a time and rerun safely', async () => {
  await applyD1Migrations(
    package9Env.PACKAGE9_DB,
    package9Env.PACKAGE9_SITES_MIGRATIONS,
    'package9_sites_migrations',
  );

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

  await applyD1Migrations(
    package9Env.PACKAGE9_DB,
    package9Env.PACKAGE9_SITES_MIGRATIONS,
    'package9_sites_migrations',
  );

  expect((await schema(package9Env.PACKAGE9_DB)).results).toEqual(
    firstSchema.results,
  );
  expect(
    await package9Env.PACKAGE9_DB.prepare(
      'SELECT COUNT(*) AS count FROM package9_sites_migrations',
    ).first<{ count: number }>(),
  ).toEqual({ count: 6 });
});
