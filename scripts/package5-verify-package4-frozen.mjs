import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const PACKAGE4_COMMIT = '0f85ad66ef6aa190abdfa9f003b1bd96a8a84a7f';

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

export function verifyFrozenPackage4(repositoryRoot) {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'fcs-package4-frozen-gate-'));
  const clone = path.join(temporaryRoot, 'repository');
  const linked = [];
  try {
    run('git', ['clone', '--no-local', '--no-checkout', repositoryRoot, clone]);
    run('git', ['checkout', '--detach', PACKAGE4_COMMIT], { cwd: clone });
    for (const name of ['node_modules', '.playwright-browsers']) {
      const link = path.join(clone, name);
      symlinkSync(path.join(repositoryRoot, name), link);
      linked.push(link);
    }
    run('npm', ['run', 'verify:package4'], {
      cwd: clone,
      env: process.env,
      stdio: 'inherit',
    });
    for (const link of linked.toReversed()) unlinkSync(link);
    linked.length = 0;
    if (run('git', ['rev-parse', 'HEAD'], { cwd: clone }) !== PACKAGE4_COMMIT) {
      throw new Error('Frozen Package 4 HEAD drifted.');
    }
    if (run('git', ['status', '--porcelain'], { cwd: clone }) !== '') {
      throw new Error('Frozen Package 4 verification left a dirty checkout.');
    }
    process.stdout.write(`PACKAGE4_FROZEN_GATE_PASS commit=${PACKAGE4_COMMIT}\n`);
  } finally {
    for (const link of linked.toReversed()) {
      try { unlinkSync(link); } catch { /* already absent */ }
    }
    if (path.basename(temporaryRoot).startsWith('fcs-package4-frozen-gate-')) {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyFrozenPackage4(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
}
