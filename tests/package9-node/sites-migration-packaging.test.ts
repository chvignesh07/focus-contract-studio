import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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
const migrationBoundaryBase = 'a665be3ddcf0d2ebac0c07c4aedc857a10624660';
const package8AtomicAdmissionFile = '0006_package8_atomic_admission.sql';
const expectedTags = [
  '0001_package1_domain',
  '0002_package2_vertical_slice',
  '0003_package3_raw_observer_verifier',
  '0004_package5_review_apply_undo',
  '0005_package8_admission_lineage',
  '0006_package8_atomic_admission',
] as const;
const historicalSqlHashes = {
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
const expectedSqlHashes = {
  ...historicalSqlHashes,
  [package8AtomicAdmissionFile]:
    '3672b158f14ad27a0757abba72f3d9e889f71b8877bf6b68abeca6b7deacd4d7',
} as const;
const expectedSqlFiles = expectedTags.map((tag) => `${tag}.sql`);
const expectedPackage8AtomicAdmissionDefinitions = [
  'variant_selection_commits',
  'trg_variant_selection_commits_immutable_update',
  'trg_variant_selection_commits_immutable_delete',
  'trg_variant_selection_success_audit_finalizer',
  'trg_package8_admit_audit_mutation',
  'trg_package8_admit_rehearsal_start',
  'trg_package8_admit_rehearsal_finalize',
] as const;

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

function topLevelTableAndTriggerNames(sql: string) {
  return [
    ...sql.matchAll(
      /^CREATE\s+(?:TABLE|TRIGGER)\s+([a-z_][a-z0-9_]*)/gimu,
    ),
  ].map((match) => match[1]!);
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

test('migration 0006 emits seven single-definition Drizzle chunks', () => {
  const source = readFileSync(
    path.join(migrationDirectory, package8AtomicAdmissionFile),
    'utf8',
  );
  const migration = readMigrationFiles({
    migrationsFolder: migrationDirectory,
  })[5]!;

  assert.deepEqual(
    topLevelTableAndTriggerNames(source),
    expectedPackage8AtomicAdmissionDefinitions,
  );
  assert.equal(migration.sql.length, 7);
  assert.deepEqual(
    migration.sql.map(topLevelTableAndTriggerNames),
    expectedPackage8AtomicAdmissionDefinitions.map((name) => [name]),
  );
});

test('migration 0006 changes only the parser-safe whitespace token and two breakpoint comments', () => {
  const historicalSource = execFileSync(
    'git',
    ['show', `${migrationBoundaryBase}:drizzle/${package8AtomicAdmissionFile}`],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  const currentSource = readFileSync(
    path.join(migrationDirectory, package8AtomicAdmissionFile),
    'utf8',
  );
  const expectedSource = historicalSource
    .replace(
      '         END,\n         (NEW.occurred_at / 3600) * 3600,',
      '         END ,\n         (NEW.occurred_at / 3600) * 3600,',
    )
    .replace(
      'END;\n\nCREATE TRIGGER trg_package8_admit_rehearsal_start',
      `END;\n${breakpoint}\n\nCREATE TRIGGER trg_package8_admit_rehearsal_start`,
    )
    .replace(
      'END;\n\nCREATE TRIGGER trg_package8_admit_rehearsal_finalize',
      `END;\n${breakpoint}\n\nCREATE TRIGGER trg_package8_admit_rehearsal_finalize`,
    );
  const sqlTokens = (sql: string) =>
    sql.replaceAll(breakpoint, '').replaceAll(/\s+/gu, '');

  assert.equal(
    sha256(historicalSource),
    'ede4971b27cd93a417bd9147d236f9b53b329fd2a5124b63c61da9d1163889a5',
  );
  assert.equal(
    sha256(historicalSource.replaceAll(`${breakpoint}\n`, '')),
    historicalSqlHashes[package8AtomicAdmissionFile],
  );
  assert.equal(
    sha256(currentSource),
    '419ba2f2bc70dd7eadfc2fddded84a5c44a6742f518b86037c3b4beb9ddc38b2',
  );
  assert.equal(currentSource, expectedSource);
  assert.equal(sqlTokens(currentSource), sqlTokens(historicalSource));
});

test('the installed Drizzle loader emits 180 source-bound single-statement chunks across 174 breakpoints', () => {
  const migrations = readMigrationFiles({
    migrationsFolder: migrationDirectory,
  });
  let statementCount = 0;
  let breakpointCount = 0;

  migrations.forEach((migration, migrationIndex) => {
    const file = expectedSqlFiles[
      migrationIndex
    ]! as keyof typeof expectedSqlHashes;
    const source = readFileSync(path.join(migrationDirectory, file), 'utf8');
    const sqlWithoutBreakpoints = source.replaceAll(`${breakpoint}\n`, '');
    const completeStatements = unstable_splitSqlQuery(sqlWithoutBreakpoints);

    assert.equal(sha256(sqlWithoutBreakpoints), expectedSqlHashes[file]);
    assert.equal(migration.sql.length, completeStatements.length, file);
    statementCount += completeStatements.length;
    breakpointCount += source.split(breakpoint).length - 1;
    migration.sql.forEach((chunk, statementIndex) => {
      const parsed = unstable_splitSqlQuery(chunk);
      assert.equal(parsed.length, 1, `${file} chunk ${statementIndex + 1}`);
      assert.ok(parsed[0]!.trim(), `${file} chunk ${statementIndex + 1}`);
    });
  });

  assert.equal(statementCount, 180);
  assert.equal(breakpointCount, 174);
});

test('the built Sites archive contains byte-identical corrected migration inputs', () => {
  const archiveDirectory = path.join(repositoryRoot, 'dist/.openai/drizzle');
  const archiveManifest: string[] = [];

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
    archiveManifest.push(
      `${sha256(source)}  ${source.length}  ${relativePath}\n`,
    );
  }
  assert.equal(
    sha256(archiveManifest.join('')),
    'eabe29d3dfdf64edfb54744ab0a5ccebd8d718cbb58222450d8fc3e2c851b3cf',
  );
});
