import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout ?? ''}${result.stderr ?? ''}`);
  }
  return result.stdout?.trim() ?? '';
}

export function verifyCleanD1(repositoryRoot) {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'fcs-package8-clean-d1-'));
  try {
    const migrationFiles = readdirSync(path.join(repositoryRoot, 'drizzle'))
      .filter((name) => /^\d{4}_.+\.sql$/u.test(name))
      .sort();
    if (migrationFiles.length !== 6) {
      throw new Error(`Package 8 migration count invalid: ${migrationFiles.length}`);
    }
    const common = [
      'wrangler',
      'd1',
      'migrations',
      'apply',
      'DB',
      '--local',
      '--config',
      'wrangler.package5.jsonc',
      '--persist-to',
      temporaryRoot,
    ];
    run('npx', ['--no-install', ...common], {
      cwd: repositoryRoot,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_WRITE_LOGS: 'false' },
    });
    run('npx', ['--no-install', ...common], {
      cwd: repositoryRoot,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_WRITE_LOGS: 'false' },
    });
    const query = run('npx', [
      '--no-install',
      'wrangler',
      'd1',
      'execute',
      'DB',
      '--local',
      '--config',
      'wrangler.package5.jsonc',
      '--persist-to',
      temporaryRoot,
      '--command',
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type IN ('table','trigger') AND name NOT LIKE 'sqlite_%'",
      '--json',
    ], {
      cwd: repositoryRoot,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_WRITE_LOGS: 'false' },
    });
    const parsed = JSON.parse(query);
    const count = parsed?.[0]?.results?.[0]?.count;
    if (!Number.isInteger(count) || count < 40) throw new Error(`clean D1 schema count invalid: ${count}`);
    return {
      schema_version: 'fcs-package8-clean-d1-v1',
      package: 8,
      status: 'PASS',
      remote_bindings: false,
      migration_directory: 'drizzle',
      migration_files: migrationFiles.length,
      repeated_apply: 'PASS',
      minimum_schema_objects: 40,
    };
  } finally {
    if (path.basename(temporaryRoot).startsWith('fcs-package8-clean-d1-')) {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  }
}

function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const result = verifyCleanD1(repositoryRoot);
    if (process.argv.includes('--write')) {
      writeFileSync(
        path.join(repositoryRoot, '.artifacts/test/package8-clean-d1.json'),
        `${JSON.stringify(result, null, 2)}\n`,
      );
    }
    process.stdout.write(
      `PACKAGE8_CLEAN_D1_PASS migrations=${result.migration_files} repeated=PASS\n`,
    );
  } catch (error) {
    process.stderr.write(`PACKAGE8_CLEAN_D1_FAIL ${error instanceof Error ? error.message : 'unknown error'}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
