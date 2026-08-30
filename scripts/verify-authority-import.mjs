import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const importedAuthorityPaths = [
  '.devpost-hackathon-state.json',
  'START_HERE.md',
  'WEBMCP_FOUNDER_DECISIONS.md',
  'devpost-submission.md',
  'docs/architecture/ARCHITECTURE.md',
  'docs/architecture/DOMAIN_MODEL.md',
  'docs/architecture/TECHNOLOGY_SELECTION.md',
  'docs/authority/AUTHORITY_VALIDATION.md',
  'docs/authority/PRODUCT_TRUTH.md',
  'docs/contracts/WEBMCP_TOOL_CONTRACT.md',
  'docs/delivery/AGENT_BUILD_CONTRACT.md',
  'docs/delivery/CODEX_IMPLEMENTATION_PLAN.md',
  'docs/delivery/CODEX_TEAM_OPERATING_PLAYBOOK.md',
  'docs/delivery/DEPLOYMENT_AND_OPERATIONS.md',
  'docs/delivery/EVIDENCE_REGISTRY.md',
  'docs/delivery/PROVENANCE_AND_LICENSE.md',
  'docs/delivery/SUBMISSION_PLAN.md',
  'docs/delivery/codex-team/PR_TASK_TEMPLATE.md',
  'docs/hackathon-build/build-notes.md',
  'docs/hackathon-build/checklist.md',
  'docs/hackathon-build/learner-profile.md',
  'docs/hackathon-build/prd.md',
  'docs/hackathon-build/scope.md',
  'docs/hackathon-build/spec.md',
  'docs/product/UX_SPEC.md',
  'docs/quality/ACCESSIBILITY_AND_VERIFICATION.md',
  'docs/quality/SECURITY_AND_PRIVACY.md',
  'docs/quality/TEST_STRATEGY.md',
  'docs/quality/TRACEABILITY_MATRIX.md',
  'docs/retrieval/RETRIEVAL_AND_RRF_SPEC.md',
  'docs/retrieval/RRF_BENCHMARK.md',
  'docs/retrieval/fixtures/rrf/RRF_V2_CALIBRATION.json',
  'docs/retrieval/fixtures/rrf/SHA256SUMS',
  'docs/retrieval/fixtures/rrf/SHA256SUMS-v2',
  'docs/retrieval/fixtures/rrf/reference-evaluator-v2.mjs',
  'docs/retrieval/fixtures/rrf/rrf-corpus-overrides-v2.json',
  'docs/retrieval/fixtures/rrf/rrf-corpus-schema-v2.json',
  'docs/retrieval/fixtures/rrf/rrf-corpus-v1.json',
  'docs/retrieval/fixtures/rrf/rrf-dev-queries-v1.json',
  'docs/retrieval/fixtures/rrf/rrf-dev-queries-v2.json',
  'docs/retrieval/fixtures/rrf/rrf-holdout-queries-v1.json',
  'docs/retrieval/fixtures/rrf/rrf-holdout-queries-v2.json',
  'docs/retrieval/fixtures/rrf/rrf-query-suite-schema-v2.json',
].sort();

export const EXPECTED_AUTHORITY_PACK_SHA256 =
  '0777f7cf34de0032a299b38bf630c74be120317a282ce1cd7290a466159c107f';

export const mandatoryAuthorityPaths = [
  'WEBMCP_FOUNDER_DECISIONS.md',
  'docs/authority/PRODUCT_TRUTH.md',
  'docs/authority/AUTHORITY_VALIDATION.md',
  'docs/delivery/AGENT_BUILD_CONTRACT.md',
  'docs/architecture/TECHNOLOGY_SELECTION.md',
  'docs/hackathon-build/scope.md',
  'docs/hackathon-build/prd.md',
  'docs/hackathon-build/spec.md',
  'docs/architecture/ARCHITECTURE.md',
  'docs/architecture/DOMAIN_MODEL.md',
  'docs/contracts/WEBMCP_TOOL_CONTRACT.md',
  'docs/retrieval/RETRIEVAL_AND_RRF_SPEC.md',
  'docs/retrieval/RRF_BENCHMARK.md',
  'docs/product/UX_SPEC.md',
  'docs/quality/ACCESSIBILITY_AND_VERIFICATION.md',
  'docs/quality/SECURITY_AND_PRIVACY.md',
  'docs/quality/TEST_STRATEGY.md',
  'docs/quality/TRACEABILITY_MATRIX.md',
  'docs/hackathon-build/checklist.md',
  'docs/delivery/EVIDENCE_REGISTRY.md',
  'docs/delivery/DEPLOYMENT_AND_OPERATIONS.md',
  'docs/delivery/PROVENANCE_AND_LICENSE.md',
  'docs/delivery/CODEX_IMPLEMENTATION_PLAN.md',
  'docs/delivery/SUBMISSION_PLAN.md',
  'devpost-submission.md',
  '.devpost-hackathon-state.json',
];

const authorityJsonPaths = importedAuthorityPaths.filter((relativePath) =>
  relativePath.endsWith('.json'),
);

