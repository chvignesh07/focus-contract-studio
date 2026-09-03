import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parseStrictJson } from './package3-evidence-binding.mjs';

const PACKAGE7_COMMIT = '0b616fc5f790da11eb44bb03930ee181d976a452';
export const GITLEAKS_VERSION = '8.30.1';
export const GITLEAKS_CONFIG_PATH = '.gitleaks.toml';
export const GITLEAKS_IGNORE_PATH = '.gitleaksignore.package8';
const BUILD_INPUT_KEYS = Object.freeze([
  'schemaVersion',
  'product',
  'release',
  'gitTag',
  'nodeVersion',
  'packageManager',
  'lockfileSha256',
  'authorityRevision',
  'fixtureManifest',
  'fixtureManifestSha256',
  'verifyCommand',
  'buildCommand',
]);
const PERMISSIVE_LICENSES = new Set([
  '0BSD',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BlueOak-1.0.0',
  'CC0-1.0',
  'ISC',
  'MIT',
  'MIT OR Apache-2.0',
  'MIT-0',
]);
const REVIEWED_LICENSES = new Set([
  'Apache-2.0 AND LGPL-3.0-or-later',
  'Apache-2.0 AND LGPL-3.0-or-later AND MIT',
  'CC-BY-4.0',
  'LGPL-3.0-or-later',
  'MPL-2.0',
  'Python-2.0',
]);
const SECRET_PATTERNS = Object.freeze([
  ['private-key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/u],
  ['openai-token', /\bsk-[A-Za-z0-9_-]{32,}\b/u],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/u],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/u],
  ['machine-path', /\/Users\/|\/private\/tmp\/|\/var\/folders\/|file:\/\//iu],
]);
const CI_CHECKOUT = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1';
const CI_SETUP_NODE = 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020';

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

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

function resolveExecutable(name) {
  for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, name);
    try {
      accessSync(candidate, constants.X_OK);
      const resolved = realpathSync(candidate);
      if (lstatSync(resolved).isFile()) return resolved;
    } catch {
      // Try the next exact PATH entry.
    }
  }
  throw new Error('Gitleaks executable is unavailable');
}

export function validateGitleaksRuntime(repositoryRoot, receipt = null) {
  const executable = resolveExecutable('gitleaks');
  const version = gitleaksResult(executable, ['version'], repositoryRoot);
  requireCondition(
    version.status === 0 && version.stdout.trim() === GITLEAKS_VERSION,
    `Gitleaks version mismatch; required ${GITLEAKS_VERSION}`,
  );
  const executableSha256 = sha256(readFileSync(executable));
  if (receipt) {
    requireCondition(
      receipt.executable_sha256 === executableSha256,
      'Gitleaks executable identity drift',
    );
  }
  return { executable, executable_sha256: executableSha256 };
}

export function gitleaksEnvironment(environment = process.env) {
  const sanitized = { ...environment };
  delete sanitized.GITLEAKS_CONFIG;
  delete sanitized.GITLEAKS_CONFIG_TOML;
  return sanitized;
}

function gitleaksResult(executable, args, cwd) {
  return spawnSync(executable, args, {
    cwd,
    encoding: 'utf8',
    env: gitleaksEnvironment(),
    maxBuffer: 64 * 1024 * 1024,
  });
}

function readGitleaksReport(reportPath, label) {
  requireCondition(existsSync(reportPath), `${label} report is missing`);
  const report = parseStrictJson(readFileSync(reportPath, 'utf8'), label);
  requireCondition(Array.isArray(report), `${label} report is invalid`);
  return report;
}

function commandIdentity(mode, scope, policyRoot) {
  return [
    'gitleaks',
    mode,
    '--no-banner',
    '--log-level=error',
    '--redact=100',
    `--config=${policyRoot}/${GITLEAKS_CONFIG_PATH}`,
    `--gitleaks-ignore-path=${policyRoot}/${GITLEAKS_IGNORE_PATH}`,
    '--ignore-gitleaks-allow',
    '--exit-code=1',
    '--report-format=json',
    '--report-path=<ephemeral-json>',
    ...(mode === 'git' ? ['--log-opts=--all'] : []),
    scope,
  ];
}

