import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SOURCE_EXTENSIONS = new Set(['.cjs', '.js', '.jsx', '.mjs', '.ts', '.tsx']);
const RESOLUTION_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.sql'];
const CORPUS_MODULE = 'lib/retrieval/corpus-v2.ts';
const ALLOWED_CORPUS_FILES = new Set([
  'docs/retrieval/fixtures/rrf/rrf-corpus-overrides-v2.json',
  'docs/retrieval/fixtures/rrf/rrf-corpus-v1.json',
]);
const FORBIDDEN_REFERENCE = /(?:rrf-dev-queries|rrf-holdout-queries|reference-evaluator|RRF_V2_CALIBRATION)/u;

function relative(root, absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join('/');
}

function productionEntries(root) {
  const entries = [];
  const walk = (relativeDirectory) => {
    const directory = path.join(root, relativeDirectory);
    if (!existsSync(directory)) return;
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const itemPath = path.posix.join(relativeDirectory, item.name);
      if (item.isDirectory()) walk(itemPath);
      else if (SOURCE_EXTENSIONS.has(path.extname(item.name))) entries.push(itemPath);
    }
  };
  walk('app');
  walk('lib/server');
  walk('lib/retrieval');
  return entries.sort();
}

function localSpecifier(specifier) {
  return specifier.startsWith('.') || specifier.startsWith('@/');
}

function resolveLocal(root, importer, specifier) {
  const clean = specifier.split(/[?#]/u, 1)[0];
  const base = clean.startsWith('@/')
    ? path.join(root, clean.slice(2))
    : path.resolve(path.dirname(path.join(root, importer)), clean);
  const rootPrefix = `${root}${path.sep}`;
  if (base !== root && !base.startsWith(rootPrefix)) return null;
  const candidates = [
    base,
    ...RESOLUTION_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...RESOLUTION_EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
  ];
  return candidates.find((candidate) => existsSync(candidate) && lstatSync(candidate).isFile()) ?? null;
}

function importsFrom(source) {
  const imports = [];
  const staticPattern = /(?:^|[;\n])\s*(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?(['"])([^'"\n]+)\1/gmu;
  const dynamicPattern = /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/gu;
  const requirePattern = /\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/gu;
  for (const pattern of [staticPattern, dynamicPattern, requirePattern]) {
    for (const match of source.matchAll(pattern)) imports.push(match[2]);
  }
  return [...new Set(imports)];
}

function violation(code, from, target = null) {
  return target === null ? { code, from } : { code, from, target };
}

export function scanPackage4ProductionBoundary(repositoryRoot, selectedEntries) {
  const root = path.resolve(repositoryRoot);
  const entryPaths = [...(selectedEntries ?? productionEntries(root))].sort();
  const queue = [...entryPaths];
  const reached = new Set();
  const edges = [];
  const allowedCorpusImports = [];
  const violations = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (reached.has(current)) continue;
    const absolutePath = path.join(root, current);
    if (!existsSync(absolutePath)) {
      violations.push(violation('MISSING_ENTRY', current));
      continue;
    }
    const stat = lstatSync(absolutePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      violations.push(violation('NON_REGULAR_DEPENDENCY', current));
      continue;
    }
    reached.add(current);
    if (!SOURCE_EXTENSIONS.has(path.extname(current))) continue;

    const source = readFileSync(absolutePath, 'utf8');
    if (/\bimport\s*\(\s*(?!['"])/u.test(source)) {
      violations.push(violation('NON_LITERAL_DYNAMIC_IMPORT', current));
    }
    if (/\brequire\s*\(\s*(?!['"])/u.test(source)) {
      violations.push(violation('NON_LITERAL_REQUIRE', current));
    }
    if (FORBIDDEN_REFERENCE.test(source)) {
      violations.push(violation('FORBIDDEN_REFERENCE', current));
    }
    if (current === CORPUS_MODULE && /(?:\.expected\b|\[['"]expected['"]\])/u.test(source)) {
      violations.push(violation('EXPECTED_JUDGMENT_ACCESS', current));
    }

    for (const specifier of importsFrom(source)) {
      if (!localSpecifier(specifier)) continue;
      const resolved = resolveLocal(root, current, specifier);
      if (!resolved) {
        violations.push(violation('UNRESOLVED_LOCAL_IMPORT', current, specifier));
        continue;
      }
      const target = relative(root, resolved);
      edges.push({ from: current, to: target });
      if (FORBIDDEN_REFERENCE.test(target)) {
        violations.push(violation('FORBIDDEN_DEPENDENCY', current, target));
      }
      if (target.startsWith('docs/retrieval/fixtures/rrf/')) {
        if (ALLOWED_CORPUS_FILES.has(target) && current === CORPUS_MODULE) {
          allowedCorpusImports.push({ from: current, to: target });
        } else if (!FORBIDDEN_REFERENCE.test(target)) {
          violations.push(violation('CORPUS_IMPORT_OUTSIDE_SEED_PATH', current, target));
        }
      }
      if (!reached.has(target)) queue.push(target);
    }
  }

  const unique = (items) => [...new Map(items.map((item) => [JSON.stringify(item), item])).values()];
  return {
    schemaVersion: 'fcs-package4-production-boundary-v1',
    entryPaths,
    reachedPaths: [...reached].sort(),
    localEdges: unique(edges).sort((left, right) => `${left.from}:${left.to}`.localeCompare(`${right.from}:${right.to}`, 'en')),
    allowedCorpusImports: unique(allowedCorpusImports).sort((left, right) => left.to.localeCompare(right.to, 'en')),
    violations: unique(violations).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right), 'en')),
    holdoutAccessPolicy: 'path-reference-forbidden; fixture validator hashes opaque bytes only',
  };
}

export function assertPackage4ProductionBoundary(repositoryRoot) {
  const result = scanPackage4ProductionBoundary(repositoryRoot);
  if (result.violations.length !== 0) {
    throw new Error(`Package 4 production dependency boundary failed: ${JSON.stringify(result.violations)}`);
  }
  const expected = [...ALLOWED_CORPUS_FILES]
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map((to) => ({ from: CORPUS_MODULE, to }));
  if (JSON.stringify(result.allowedCorpusImports) !== JSON.stringify(expected)) {
    throw new Error('Package 4 corpus import allowance drift');
  }
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = assertPackage4ProductionBoundary(process.cwd());
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex !== -1) {
    const output = process.argv[outputIndex + 1];
    if (!output) throw new Error('--output requires a path');
    mkdirSync(path.dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  }
  console.log(
    `PACKAGE4_BOUNDARY_PASS entries=${result.entryPaths.length} reached=${result.reachedPaths.length} violations=0 corpus-imports=${result.allowedCorpusImports.length}`,
  );
}
