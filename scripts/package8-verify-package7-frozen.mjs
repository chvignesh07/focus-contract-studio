import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const PACKAGE7_COMMIT = '0b616fc5f790da11eb44bb03930ee181d976a452';
const PACKAGE7_TREE = '02aa277c855b5e8dd486026ddc1f37c4bdcde9a1';

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

export function verifyFrozenPackage7(repositoryRoot) {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'fcs-package7-frozen-gate-'));
  const clone = path.join(temporaryRoot, 'repository');
  const linked = [];
  try {
    run('git', ['clone', '--no-local', '--no-checkout', repositoryRoot, clone]);
    run('git', ['checkout', '--detach', PACKAGE7_COMMIT], { cwd: clone });
    for (const name of ['node_modules', '.playwright-browsers']) {
      const source = path.join(repositoryRoot, name);
      if (!statSync(source).isDirectory()) {
        throw new Error(`Package 8 cache source is not a directory: ${name}`);
      }
      const link = path.join(clone, name);
      symlinkSync(source, link);
      linked.push(link);
    }
    run('npm', ['run', 'verify:package7'], {
      cwd: clone,
      env: { ...process.env, npm_config_offline: 'true' },
      stdio: 'inherit',
    });
    for (const link of linked.toReversed()) unlinkSync(link);
    linked.length = 0;
    if (run('git', ['rev-parse', 'HEAD'], { cwd: clone }) !== PACKAGE7_COMMIT) {
      throw new Error('Frozen Package 7 HEAD drifted.');
    }
    if (run('git', ['rev-parse', 'HEAD^{tree}'], { cwd: clone }) !== PACKAGE7_TREE) {
      throw new Error('Frozen Package 7 tree drifted.');
    }
    if (run('git', ['status', '--porcelain'], { cwd: clone }) !== '') {
      throw new Error('Frozen Package 7 verification left a dirty checkout.');
    }
    process.stdout.write(
      `PACKAGE7_FROZEN_GATE_PASS commit=${PACKAGE7_COMMIT} tree=${PACKAGE7_TREE}\n`,
    );
  } finally {
    for (const link of linked.toReversed()) {
      try { unlinkSync(link); } catch { /* already absent */ }
    }
    if (path.basename(temporaryRoot).startsWith('fcs-package7-frozen-gate-')) {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyFrozenPackage7(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
}
