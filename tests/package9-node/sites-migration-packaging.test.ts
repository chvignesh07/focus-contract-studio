import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
const archiveDirectory = path.join(repositoryRoot, 'dist/.openai/drizzle');
const breakpoint = '--> statement-breakpoint';
const migrationBoundaryBase = 'a665be3ddcf0d2ebac0c07c4aedc857a10624660';
const d1CaseParserBase = '814745b3ce44569c61174eb7a413156955cde831';
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
const migrationBoundarySqlHashes = {
  ...historicalSqlHashes,
  [package8AtomicAdmissionFile]:
    '3672b158f14ad27a0757abba72f3d9e889f71b8877bf6b68abeca6b7deacd4d7',
} as const;
const expectedSqlHashes = {
  '0001_package1_domain.sql':
    '987da80aa99ba78e06029e54ab4b161316433d96c34618fc819dba8b07120cf2',
  '0002_package2_vertical_slice.sql':
    '4b8db460bcadafb2919bca3aa4d4b398a47ab4e15d3b3a9525778ffce438f149',
  '0003_package3_raw_observer_verifier.sql':
    'ce49766adf8d08733de39d9c2f863944c562d80c3ac700072da5bdf71db3cb79',
  '0004_package5_review_apply_undo.sql':
    '1cfc151ced6ee28f063d92df3e5850cc95d2db9b990083e7548c83c3ae0c0477',
  '0005_package8_admission_lineage.sql':
    '58fcb6ccdb158c5538b4b26dc6115ef43aef6ee72194683ccfb860476ffd302e',
  '0006_package8_atomic_admission.sql':
    '6bb860cc53e9377bdb59cf63dc04d80821760f7adbc7ab71a049878835f89c17',
} as const;
const expectedSqlFiles = expectedTags.map(
  (tag) => `${tag}.sql` as keyof typeof expectedSqlHashes,
);
const expectedPackage8AtomicAdmissionDefinitions = [
  'variant_selection_commits',
  'trg_variant_selection_commits_immutable_update',
  'trg_variant_selection_commits_immutable_delete',
  'trg_variant_selection_success_audit_finalizer',
  'trg_package8_admit_audit_mutation',
  'trg_package8_admit_rehearsal_start',
  'trg_package8_admit_rehearsal_finalize',
] as const;
const expectedOuterTriggerCases = {
  '0001_package1_domain.sql': 18,
  '0002_package2_vertical_slice.sql': 4,
  '0003_package3_raw_observer_verifier.sql': 10,
  '0004_package5_review_apply_undo.sql': 6,
  '0005_package8_admission_lineage.sql': 0,
  '0006_package8_atomic_admission.sql': 4,
} as const;

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

function topLevelTriggerCount(sql: string) {
  return [...sql.matchAll(/^CREATE\s+TRIGGER\s+[a-z_][a-z0-9_]*/gimu)].length;
}

type SqlToken = {
  text: string;
  upper: string;
  start: number;
  end: number;
  line: number;
};

type OuterTriggerCase = {
  trigger: string;
  line: number;
  endLine: number;
  caseStart: number;
  caseEnd: number;
};

function tokenizeSql(sql: string) {
  const tokens: SqlToken[] = [];
  let index = 0;
  let line = 1;
  const advance = () => {
    if (sql[index] === '\n') line += 1;
    index += 1;
  };

  while (index < sql.length) {
    const character = sql[index]!;
    if (/\s/u.test(character)) {
      advance();
      continue;
    }
    if (character === '-' && sql[index + 1] === '-') {
      advance();
      advance();
      while (index < sql.length && sql[index] !== '\n') advance();
      continue;
    }
    if (character === '/' && sql[index + 1] === '*') {
      const commentLine = line;
      let closed = false;
      advance();
      advance();
      while (index < sql.length) {
        if (sql[index] === '*' && sql[index + 1] === '/') {
          advance();
          advance();
          closed = true;
          break;
        }
        advance();
      }
      if (!closed) throw new Error(`unterminated SQL comment at line ${commentLine}`);
      continue;
    }
    if (character === "'" || character === '"' || character === '`' || character === '[') {
      const quotedLine = line;
      const delimiter = character === '[' ? ']' : character;
      let closed = false;
      advance();
      while (index < sql.length) {
        if (sql[index] === delimiter) {
          advance();
          if (sql[index] === delimiter) {
            advance();
            continue;
          }
          closed = true;
          break;
        }
        advance();
      }
      if (!closed) throw new Error(`unterminated SQL quote at line ${quotedLine}`);
      continue;
    }

    const start = index;
    const tokenLine = line;
    if (/[A-Za-z_]/u.test(character)) {
      advance();
      while (index < sql.length && /[A-Za-z0-9_$]/u.test(sql[index]!)) {
        advance();
      }
    } else {
      advance();
    }
    const text = sql.slice(start, index);
    tokens.push({ text, upper: text.toUpperCase(), start, end: index, line: tokenLine });
  }

  return tokens;
}

