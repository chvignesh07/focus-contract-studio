import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { readMigrationFiles } from 'drizzle-orm/migrator';
import { unstable_splitSqlQuery } from 'wrangler';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const migrationDirectory = path.join(repositoryRoot, 'drizzle');
const breakpoint = '--> statement-breakpoint';
const expectedTags = [
  '0001_package1_domain',
  '0002_package2_vertical_slice',
  '0003_package3_raw_observer_verifier',
  '0004_package5_review_apply_undo',
  '0005_package8_admission_lineage',
  '0006_package8_atomic_admission',
] as const;
const baselineSqlHashes = {
  '0001_package1_domain.sql':
    '6a639c80d3d96d892dfb5c5e57962f432822f7f000324177e6b4f3f9b1eff4fc',
  '0002_package2_vertical_slice.sql':
    '4b446874a500a5a0bcbc30717aa8ce2ee4a97ec9f6a27de2a76620a1394dcc3a',
  '0003_package3_raw_observer_verifier.sql':
    'bc08c8fa35e5a0172d17ea898e15b3c6c4452bc82486188b16de6b33efa78fc8',
  '0004_package5_review_apply_undo.sql':
    '81876fb0d096dba99bffe8dffa3839ef232aac62dde462b6f4856749217a9dc1',
  '0005_package8_admission_lineage.sql':
    '58fcb6ccdb158c5538b4b26dc6115ef43aef6ee72194683ccfb860476ffd302e',
  '0006_package8_atomic_admission.sql':
    'ce66bc2568669742c1ac7be7c26b9ac51c7aedd02fb2eb321df62829d876c167',
} as const;
const expectedSqlFiles = expectedTags.map((tag) => `${tag}.sql`);

type Journal = {
  version: string;
  dialect: string;
  entries: Array<{
    idx: number;
    version: string;
    when: number;
    tag: string;
    breakpoints: boolean;
  }>;
};

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function readJournal(root = migrationDirectory) {
  return JSON.parse(
    readFileSync(path.join(root, 'meta/_journal.json'), 'utf8'),
  ) as Journal;
}

test('Sites journal and numbered SQL files close exactly over migrations 0001 through 0006', () => {
  const journal = readJournal();
  const sqlFiles = readdirSync(migrationDirectory)
    .filter((name) => /^\d{4}_.+\.sql$/u.test(name))
    .sort();

  assert.deepEqual(sqlFiles, expectedSqlFiles);
  assert.deepEqual(
    journal.entries.map(({ tag }) => tag),
    expectedTags,
  );
  assert.deepEqual(
    journal.entries.map(({ idx }) => idx),
    [0, 1, 2, 3, 4, 5],
  );
  assert.equal(journal.version, '7');
  assert.equal(journal.dialect, 'sqlite');
  assert.ok(
    journal.entries.every(
      (entry, index) =>
        entry.version === '7' &&
        entry.breakpoints === true &&
        (index === 0 || entry.when > journal.entries[index - 1]!.when),
    ),
  );
});

test('the installed Drizzle loader enumerates all six migrations', () => {
  const migrations = readMigrationFiles({
    migrationsFolder: migrationDirectory,
  });

  assert.equal(migrations.length, expectedTags.length);
});

test('the installed Drizzle loader emits exactly one complete SQLite statement per chunk without changing migration SQL', () => {
  const migrations = readMigrationFiles({
    migrationsFolder: migrationDirectory,
  });

  migrations.forEach((migration, migrationIndex) => {
    const file = expectedSqlFiles[
      migrationIndex
    ]! as keyof typeof baselineSqlHashes;
    const source = readFileSync(path.join(migrationDirectory, file), 'utf8');
    const sqlWithoutBreakpoints = source.replaceAll(`${breakpoint}\n`, '');
    const completeStatements = unstable_splitSqlQuery(sqlWithoutBreakpoints);

    assert.equal(sha256(sqlWithoutBreakpoints), baselineSqlHashes[file]);
    assert.equal(migration.sql.length, completeStatements.length, file);
    migration.sql.forEach((chunk, statementIndex) => {
      const parsed = unstable_splitSqlQuery(chunk);
      assert.equal(parsed.length, 1, `${file} chunk ${statementIndex + 1}`);
      assert.ok(parsed[0]!.trim(), `${file} chunk ${statementIndex + 1}`);
    });
  });
});

test('the built Sites archive contains byte-identical corrected migration inputs', () => {
  const archiveDirectory = path.join(repositoryRoot, 'dist/.openai/drizzle');

  assert.deepEqual(
    readdirSync(archiveDirectory).sort(),
    [...expectedSqlFiles, 'meta'].sort(),
  );
  assert.deepEqual(readdirSync(path.join(archiveDirectory, 'meta')), [
    '_journal.json',
  ]);

  for (const relativePath of [
    ...expectedSqlFiles,
    'meta/_journal.json',
  ]) {
    const source = readFileSync(path.join(migrationDirectory, relativePath));
    const archived = readFileSync(path.join(archiveDirectory, relativePath));
    assert.equal(sha256(archived), sha256(source), relativePath);
    assert.deepEqual(archived, source, relativePath);
  }
});