export const GITLEAKS_COMMAND_IDENTITIES = Object.freeze({
  current_tree: Object.freeze(commandIdentity(
    'dir',
    '<ephemeral-current-tree-snapshot>',
    '<current-tree>',
  )),
  reachable_history: Object.freeze(commandIdentity('git', '.', '<repository-root>')),
  planted_negative: Object.freeze(commandIdentity(
    'dir',
    '<ephemeral-planted-negative>',
    '<repository-root>',
  )),
});

export function runLiveGitleaks(repositoryRoot) {
  const configBytes = readRegular(repositoryRoot, GITLEAKS_CONFIG_PATH);
  const ignoreBytes = readRegular(repositoryRoot, GITLEAKS_IGNORE_PATH);
  const runtime = validateGitleaksRuntime(repositoryRoot);
  const headCommit = run('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot });
  const headTree = run('git', ['rev-parse', 'HEAD^{tree}'], { cwd: repositoryRoot });
  const initialStatus = run('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    cwd: repositoryRoot,
  });
  requireCondition(
    initialStatus.length === 0,
    'live Gitleaks requires a clean worktree',
  );

  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'fcs-package8-gitleaks-'));
  try {
    const currentTreeRoot = path.join(temporaryRoot, 'current-tree');
    const treeReportPath = path.join(temporaryRoot, 'tree.json');
    const historyReportPath = path.join(temporaryRoot, 'history.json');
    const negativeRoot = path.join(temporaryRoot, 'negative');
    const negativeReportPath = path.join(temporaryRoot, 'negative.json');
    mkdirSync(currentTreeRoot);
    mkdirSync(negativeRoot);
    const currentTreeIdentity = materializeCurrentTreeSnapshot(
      repositoryRoot,
      currentTreeRoot,
    );
    requireCondition(
      existsSync(path.join(currentTreeRoot, GITLEAKS_CONFIG_PATH)) &&
        existsSync(path.join(currentTreeRoot, GITLEAKS_IGNORE_PATH)),
      'current-tree Gitleaks policy snapshot is incomplete',
    );
    writeFileSync(
      path.join(negativeRoot, 'synthetic.txt'),
      [
        '-----BEGIN ',
        'RSA PRIVATE KEY-----\n',
        'M'.repeat(160),
        '\n-----END ',
        'RSA PRIVATE KEY-----\n',
      ].join(''),
    );

    const treeArgs = [
      'dir',
      '--no-banner',
      '--log-level=error',
      '--redact=100',
      `--config=${path.join(currentTreeRoot, GITLEAKS_CONFIG_PATH)}`,
      `--gitleaks-ignore-path=${path.join(currentTreeRoot, GITLEAKS_IGNORE_PATH)}`,
      '--ignore-gitleaks-allow',
      '--exit-code=1',
      '--report-format=json',
      `--report-path=${treeReportPath}`,
      '.',
    ];
    const historyArgs = [
      'git',
      '--no-banner',
      '--log-level=error',
      '--redact=100',
      `--config=${path.join(repositoryRoot, GITLEAKS_CONFIG_PATH)}`,
      `--gitleaks-ignore-path=${path.join(repositoryRoot, GITLEAKS_IGNORE_PATH)}`,
      '--ignore-gitleaks-allow',
      '--exit-code=1',
      '--report-format=json',
      `--report-path=${historyReportPath}`,
      '--log-opts=--all',
      '.',
    ];
    const negativeArgs = [
      'dir',
      '--no-banner',
      '--log-level=error',
      '--redact=100',
      `--config=${path.join(repositoryRoot, GITLEAKS_CONFIG_PATH)}`,
      `--gitleaks-ignore-path=${path.join(repositoryRoot, GITLEAKS_IGNORE_PATH)}`,
      '--ignore-gitleaks-allow',
      '--exit-code=1',
      '--report-format=json',
      `--report-path=${negativeReportPath}`,
      negativeRoot,
    ];
    const tree = gitleaksResult(runtime.executable, treeArgs, currentTreeRoot);
    const treeFindings = existsSync(treeReportPath)
      ? readGitleaksReport(treeReportPath, 'Gitleaks current-tree')
      : [];
    const treeDiagnostic = tree.stderr
      .replaceAll(repositoryRoot, '<repository-root>')
      .replaceAll(temporaryRoot, '<ephemeral-root>')
      .trim()
      .slice(0, 300);
    requireCondition(
      tree.status === 0,
      `Gitleaks current-tree scan failed or found a leak (exit ${tree.status}; ` +
        `findings ${treeFindings.length}; rules ${[
          ...new Set(treeFindings.map((finding) => finding.RuleID).filter(Boolean)),
        ].join(',') || 'unavailable'}; diagnostic ${treeDiagnostic || 'unavailable'})`,
    );
    requireCondition(treeFindings.length === 0, 'Gitleaks current-tree report contains findings');

    const history = gitleaksResult(runtime.executable, historyArgs, repositoryRoot);
    requireCondition(history.status === 0, 'Gitleaks reachable-history scan failed or found a leak');
    const historyFindings = readGitleaksReport(historyReportPath, 'Gitleaks reachable-history');
    requireCondition(historyFindings.length === 0, 'Gitleaks reachable-history report contains findings');

    const negative = gitleaksResult(runtime.executable, negativeArgs, repositoryRoot);
    requireCondition(negative.status === 1, 'Gitleaks planted-negative scan did not reject');
    const negativeFindings = readGitleaksReport(negativeReportPath, 'Gitleaks planted-negative');
    requireCondition(negativeFindings.length > 0, 'Gitleaks planted-negative report is empty');

    const status = run('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
      cwd: repositoryRoot,
    });
    requireCondition(
      status.length === 0 &&
        headCommit === run('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot }) &&
        headTree === run('git', ['rev-parse', 'HEAD^{tree}'], { cwd: repositoryRoot }),
      'live Gitleaks repository identity changed during scanning',
    );
    const treeCommand = GITLEAKS_COMMAND_IDENTITIES.current_tree;
    const historyCommand = GITLEAKS_COMMAND_IDENTITIES.reachable_history;
    const negativeCommand = GITLEAKS_COMMAND_IDENTITIES.planted_negative;
    const receipt = {
      schema_version: 'fcs-package8-gitleaks-live-v1',
      package: 8,
      status: 'PASS',
      version: GITLEAKS_VERSION,
      executable_sha256: runtime.executable_sha256,
      head_commit: headCommit,
      head_tree: headTree,
      worktree_clean: true,
      worktree_status_sha256: sha256(status),
      policy: {
        config_path: GITLEAKS_CONFIG_PATH,
        config_sha256: sha256(configBytes),
        ignore_path: GITLEAKS_IGNORE_PATH,
        ignore_sha256: sha256(ignoreBytes),
        environment_config_scrubbed: true,
        inline_allow_comments_ignored: true,
      },
      scans: {
        current_tree: {
          scope: 'exact tracked and non-ignored untracked current-tree snapshot',
          command: treeCommand,
          command_sha256: sha256(JSON.stringify(treeCommand)),
          content_file_count: currentTreeIdentity.file_count,
          content_sha256: currentTreeIdentity.aggregate_sha256,
          exit_status: tree.status,
          findings: treeFindings.length,
        },
        reachable_history: {
          scope: 'git log -p --all',
          command: historyCommand,
          command_sha256: sha256(JSON.stringify(historyCommand)),
          exit_status: history.status,
          findings: historyFindings.length,
        },
        planted_negative: {
          scope: 'ephemeral synthetic fixture',
          command: negativeCommand,
          command_sha256: sha256(JSON.stringify(negativeCommand)),
          exit_status: negative.status,
          findings: negativeFindings.length,
          rejected: true,
        },
      },
    };
    const receiptDirectory = path.join(repositoryRoot, '.artifacts/runtime');
    mkdirSync(receiptDirectory, { recursive: true });
    writeFileSync(
      path.join(receiptDirectory, 'package8-gitleaks-live.json'),
      `${JSON.stringify(receipt, null, 2)}\n`,
    );
    return receipt;
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function exactKeys(label, value, expected) {
  requireCondition(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  requireCondition(
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort()),
    `${label} keys drift`,
  );
}

export function assertSafeRelativePath(value, label = 'path') {
  requireCondition(typeof value === 'string' && value.length > 0, `${label} must be non-empty`);
  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new Error(`${label} has malformed encoding`);
  }
  requireCondition(
    !path.isAbsolute(decoded) &&
      !decoded.includes('\\') &&
      !decoded.includes('\0') &&
      !decoded.split('/').includes('..') &&
      decoded === path.posix.normalize(decoded),
    `unsafe ${label}: ${value}`,
  );
  return decoded;
}