function inspectPublicD1TriggerCaseRisk(sql: string) {
  const tokens = tokenizeSql(sql);
  const hazards: OuterTriggerCase[] = [];
  const lowercaseBegins: Array<{ trigger: string; line: number }> = [];
  let triggerCount = 0;

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    if (tokens[tokenIndex]!.upper !== 'CREATE') continue;
    let cursor = tokenIndex + 1;
    if (tokens[cursor]?.upper === 'TEMP' || tokens[cursor]?.upper === 'TEMPORARY') {
      cursor += 1;
    }
    if (tokens[cursor]?.upper !== 'TRIGGER') continue;
    triggerCount += 1;
    cursor += 1;
    if (tokens[cursor]?.upper === 'IF') cursor += 3;
    const trigger = tokens[cursor]?.text;
    if (!trigger) throw new Error('trigger name is missing');
    while (tokens[cursor]?.upper !== 'BEGIN' && tokens[cursor]?.text !== ';') {
      cursor += 1;
    }
    const begin = tokens[cursor];
    if (!begin || begin.upper !== 'BEGIN') {
      throw new Error(`${trigger}: trigger BEGIN is missing`);
    }
    if (begin.text !== 'BEGIN') lowercaseBegins.push({ trigger, line: begin.line });

    let parentheses = 0;
    const cases: Array<{ directSelect: boolean; token: SqlToken }> = [];
    let triggerEnd = -1;
    for (cursor += 1; cursor < tokens.length; cursor += 1) {
      const token = tokens[cursor]!;
      if (token.text === '(') {
        parentheses += 1;
        continue;
      }
      if (token.text === ')') {
        if (parentheses === 0) {
          throw new Error(`${trigger}: unexpected ) at line ${token.line}`);
        }
        parentheses -= 1;
        continue;
      }
      if (token.upper === 'CASE') {
        const precedingToken = tokens[cursor - 1]?.upper;
        const selectToken =
          precedingToken === 'ALL' || precedingToken === 'DISTINCT'
            ? tokens[cursor - 2]
            : tokens[cursor - 1];
        cases.push({
          directSelect:
            parentheses === 0 &&
            cases.length === 0 &&
            selectToken?.upper === 'SELECT',
          token,
        });
        continue;
      }
      if (token.upper !== 'END') continue;
      const caseFrame = cases.pop();
      if (caseFrame) {
        if (caseFrame.directSelect) {
          hazards.push({
            trigger,
            line: caseFrame.token.line,
            endLine: token.line,
            caseStart: caseFrame.token.start,
            caseEnd: token.end,
          });
        }
        continue;
      }
      if (parentheses === 0 && tokens[cursor + 1]?.text === ';') {
        triggerEnd = cursor + 1;
        break;
      }
      throw new Error(`${trigger}: unexpected END at line ${token.line}`);
    }
    if (triggerEnd === -1 || parentheses !== 0 || cases.length !== 0) {
      throw new Error(
        `${trigger}: unbalanced trigger action (parentheses=${parentheses}, cases=${cases.length})`,
      );
    }
    tokenIndex = triggerEnd;
  }

  return { hazards, lowercaseBegins, triggerCount };
}

function parenthesizeOuterTriggerCases(sql: string) {
  const edits = inspectPublicD1TriggerCaseRisk(sql)
    .hazards.flatMap(({ caseStart, caseEnd }) => [
      { index: caseStart, text: '(' },
      { index: caseEnd, text: ')' },
    ])
    .sort((left, right) => right.index - left.index);
  return edits.reduce(
    (result, edit) =>
      `${result.slice(0, edit.index)}${edit.text}${result.slice(edit.index)}`,
    sql,
  );
}