function rootPath(root) {
  return root instanceof URL ? fileURLToPath(root) : path.resolve(root);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function localMarkdownTargets(markdown) {
  const targets = [];
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;

  for (const match of markdown.matchAll(linkPattern)) {
    let target = match[1].trim();
    if (target.startsWith('<')) {
      const closing = target.indexOf('>');
      target = closing === -1 ? target : target.slice(1, closing);
    } else {
      target = target.split(/\s+/u)[0];
    }

    if (
      !target ||
      target.startsWith('#') ||
      /^[a-z][a-z0-9+.-]*:/iu.test(target) ||
      target.startsWith('//')
    ) {
      continue;
    }

    targets.push(target.split('#', 1)[0].split('?', 1)[0]);
  }

  return targets;
}

export async function validateAuthorityPack(repositoryRoot, sourceRoot) {
  const root = rootPath(repositoryRoot);
  const source = sourceRoot ? rootPath(sourceRoot) : undefined;
  const errors = [];
  const brokenLocalLinks = [];
  const sourceByteMismatches = [];
  const packHash = createHash('sha256');

  for (const relativePath of importedAuthorityPaths) {
    const absolutePath = path.join(root, relativePath);
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      errors.push(`missing imported authority file: ${relativePath}`);
      continue;
    }

    const bytes = readFileSync(absolutePath);
    packHash.update(relativePath);
    packHash.update('\0');
    packHash.update(bytes);
    packHash.update('\0');

    if (source) {
      const sourcePath = path.join(source, relativePath);
      if (!existsSync(sourcePath)) {
        sourceByteMismatches.push(`${relativePath}: missing from source`);
      } else if (!bytes.equals(readFileSync(sourcePath))) {
        sourceByteMismatches.push(`${relativePath}: byte mismatch`);
      }
    }
  }

  for (const relativePath of mandatoryAuthorityPaths) {
    if (!existsSync(path.join(root, relativePath))) {
      errors.push(`missing mandatory intake path: ${relativePath}`);
    }
  }

  for (const relativePath of authorityJsonPaths) {
    try {
      JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'));
    } catch (error) {
      errors.push(`invalid JSON ${relativePath}: ${error.message}`);
    }
  }

  const fixtureRoot = path.join(root, 'docs/retrieval/fixtures/rrf');
  const manifestLines = readFileSync(
    path.join(fixtureRoot, 'SHA256SUMS-v2'),
    'utf8',
  )
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);

  for (const line of manifestLines) {
    const match = /^([a-f0-9]{64})\s+\*?(.+)$/u.exec(line);
    if (!match) {
      errors.push(`malformed SHA256SUMS-v2 entry: ${line}`);
      continue;
    }

    const [, expected, filename] = match;
    const fixturePath = path.join(fixtureRoot, filename);
    if (!existsSync(fixturePath)) {
      errors.push(`missing sealed fixture: ${filename}`);
      continue;
    }
    const actual = sha256(readFileSync(fixturePath));
    if (actual !== expected) {
      errors.push(
        `sealed fixture hash mismatch: ${filename} expected ${expected} got ${actual}`,
      );
    }
  }

  for (const relativePath of importedAuthorityPaths.filter((candidate) =>
    candidate.endsWith('.md'),
  )) {
    const markdown = readFileSync(path.join(root, relativePath), 'utf8');
    for (const target of localMarkdownTargets(markdown)) {
      let decodedTarget = target;
      try {
        decodedTarget = decodeURIComponent(target);
      } catch {
        errors.push(`invalid encoded Markdown target: ${relativePath} -> ${target}`);
        continue;
      }
      const resolved = path.resolve(path.dirname(path.join(root, relativePath)), decodedTarget);
      if (!existsSync(resolved)) {
        brokenLocalLinks.push(`${relativePath} -> ${target}`);
      }
    }
  }

  if (sourceByteMismatches.length > 0) {
    errors.push(...sourceByteMismatches);
  }
  if (brokenLocalLinks.length > 0) {
    errors.push(...brokenLocalLinks.map((link) => `broken local link: ${link}`));
  }

  const packSha256 = packHash.digest('hex');
  if (packSha256 !== EXPECTED_AUTHORITY_PACK_SHA256) {
    errors.push(
      `authority pack hash mismatch: expected ${EXPECTED_AUTHORITY_PACK_SHA256} got ${packSha256}`,
    );
  }

  return {
    status: errors.length === 0 ? 'PASS' : 'FAIL',
    authorityRevision: '2.0',
    importedFileCount: importedAuthorityPaths.length,
    mandatoryPathCount: mandatoryAuthorityPaths.length,
    parsedJsonCount: authorityJsonPaths.length,
    fixtureHashCount: manifestLines.length,
    packSha256,
    sourceCompared: Boolean(source),
    sourceByteMismatches,
    brokenLocalLinks,
    errors,
  };
}

async function runCli() {
  const sourceIndex = process.argv.indexOf('--source');
  const source = sourceIndex === -1 ? undefined : process.argv[sourceIndex + 1];
  if (sourceIndex !== -1 && !source) {
    throw new Error('--source requires an absolute or relative directory path');
  }

  const repositoryRoot = new URL('../', import.meta.url);
  const result = await validateAuthorityPack(repositoryRoot, source);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === 'PASS' ? 0 : 1;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  await runCli();
}