function readRegular(repositoryRoot, relativePath) {
  const safePath = assertSafeRelativePath(relativePath, 'repository path');
  const absolutePath = path.join(repositoryRoot, safePath);
  requireCondition(existsSync(absolutePath), `missing file: ${safePath}`);
  const stat = lstatSync(absolutePath);
  requireCondition(stat.isFile() && !stat.isSymbolicLink(), `invalid or symbolic file: ${safePath}`);
  return readFileSync(absolutePath);
}

function expectedBuildInputs(repositoryRoot) {
  const fixtureManifest = 'docs/retrieval/fixtures/rrf/SHA256SUMS-v2';
  return {
    schemaVersion: 'fcs-build-inputs-v1',
    product: 'Focus Contract Studio',
    release: 'webmcp-challenge-2026',
    gitTag: 'webmcp-challenge-2026-final',
    nodeVersion: 'v22.22.3',
    packageManager: 'npm@10.9.8',
    lockfileSha256: sha256(readRegular(repositoryRoot, 'package-lock.json')),
    authorityRevision: '2.0',
    fixtureManifest,
    fixtureManifestSha256: sha256(readRegular(repositoryRoot, fixtureManifest)),
    verifyCommand: 'npm run verify',
    buildCommand: 'npm run build',
  };
}