test('the public workers-sdk issue 4727 compatibility model is token-safe', () => {
  const broken = [
    'CREATE TRIGGER trg_fixture AFTER INSERT ON demo',
    'BEGIN',
    '  -- SELECT CASE WHEN 1 THEN 1 END;',
    "  SELECT 'SELECT CASE END;';",
    '  SELECT "SELECT CASE END";',
    '  /* SELECT CASE WHEN 1 THEN 1 END; */',
    '  SELECT CASE WHEN 1 THEN CASE WHEN 0 THEN 0 ELSE 1 END ELSE 2 END;',
    '  SELECT DISTINCT CASE WHEN 1 THEN 1 END;',
    '  SELECT ALL CASE WHEN 1 THEN 1 END;',
    'END;',
    '',
  ].join('\n');
  const fixed = [
    'CREATE TRIGGER trg_fixture AFTER INSERT ON demo',
    'BEGIN',
    '  -- SELECT CASE WHEN 1 THEN 1 END;',
    "  SELECT 'SELECT CASE END;';",
    '  SELECT "SELECT CASE END";',
    '  /* SELECT CASE WHEN 1 THEN 1 END; */',
    '  SELECT (CASE WHEN 1 THEN CASE WHEN 0 THEN 0 ELSE 1 END ELSE 2 END);',
    '  SELECT DISTINCT (CASE WHEN 1 THEN 1 END);',
    '  SELECT ALL (CASE WHEN 1 THEN 1 END);',
    'END;',
    '',
  ].join('\n');

  assert.deepEqual(
    inspectPublicD1TriggerCaseRisk(broken).hazards.map(({ trigger, line, endLine }) => ({
      trigger,
      line,
      endLine,
    })),
    [
      { trigger: 'trg_fixture', line: 7, endLine: 7 },
      { trigger: 'trg_fixture', line: 8, endLine: 8 },
      { trigger: 'trg_fixture', line: 9, endLine: 9 },
    ],
  );
  assert.deepEqual(inspectPublicD1TriggerCaseRisk(fixed).hazards, []);
  assert.deepEqual(
    inspectPublicD1TriggerCaseRisk(fixed.replace('\nBEGIN\n', '\nbegin\n'))
      .lowercaseBegins,
    [{ trigger: 'trg_fixture', line: 2 }],
  );
  assert.equal(parenthesizeOuterTriggerCases(broken), fixed);
});

test('Sites-packaged migrations avoid the public D1 outer-CASE trigger hazard', () => {
  const violations: string[] = [];
  for (const file of expectedSqlFiles) {
    const sql = readFileSync(path.join(archiveDirectory, file), 'utf8');
    if (sql.includes('\r')) violations.push(`${file}: non-LF line ending`);
    const inspection = inspectPublicD1TriggerCaseRisk(sql);
    if (inspection.triggerCount !== topLevelTriggerCount(sql)) {
      violations.push(`${file}: token scan did not cover every top-level trigger`);
    }
    violations.push(
      ...inspection.lowercaseBegins.map(
        ({ trigger, line }) => `${file}:${line} ${trigger}: trigger BEGIN is not uppercase`,
      ),
      ...inspection.hazards.map(
        ({ trigger, line, endLine }) =>
          `${file}:${line}-${endLine} ${trigger}: outer SELECT CASE is not parenthesized`,
      ),
    );
  }
  const attributesPath = path.join(repositoryRoot, '.gitattributes');
  if (
    !existsSync(attributesPath) ||
    readFileSync(attributesPath, 'utf8') !== 'drizzle/*.sql text eol=lf\n'
  ) {
    violations.push('.gitattributes: expected only the drizzle/*.sql LF rule');
  }

  assert.deepEqual(violations, []);
});

test('the R4 SQL delta is exactly 42 token-identified outer CASE wrappers', () => {
  const mismatches: string[] = [];
  let repairedOuterCases = 0;
  for (const file of expectedSqlFiles) {
    const historicalSource = execFileSync(
      'git',
      ['show', `${d1CaseParserBase}:drizzle/${file}`],
      { cwd: repositoryRoot, encoding: 'utf8' },
    );
    const inspection = inspectPublicD1TriggerCaseRisk(historicalSource);
    assert.equal(inspection.hazards.length, expectedOuterTriggerCases[file], file);
    repairedOuterCases += inspection.hazards.length;
    const currentSource = readFileSync(path.join(migrationDirectory, file), 'utf8');
    if (currentSource !== parenthesizeOuterTriggerCases(historicalSource)) {
      mismatches.push(file);
    }
  }

  assert.equal(repairedOuterCases, 42);
  assert.deepEqual(mismatches, []);
});

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

test('the R3 migration 0006 provenance is only one whitespace token and two breakpoint comments', () => {
  const historicalSource = execFileSync(
    'git',
    ['show', `${migrationBoundaryBase}:drizzle/${package8AtomicAdmissionFile}`],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  const migrationBoundarySource = execFileSync(
    'git',
    ['show', `${d1CaseParserBase}:drizzle/${package8AtomicAdmissionFile}`],
    { cwd: repositoryRoot, encoding: 'utf8' },
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
    sha256(migrationBoundarySource),
    '419ba2f2bc70dd7eadfc2fddded84a5c44a6742f518b86037c3b4beb9ddc38b2',
  );
  assert.equal(
    sha256(migrationBoundarySource.replaceAll(`${breakpoint}\n`, '')),
    migrationBoundarySqlHashes[package8AtomicAdmissionFile],
  );
  assert.equal(migrationBoundarySource, expectedSource);
  assert.equal(sqlTokens(migrationBoundarySource), sqlTokens(historicalSource));
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
    '902c4fb1f97bb75cfa26549c53e5fb586d0ea618b6172e7ad641e76b2b82febd',
  );
});
