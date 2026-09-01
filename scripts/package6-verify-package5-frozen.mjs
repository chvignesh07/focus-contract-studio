import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const PACKAGE5_COMMIT = 'f54f3c2e2db24d9ce177c47dd16837f0d0b00db0';

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

export function verifyFrozenPackage5(repositoryRoot) {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'fcs-package5-frozen-gate-'));
  const clone = path.join(temporaryRoot, 'repository');
  const linked = [];
  try {
    run('git', ['clone', '--no-local', '--no-checkout', repositoryRoot, clone]);
    run('git', ['checkout', '--detach', PACKAGE5_COMMIT], { cwd: clone });
    for (const name of ['node_modules', '.playwright-browsers']) {
      const source = path.join(repositoryRoot, name);
      if (!statSync(source).isDirectory()) {
        throw new Error(`Package 6 cache source is not a directory: ${name}`);
      }
      const link = path.join(clone, name);
      symlinkSync(source, link);
      linked.push(link);
    }
    run('npm', ['run', 'verify:package5'], {
      cwd: clone,
      env: process.env,
      stdio: 'inherit',
    });
    for (const link of linked.toReversed()) unlinkSync(link);
    linked.length = 0;
    if (run('git', ['rev-parse', 'HEAD'], { cwd: clone }) !== PACKAGE5_COMMIT) {
      throw new Error('Frozen Package 5 HEAD drifted.');
    }
    if (run('git', ['status', '--porcelain'], { cwd: clone }) !== '') {
      throw new Error('Frozen Package 5 verification left a dirty checkout.');
    }
    process.stdout.write(`PACKAGE5_FROZEN_GATE_PASS commit=${PACKAGE5_COMMIT}\n`);
  } finally {
    for (const link of linked.toReversed()) {
      try { unlinkSync(link); } catch { /* already absent */ }
    }
    if (path.basename(temporaryRoot).startsWith('fcs-package5-frozen-gate-')) {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyFrozenPackage5(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
}