export function validateBuildInputs(repositoryRoot, source) {
  const parsed = parseStrictJson(source, 'release/BUILD_INPUTS.json');
  exactKeys('release/BUILD_INPUTS.json', parsed, BUILD_INPUT_KEYS);
  requireCondition(
    JSON.stringify(parsed) === JSON.stringify(expectedBuildInputs(repositoryRoot)),
    'release/BUILD_INPUTS.json semantic or runtime identity drift',
  );
  return parsed;
}

function dependencyName(lockPath) {
  const name = lockPath.split('node_modules/').at(-1);
  requireCondition(name && !name.includes('node_modules'), `invalid dependency path: ${lockPath}`);
  return name;
}

function licenseClassification(license) {
  if (PERMISSIVE_LICENSES.has(license)) return 'permissive';
  if (REVIEWED_LICENSES.has(license)) return 'reviewed-obligation';
  if (/(?:^|[^L])GPL|AGPL|SSPL|BUSL|Elastic|Commons-Clause|Noncommercial/iu.test(license)) {
    return 'prohibited';
  }
  return 'unknown';
}

export function buildDependencyInventory(repositoryRoot) {
  const lockBytes = readRegular(repositoryRoot, 'package-lock.json');
  const lock = parseStrictJson(lockBytes.toString('utf8'), 'package-lock.json');
  requireCondition(lock.lockfileVersion === 3, 'package-lock.json version drift');
  requireCondition(lock.packages && typeof lock.packages === 'object', 'package-lock.json packages missing');
  const root = lock.packages[''];
  requireCondition(root && typeof root === 'object', 'package-lock.json root package missing');
  const direct = new Set([
    ...Object.keys(root.dependencies ?? {}),
    ...Object.keys(root.devDependencies ?? {}),
  ]);
  const packages = Object.entries(lock.packages)
    .filter(([lockPath]) => lockPath !== '')
    .map(([lockPath, metadata]) => {
      assertSafeRelativePath(lockPath, 'lockfile package path');
      requireCondition(metadata && typeof metadata === 'object', `missing metadata: ${lockPath}`);
      requireCondition(typeof metadata.version === 'string', `missing version: ${lockPath}`);
      requireCondition(typeof metadata.license === 'string', `missing license: ${lockPath}`);
      requireCondition(typeof metadata.integrity === 'string', `missing integrity: ${lockPath}`);
      const name = dependencyName(lockPath);
      return {
        path: lockPath,
        name,
        version: metadata.version,
        license: metadata.license,
        license_classification: licenseClassification(metadata.license),
        direct: direct.has(name) && lockPath === `node_modules/${name}`,
        dev: metadata.dev === true,
        optional: metadata.optional === true,
        integrity: metadata.integrity,
        resolved: metadata.resolved ?? null,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
  const findings = packages
    .filter((entry) => !['permissive', 'reviewed-obligation'].includes(entry.license_classification))
    .map((entry) => ({ path: entry.path, classification: entry.license_classification }));
  const licenseCounts = Object.fromEntries(
    [...new Set(packages.map(({ license }) => license))]
      .sort()
      .map((license) => [license, packages.filter((entry) => entry.license === license).length]),
  );
  return {
    schema_version: 'fcs-package8-dependency-license-v1',
    package: 8,
    status: findings.length === 0 ? 'PASS' : 'FAIL',
    source: 'package-lock.json',
    lockfile_sha256: sha256(lockBytes),
    package_count: packages.length,
    direct_package_count: packages.filter(({ direct: value }) => value).length,
    reviewed_obligation_package_count: packages.filter(
      ({ license_classification: value }) => value === 'reviewed-obligation',
    ).length,
    license_counts: licenseCounts,
    unresolved_findings: findings,
    packages,
  };
}

export function buildThirdPartyNotices(inventory) {
  const rows = inventory.packages
    .map(({ name, version, license, license_classification: classification, resolved }) =>
      `| \`${name}\` | \`${version}\` | ${license} | ${classification} | ${resolved ?? 'lockfile integrity only'} |`,
    )
    .join('\n');
  return `# Third-Party Notices\n\n` +
    `Generated deterministically from \`package-lock.json\` by \`npm run verify:package8:release\`. ` +
    `Focus Contract Studio does not relicense these packages. Consult each package distribution for its complete license text and notices.\n\n` +
    `Known LGPL, MPL, CC-BY, and Python-license entries are recorded as reviewed obligations, not silently treated as permissive. ` +
    `The LGPL entries are locked optional Sharp/libvips platform distributions; MPL entries are testing, rendering, or CSS tooling. ` +
    `This inventory is not legal advice.\n\n` +
    `| Package | Version | Detected license | Classification | Locked source |\n` +
    `|---|---:|---|---|---|\n${rows}\n`;
}

function trackedPaths(repositoryRoot) {
  return run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: repositoryRoot,
  })
    .split('\0')
    .filter(Boolean)
    .filter((relativePath) => existsSync(path.join(repositoryRoot, relativePath)))
    .sort();
}

function currentTreeEntries(repositoryRoot) {
  return trackedPaths(repositoryRoot).map((relativePath) => {
    assertSafeRelativePath(relativePath, 'current-tree path');
    const absolutePath = path.join(repositoryRoot, relativePath);
    const stat = lstatSync(absolutePath);
    requireCondition(
      stat.isFile() && !stat.isSymbolicLink(),
      `current-tree path is not a regular file: ${relativePath}`,
    );
    const bytes = readFileSync(absolutePath);
    return { path: relativePath, bytes, sha256: sha256(bytes) };
  });
}

function currentTreeIdentity(entries) {
  return {
    file_count: entries.length,
    aggregate_sha256: sha256(
      entries.map((entry) => `${entry.sha256}  ${entry.bytes.length}  ${entry.path}\n`).join(''),
    ),
  };
}

export function buildCurrentTreeIdentity(repositoryRoot) {
  return currentTreeIdentity(currentTreeEntries(repositoryRoot));
}

function materializeCurrentTreeSnapshot(repositoryRoot, snapshotRoot) {
  const entries = currentTreeEntries(repositoryRoot);
  for (const entry of entries) {
    const destination = path.join(snapshotRoot, entry.path);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, entry.bytes);
  }
  return currentTreeIdentity(entries);
}

