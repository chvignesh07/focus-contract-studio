import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const PACKAGE6_COMMIT = 'de4a119d318d076f8f731273d4093ef863cabd04';
const PACKAGE6_TREE = '503e2559f3e817e9d0f2e3c029a031758d8cf18c';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout ?? ''}${result.stderr ?? ''}`);
  }
  return result.stdout?.trim() ?? '';
}

export function verifyFrozenPackage6(repositoryRoot) {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'fcs-package6-frozen-gate-'));
  const clone = path.join(temporaryRoot, 'repository');
  const linked = [];
  try {
    run('git', ['clone', '--no-local', '--no-checkout', repositoryRoot, clone]);
    run('git', ['checkout', '--detach', PACKAGE6_COMMIT], { cwd: clone });
    for (const name of ['node_modules', '.playwright-browsers']) {
      const source = path.join(repositoryRoot, name);
      if (!statSync(source).isDirectory()) {
        throw new Error(`Package 7 cache source is not a directory: ${name}`);
      }
      const link = path.join(clone, name);
      symlinkSync(source, link);
      linked.push(link);
    }
    run('npm', ['run', 'verify:package6'], {
      cwd: clone,
      env: { ...process.env, npm_config_offline: 'true' },
      stdio: 'inherit',
    });
    for (const link of linked.toReversed()) unlinkSync(link);
    linked.length = 0;
    if (run('git', ['rev-parse', 'HEAD'], { cwd: clone }) !== PACKAGE6_COMMIT) {
      throw new Error('Frozen Package 6 HEAD drifted.');
    }
    if (run('git', ['rev-parse', 'HEAD^{tree}'], { cwd: clone }) !== PACKAGE6_TREE) {
      throw new Error('Frozen Package 6 tree drifted.');
    }
    if (run('git', ['status', '--porcelain'], { cwd: clone }) !== '') {
      throw new Error('Frozen Package 6 verification left a dirty checkout.');
    }
    process.stdout.write(
      `PACKAGE6_FROZEN_GATE_PASS commit=${PACKAGE6_COMMIT} tree=${PACKAGE6_TREE}\n`,
    );
  } finally {
    for (const link of linked.toReversed()) {
      try { unlinkSync(link); } catch { /* already absent */ }
    }
    if (path.basename(temporaryRoot).startsWith('fcs-package6-frozen-gate-')) {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyFrozenPackage6(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
}
