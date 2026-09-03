import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const package9Base = '825f7ee012d0ab7c59f95ca62581ad5b5e5c28b2';
const d1CaseParserBase = '814745b3ce44569c61174eb7a413156955cde831';
const bootstrapDiagnosticsBase = '72a05e780cc037c5a2e0df6938e1bfcad73ab4e5';
const bootstrapDiagnosticsReviewBase = '4afbe5521a63a5fc766ac446fd0ff089d93f7f1a';
const clientFingerprintBase = '49f5b679b0c0ff71ec73a96725a9c89e65b4bb3c';
const clientFingerprintDocumentationBase = 'fab2eb061f03569d2340c809613058123af936e7';
const evidencePath = 'docs/evidence/ADVERSARIAL_REVIEW_1.md';
const d1CaseParserSourcePaths = [
  '.gitattributes',
  'drizzle/0001_package1_domain.sql',
  'drizzle/0002_package2_vertical_slice.sql',
  'drizzle/0003_package3_raw_observer_verifier.sql',
  'drizzle/0004_package5_review_apply_undo.sql',
  'drizzle/0006_package8_atomic_admission.sql',
  'tests/package9-node/sites-migration-packaging.test.ts',
  'tests/package9-node/source-evidence.test.ts',
] as const;
const bootstrapDiagnosticsSourcePaths = [
  'app/api/session/bootstrap/route.ts',
  'docs/delivery/DEPLOYMENT_AND_OPERATIONS.md',
  'tests/package8/admission.test.ts',
  'tests/package9-node/source-evidence.test.ts',
] as const;
const bootstrapDiagnosticsReviewSourcePaths = [
  'app/api/session/bootstrap/route.ts',
  'tests/package8/admission.test.ts',
  'tests/package9-node/source-evidence.test.ts',
] as const;
const clientFingerprintDocumentationPaths = [
  'README.md',
  'docs/delivery/DEPLOYMENT_AND_OPERATIONS.md',
] as const;
const clientFingerprintSourcePaths = [
  ...clientFingerprintDocumentationPaths,
  'docs/quality/SECURITY_AND_PRIVACY.md',
  'lib/server/admission.ts',
  'tests/package8/admission.test.ts',
  'tests/package9-node/source-evidence.test.ts',
] as const;
const clientFingerprintChangedPaths = [
  ...clientFingerprintSourcePaths,
  evidencePath,
] as const;
const clientFingerprintDocumentationChangedPaths = [
  ...clientFingerprintDocumentationPaths,
  evidencePath,
  'tests/package9-node/source-evidence.test.ts',
] as const;

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function git(args: string[]) {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
}

function gitLines(args: string[]) {
  return git(args).trim().split('\n').filter(Boolean);
}