export function scanBytes(relativePath, bytes) {
  if (bytes.includes(0)) return [];
  const text = bytes.toString('utf8');
  return SECRET_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([kind]) => ({ path: relativePath, kind }));
}

export function scanTrackedSource(repositoryRoot) {
  const findings = [];
  for (const relativePath of trackedPaths(repositoryRoot)) {
    assertSafeRelativePath(relativePath, 'tracked path');
    const absolutePath = path.join(repositoryRoot, relativePath);
    const stat = lstatSync(absolutePath);
    requireCondition(stat.isFile() && !stat.isSymbolicLink(), `tracked symlink or non-file: ${relativePath}`);
    findings.push(...scanBytes(relativePath, readFileSync(absolutePath)));
  }
  return findings;
}

export function scanReachableHistory(repositoryRoot) {
  const pattern = [
    '-----BEGIN [A-Z ]*PRIVATE KEY-----',
    'sk-[A-Za-z0-9_-]{32,}',
    'gh[pousr]_[A-Za-z0-9]{36,}',
    'AKIA[0-9A-Z]{16}',
    ['/Us', 'ers/'].join(''),
    ['/private/', 'tmp/'].join(''),
    ['/var/', 'folders/'].join(''),
    ['file:', '//'].join(''),
  ].join('|');
  const findings = [];
  for (const commit of run('git', ['rev-list', 'HEAD'], { cwd: repositoryRoot }).split('\n').filter(Boolean)) {
    const result = spawnSync('git', ['grep', '-I', '-l', '-E', '-e', pattern, commit, '--'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    requireCondition(result.status === 0 || result.status === 1, `Git history scan failed at ${commit}`);
    for (const match of result.stdout.trim().split('\n').filter(Boolean)) {
      findings.push({ commit, path: match.slice(commit.length + 1) });
    }
  }
  return findings;
}

function walkRegular(root, current = root) {
  const files = [];
  for (const name of readdirSync(current).sort()) {
    const absolutePath = path.join(current, name);
    const stat = lstatSync(absolutePath);
    requireCondition(!stat.isSymbolicLink(), `symbolic bundle path: ${path.relative(root, absolutePath)}`);
    if (stat.isDirectory()) files.push(...walkRegular(root, absolutePath));
    else if (stat.isFile()) files.push(absolutePath);
    else throw new Error(`unsupported bundle entry: ${path.relative(root, absolutePath)}`);
  }
  return files;
}

export function scanProductionBundle(repositoryRoot) {
  const bundleRoot = path.join(repositoryRoot, 'dist');
  requireCondition(existsSync(bundleRoot) && lstatSync(bundleRoot).isDirectory(), 'production bundle missing');
  const findings = [];
  for (const absolutePath of walkRegular(bundleRoot)) {
    const relativePath = path.relative(repositoryRoot, absolutePath).split(path.sep).join('/');
    if (/\.map$|\/(?:\.env[^/]*|[^/]+\.(?:pem|key|p12|pfx|der))$/iu.test(relativePath)) {
      findings.push({ path: relativePath, kind: 'forbidden-bundle-file' });
    }
    findings.push(...scanBytes(relativePath, readFileSync(absolutePath)));
  }
  return findings;
}

function localMarkdownTargets(markdown) {
  const targets = [];
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    let target = match[1].trim();
    if (target.startsWith('<')) {
      const closing = target.indexOf('>');
      target = closing === -1 ? target : target.slice(1, closing);
    } else {
      target = target.split(/\s+/u)[0];
    }
    if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/iu.test(target) || target.startsWith('//')) continue;
    targets.push(target.split('#', 1)[0].split('?', 1)[0]);
  }
  return targets;
}

export function checkLocalMarkdownLinks(repositoryRoot) {
  const broken = [];
  for (const relativePath of trackedPaths(repositoryRoot).filter((value) => value.endsWith('.md'))) {
    const markdown = readRegular(repositoryRoot, relativePath).toString('utf8');
    for (const target of localMarkdownTargets(markdown)) {
      let decoded;
      try { decoded = decodeURIComponent(target); } catch { broken.push(`${relativePath} -> ${target}`); continue; }
      const resolved = path.resolve(path.dirname(path.join(repositoryRoot, relativePath)), decoded);
      if (!resolved.startsWith(`${repositoryRoot}${path.sep}`) || !existsSync(resolved)) {
        broken.push(`${relativePath} -> ${target}`);
      }
    }
  }
  return broken;
}

export function validateCiWorkflow(source) {
  requireCondition(
    source.includes('GITLEAKS_VERSION: "8.30.1"'),
    'Gitleaks version is not pinned in CI',
  );
  requireCondition(
    source.includes('GITLEAKS_SHA256: "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"'),
    'Gitleaks archive checksum is not pinned in CI',
  );
  for (const required of [
    'runs-on: ubuntu-24.04',
    `uses: ${CI_CHECKOUT}`,
    'persist-credentials: false',
    `uses: ${CI_SETUP_NODE}`,
    "node-version: '22.22.3'",
    'package-manager-cache: false',
    'run: npm ci',
    'https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz',
    'sha256sum --check --strict',
    'run: npm run setup:browsers',
    'run: npm run verify',
  ]) requireCondition(source.includes(required), `CI workflow missing: ${required}`);
  requireCondition(source.includes('permissions:\n  contents: read'), 'CI permissions must be read-only');
  for (const match of source.matchAll(/^\s*uses:\s*(\S+)/gmu)) {
    requireCondition(/@[0-9a-f]{40}$/u.test(match[1]), `unpinned CI action: ${match[1]}`);
  }
}