function topLevelTestCount(source: string) {
  return source.match(/^test\(/gmu)?.length ?? 0;
}

function sourceIdentity(sourcePaths: readonly string[], revision?: string) {
  const files = sourcePaths.map((relativePath) => {
    let bytes: Buffer;
    if (revision) {
      bytes = Buffer.from(git(['show', `${revision}:${relativePath}`]));
    } else {
      const absolutePath = path.join(repositoryRoot, relativePath);
      const stat = lstatSync(absolutePath);
      assert.equal(stat.isFile() && !stat.isSymbolicLink(), true, relativePath);
      bytes = readFileSync(absolutePath);
    }
    return {
      path: relativePath,
      bytes: bytes.length,
      sha256: sha256(bytes),
    };
  });

  return {
    fileCount: files.length,
    sha256: sha256(
      files
        .map((file) => `${file.sha256}  ${file.bytes}  ${file.path}\n`)
        .join(''),
    ),
  };
}

test('the Package 9 D1 CASE-parser descendant and local evidence are exactly source-bound', () => {
  const changedPaths = new Set([
    ...gitLines([
      'diff',
      '--name-only',
      d1CaseParserBase,
      bootstrapDiagnosticsBase,
      '--',
    ]),
  ]);
  assert.deepEqual(
    [...changedPaths].sort(),
    [...d1CaseParserSourcePaths, evidencePath].sort(),
  );

  const priorEvidence = git(['show', `${d1CaseParserBase}:${evidencePath}`]);
  const evidence = git(['show', `${bootstrapDiagnosticsBase}:${evidencePath}`]);
  assert.ok(
    evidence.startsWith(priorEvidence),
    'the frozen pre-descendant evidence must remain byte-identical',
  );
  assert.ok(
    priorEvidence.includes(
      '<!-- package9-migration-boundaries-r3-source-binding files=4 sha256=d3ccd663c7614d276e5ffe95ea31ced228533280f8d574bed0f64a23ab1c4a50 -->',
    ),
    'the historical R3 source hash must remain provenance',
  );

  const identity = sourceIdentity(d1CaseParserSourcePaths, bootstrapDiagnosticsBase);
  assert.match(
    evidence,
    new RegExp(
      `<!-- package9-sites-d1-case-parser-r4-source-binding files=${identity.fileCount} sha256=${identity.sha256} -->`,
      'u',
    ),
  );
  for (const claim of [
    'Public compatibility fixture: `1/1 PASS`',
    'Focused RED: `0/2 PASS`, `2/2 FAIL`',
    'Focused GREEN: `2/2 PASS`',
    'Repaired outer CASE statements: `42`',
    'Migration totals: `180` top-level statements and `174` breakpoints',
    'Fresh D1: `180/180 PASS`; rerun after a complete successful application executed `0` statements',
    'Archive identity: `PASS`',
    'Correctness reviewer `/root/sites_d1_case_correctness_review`: `PASS`',
    'Security/data-integrity reviewer `/root/sites_d1_case_security_review`: `PASS`',
    'Hosted D1: `NOT_RUN`',
    'Saved Sites Version 4: `NOT_RETRIED`',
    'Final clean-commit canonical: `TERMINAL_POST_COMMIT`',
  ]) {
    assert.ok(evidence.includes(claim), `missing Package 9 evidence: ${claim}`);
  }
});

test('the Package 9 bootstrap-diagnostics descendant and local evidence are exactly source-bound', () => {
  const changedPaths = new Set([
    ...gitLines([
      'diff',
      '--name-only',
      bootstrapDiagnosticsBase,
      clientFingerprintBase,
      '--',
    ]),
  ]);
  assert.deepEqual(
    [...changedPaths].sort(),
    [...bootstrapDiagnosticsSourcePaths, evidencePath].sort(),
  );

  const priorEvidence = git(['show', `${bootstrapDiagnosticsBase}:${evidencePath}`]);
  const evidence = git(['show', `${clientFingerprintBase}:${evidencePath}`]);
  assert.ok(
    evidence.startsWith(priorEvidence),
    'the frozen R4 evidence must remain byte-identical',
  );
  assert.ok(
    priorEvidence.includes(
      '<!-- package9-sites-d1-case-parser-r4-source-binding files=8 sha256=1ca3b470b227f2289a2fc1d1562374b2fd3cf19dd77ddb1e91956978b77fc16c -->',
    ),
    'the historical R4 source hash must remain provenance',
  );

  const identity = sourceIdentity(
    bootstrapDiagnosticsSourcePaths,
    bootstrapDiagnosticsReviewBase,
  );
  assert.match(
    evidence,
    new RegExp(
      `<!-- package9-sites-bootstrap-diagnostics-r5-source-binding files=${identity.fileCount} sha256=${identity.sha256} -->`,
      'u',
    ),
  );

  const addedAdmissionTests = topLevelTestCount(
    git(['show', `${clientFingerprintBase}:tests/package8/admission.test.ts`]),
  ) - topLevelTestCount(
    git(['show', `${bootstrapDiagnosticsBase}:tests/package8/admission.test.ts`]),
  );
  const addedEvidenceBindingTests = topLevelTestCount(
    git(['show', `${clientFingerprintBase}:tests/package9-node/source-evidence.test.ts`]),
  ) - topLevelTestCount(
    git(['show', `${bootstrapDiagnosticsBase}:tests/package9-node/source-evidence.test.ts`]),
  );
  assert.deepEqual(
    { addedAdmissionTests, addedEvidenceBindingTests },
    { addedAdmissionTests: 3, addedEvidenceBindingTests: 1 },
  );
  assert.equal(536 + addedAdmissionTests + addedEvidenceBindingTests, 540);
  assert.doesNotMatch(
    evidence.slice(priorEvidence.length),
    /current status: `PENDING`/u,
    'the current R5 evidence must not claim a stale post-commit status',
  );

  const reviewChangedPaths = new Set([
    ...gitLines([
      'diff',
      '--name-only',
      bootstrapDiagnosticsReviewBase,
      clientFingerprintBase,
      '--',
    ]),
  ]);
  assert.deepEqual(
    [...reviewChangedPaths].sort(),
    [...bootstrapDiagnosticsReviewSourcePaths, evidencePath].sort(),
  );
  const reviewIdentity = sourceIdentity(
    bootstrapDiagnosticsReviewSourcePaths,
    clientFingerprintBase,
  );
  assert.match(
    evidence,
    new RegExp(
      `<!-- package9-sites-bootstrap-diagnostics-r5-review-fix-source-binding files=${reviewIdentity.fileCount} sha256=${reviewIdentity.sha256} -->`,
      'u',
    ),
  );
  for (const claim of [
    'Focused RED: `1/3 PASS`, `2/3 FAIL`',
    'Focused GREEN: `3/3 PASS`',
    '`event`, `stage`, and `correlationId`',
    '`runtime_config`, `request_validation`, `session_resolution`, `client_fingerprint`, `global_admission`, `workspace_seed`, and `active_seed_read`',
    'Structured `FcsError` responses remain byte-compatible and emit no unexpected-error record.',
    'Pre-commit canonical: `PASS_TO_CLEAN_TREE_GITLEAKS`',
    'R4 `536` + three Package 8 admission tests + one Package 9 evidence-binding test = exact clean-commit canonical total `540/540`.',
    'Archive identity: `PASS`',
    'Correctness/test reviewer `/root/sites_bootstrap_correctness_review`: `PASS`',
    'Security/privacy reviewer `/root/sites_bootstrap_security_review`: `PASS`',
    'Hosted D1 and Sites: `NOT_RUN`',
    'This tracked artifact does not claim to prove its own final commit or exact-clone outcomes; those results belong only in the post-commit handoff receipt.',
  ]) {
    assert.ok(evidence.includes(claim), `missing R5 diagnostic evidence: ${claim}`);
  }
});

test('the Package 9 client-fingerprint descendant and local evidence are exactly source-bound', () => {
  for (const documentationPath of clientFingerprintDocumentationPaths) {
    const documentation = readFileSync(
      path.join(repositoryRoot, documentationPath),
      'utf8',
    );
    assert.doesNotMatch(
      documentation,
      /Cloudflare runtime metadata/iu,
      `${documentationPath} must not require obsolete Cloudflare runtime metadata`,
    );
    assert.doesNotMatch(
      documentation,
      /non-HTTP(?:\s+Cloudflare)?\s+(?:runtime\s+)?metadata/iu,
      `${documentationPath} must not require non-HTTP metadata`,
    );
    for (const requirement of [
      'strictly validated `CF-Connecting-IP`',
      'does not access `request.cf`',
      '`X-Forwarded-For`, `X-Real-IP`, and other forwarding headers cannot select the rate bucket.',
      'The raw address is neither stored nor logged.',
      'Missing or malformed input returns structured HTTP 503 before application writes.',
      'ephemeral abuse-control HMAC bucket',
      'never used for authentication or authorization.',
      'Hosted edge overwrite/spoof resistance remains unproven until an owner-only deployed probe passes',
    ]) {
      assert.ok(
        documentation.includes(requirement),
        `${documentationPath} is missing truthful R6 edge-boundary wording: ${requirement}`,
      );
    }
  }

  const documentationChangedPaths = new Set([
    ...gitLines(['diff', '--name-only', clientFingerprintDocumentationBase, '--']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ]);
  assert.deepEqual(
    [...documentationChangedPaths].sort(),
    [...clientFingerprintDocumentationChangedPaths].sort(),
  );

  const changedPaths = new Set([
    ...gitLines(['diff', '--name-only', clientFingerprintBase, '--']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ]);
  assert.deepEqual(
    [...changedPaths].sort(),
    [...clientFingerprintChangedPaths].sort(),
  );

  const priorEvidence = git(['show', `${clientFingerprintBase}:${evidencePath}`]);
  const evidence = readFileSync(path.join(repositoryRoot, evidencePath), 'utf8');
  assert.ok(
    evidence.startsWith(priorEvidence),
    'the frozen R5 evidence must remain byte-identical',
  );

  const identity = sourceIdentity(clientFingerprintSourcePaths);
  assert.match(
    evidence,
    new RegExp(
      `<!-- package9-sites-client-fingerprint-r6-source-binding files=${identity.fileCount} sha256=${identity.sha256} -->`,
      'u',
    ),
  );

  const addedAdmissionTests = topLevelTestCount(
    readFileSync(path.join(repositoryRoot, 'tests/package8/admission.test.ts'), 'utf8'),
  ) - topLevelTestCount(
    git(['show', `${clientFingerprintBase}:tests/package8/admission.test.ts`]),
  );
  const addedEvidenceBindingTests = topLevelTestCount(
    readFileSync(path.join(repositoryRoot, 'tests/package9-node/source-evidence.test.ts'), 'utf8'),
  ) - topLevelTestCount(
    git(['show', `${clientFingerprintBase}:tests/package9-node/source-evidence.test.ts`]),
  );
  assert.deepEqual(
    { addedAdmissionTests, addedEvidenceBindingTests },
    { addedAdmissionTests: 2, addedEvidenceBindingTests: 1 },
  );
  assert.equal(540 + addedAdmissionTests + addedEvidenceBindingTests, 543);

  for (const claim of [
    'Focused RED: `0/1 PASS`, `1/1 FAIL`',
    'Focused GREEN: `5/5 PASS`',
    'request.cf is never accessed for a valid direct-edge request.',
    'Header access and HMAC derivation remain distinct client-fingerprint failure boundaries.',
    'No raw edge address or secret reaches logs, public responses, storage, or evidence.',
    'Package 9 R6 documentation-closure addendum',
    'Documentation/binding reviewer `/root/r6_documentation_binding_reviewer`: `PASS`',
    'Correctness/security reviewer `/root/client_fingerprint_correctness_security`: `PASS`',
    'Test/evidence reviewer `/root/client_fingerprint_tests_evidence`: `PASS`',
    'Hosted D1 and Sites: `NOT_RUN`',
    'Final clean-commit canonical and exact no-local clone: `TERMINAL_POST_COMMIT`',
    'No external action: **YES**',
  ]) {
    assert.ok(evidence.includes(claim), `missing R6 client-fingerprint evidence: ${claim}`);
  }
  assert.match(
    evidence,
    /Hosted edge overwrite\/spoof resistance remains unproven until an owner-only\s+deployed probe passes\./u,
  );
});

test('the Package 9 canonical gate preserves frozen Package 8 configuration and adds its own binding', () => {
  const priorPackage = JSON.parse(
    git(['show', `${package9Base}:package.json`]),
  ) as { scripts: Record<string, string> };
  const currentPackage = JSON.parse(
    readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'),
  ) as { scripts: Record<string, string> };
  const normalizedPackage = structuredClone(currentPackage);

  for (const script of [
    'test:package9:node',
    'test:package9:d1',
    'test:package9:migration-packaging',
    'verify:package9:binding',
    'verify:package9',
  ]) {
    delete normalizedPackage.scripts[script];
  }
  normalizedPackage.scripts.verify = priorPackage.scripts.verify!;
  assert.deepEqual(normalizedPackage, priorPackage);
  assert.equal(
    currentPackage.scripts['verify:package9:binding'],
    'node --experimental-strip-types --test tests/package9-node/source-evidence.test.ts',
  );
  assert.equal(
    currentPackage.scripts['verify:package9'],
    'npm run verify:package8:core && npm run test:package9:d1 && npm run test:package9:node && npm run verify:review1:disposition && npm run verify:package9:binding',
  );
  assert.equal(currentPackage.scripts.verify, 'npm run verify:package9');
});