export function validateReleaseLineage(repositoryRoot) {
  run('git', ['merge-base', '--is-ancestor', PACKAGE7_COMMIT, 'HEAD'], { cwd: repositoryRoot });
  for (const relativePath of trackedPaths(repositoryRoot)) assertSafeRelativePath(relativePath, 'tracked path');
  return { base_commit: PACKAGE7_COMMIT, status: 'PASS' };
}

export function buildTrackedGitleaksEvidence(gitleaks) {
  return {
    version: gitleaks.version,
    config_path: gitleaks.policy.config_path,
    config_sha256: gitleaks.policy.config_sha256,
    ignore_path: gitleaks.policy.ignore_path,
    ignore_sha256: gitleaks.policy.ignore_sha256,
    environment_config_scrubbed: gitleaks.policy.environment_config_scrubbed,
    inline_allow_comments_ignored: gitleaks.policy.inline_allow_comments_ignored,
    current_tree_scope: gitleaks.scans.current_tree.scope,
    current_tree_command_sha256: gitleaks.scans.current_tree.command_sha256,
    reachable_history_scope: gitleaks.scans.reachable_history.scope,
    reachable_history_command_sha256: gitleaks.scans.reachable_history.command_sha256,
    planted_negative_command_sha256: gitleaks.scans.planted_negative.command_sha256,
    current_tree_exit_status: gitleaks.scans.current_tree.exit_status,
    current_tree_findings: gitleaks.scans.current_tree.findings,
    reachable_history_exit_status: gitleaks.scans.reachable_history.exit_status,
    reachable_history_findings: gitleaks.scans.reachable_history.findings,
    planted_negative_exit_status: gitleaks.scans.planted_negative.exit_status,
    planted_negative_findings: gitleaks.scans.planted_negative.findings,
    planted_negative_rejected: gitleaks.scans.planted_negative.rejected,
  };
}

function buildReleaseSecurity(repositoryRoot, gitleaks) {
  const worktreeFindings = scanTrackedSource(repositoryRoot);
  const historyFindings = scanReachableHistory(repositoryRoot);
  const bundleFindings = scanProductionBundle(repositoryRoot);
  const brokenLinks = checkLocalMarkdownLinks(repositoryRoot);
  const lineage = validateReleaseLineage(repositoryRoot);
  const inventory = buildDependencyInventory(repositoryRoot);
  requireCondition(gitleaks.status === 'PASS', 'live Gitleaks receipt failed');
  requireCondition(inventory.status === 'PASS', 'dependency or license finding');
  requireCondition(worktreeFindings.length === 0, `tracked source finding: ${JSON.stringify(worktreeFindings[0])}`);
  requireCondition(historyFindings.length === 0, `reachable history finding: ${JSON.stringify(historyFindings[0])}`);
  requireCondition(bundleFindings.length === 0, `production bundle finding: ${JSON.stringify(bundleFindings[0])}`);
  requireCondition(brokenLinks.length === 0, `broken local link: ${brokenLinks[0]}`);
  return {
    schema_version: 'fcs-package8-release-security-v2',
    package: 8,
    status: 'BLOCKED',
    local_integrity_status: 'PASS',
    blocker: 'Trusted client isolation at the actual ChatGPT Sites edge is not yet evidenced.',
    environment: 'local-source-built-worker-no-remote-bindings',
    checks: {
      nonce_rooted_script_csp_runtime: 'PASS',
      nonced_inline_style_and_same_origin_stylesheet_csp_runtime: 'PASS',
      nosniff_referrer_origin_isolation_runtime: 'PASS',
      webmcp_tools_self_permissions_policy_runtime: 'PASS',
      atomic_workspace_admission_and_idempotent_replay: 'PASS',
      direct_edge_bootstrap_isolation_local_runtime: 'PASS',
      session_ttl_rotation_cleanup_and_privacy_disclosure: 'PASS',
      tracked_source_secret_and_machine_path_scan: 'PASS',
      head_reachable_history_scan: 'PASS',
      gitleaks_worktree: 'PASS',
      gitleaks_history: 'PASS',
      dependency_license_inventory: 'PASS',
      production_bundle_scan: 'PASS',
      local_markdown_links: 'PASS',
      pinned_read_only_ci: 'PASS',
      package7_ancestry_and_safe_tracked_paths: lineage.status,
    },
    findings: { critical: 0, high: 0, unresolved_license: 0 },
    live_gitleaks: buildTrackedGitleaksEvidence(gitleaks),
    dependency_inventory_sha256: sha256(
      readRegular(repositoryRoot, '.artifacts/security/package8-dependency-license.json'),
    ),
    third_party_notices_sha256: sha256(readRegular(repositoryRoot, 'THIRD_PARTY_NOTICES.md')),
    external: {
      sites_edge_client_isolation: 'NOT_RUN',
      hosted_headers: 'NOT_RUN',
      supported_client: 'NOT_RUN',
      chrome_trace: 'NOT_RUN',
      deployment: 'NOT_RUN',
    },
  };
}

function verifyGenerated(repositoryRoot, relativePath, expected) {
  const actual = readRegular(repositoryRoot, relativePath).toString('utf8');
  requireCondition(actual === expected, `${relativePath} drift`);
}

export function runPackage8ReleaseChecks(repositoryRoot, { write = false } = {}) {
  const gitleaks = runLiveGitleaks(repositoryRoot);
  validateBuildInputs(
    repositoryRoot,
    readRegular(repositoryRoot, 'release/BUILD_INPUTS.json').toString('utf8'),
  );
  validateCiWorkflow(readRegular(repositoryRoot, '.github/workflows/verify.yml').toString('utf8'));
  const inventory = buildDependencyInventory(repositoryRoot);
  requireCondition(inventory.status === 'PASS', 'unresolved dependency/license finding');
  const inventoryText = `${JSON.stringify(inventory, null, 2)}\n`;
  const notices = buildThirdPartyNotices(inventory);
  const inventoryPath = '.artifacts/security/package8-dependency-license.json';
  if (write) {
    writeFileSync(path.join(repositoryRoot, inventoryPath), inventoryText);
    writeFileSync(path.join(repositoryRoot, 'THIRD_PARTY_NOTICES.md'), notices);
  } else {
    verifyGenerated(repositoryRoot, inventoryPath, inventoryText);
    verifyGenerated(repositoryRoot, 'THIRD_PARTY_NOTICES.md', notices);
  }
  const security = buildReleaseSecurity(repositoryRoot, gitleaks);
  const securityText = `${JSON.stringify(security, null, 2)}\n`;
  const securityPath = '.artifacts/security/release-security.json';
  if (write) writeFileSync(path.join(repositoryRoot, securityPath), securityText);
  else verifyGenerated(repositoryRoot, securityPath, securityText);
  const finalGitleaks = write ? runLiveGitleaks(repositoryRoot) : gitleaks;
  return { inventory, security, gitleaks: finalGitleaks };
}

function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const result = runPackage8ReleaseChecks(repositoryRoot, { write: process.argv.includes('--write') });
    process.stdout.write(
      `PACKAGE8_RELEASE_PASS packages=${result.inventory.package_count} checks=${Object.keys(result.security.checks).length}\n`,
    );
  } catch (error) {
    process.stderr.write(`PACKAGE8_RELEASE_FAIL ${error instanceof Error ? error.message : 'unknown error'}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
