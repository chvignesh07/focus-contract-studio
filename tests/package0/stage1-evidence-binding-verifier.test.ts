import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { hashSanitizedReceipt } from './stage1-sites-receipt-validator.ts';
import {
  assertBindingEvidencePathIsOutsideRepository,
  verifyStage1EvidenceBinding,
} from './stage1-evidence-binding-verifier.ts';

const execFileAsync = promisify(execFile);
const evidenceRunId = '1'.repeat(32);

type JsonRecord = Record<string, unknown>;

type Timeline = {
  pre: string;
  inventory: string;
  inventoryReview: string;
  create: string;
  createReview: string;
  post: string;
  save: string;
  saveReview: string;
};

const fixedTimeline: Timeline = {
  pre: '2026-08-30T15:00:00.000Z',
  inventory: '2026-08-30T15:01:00.000Z',
  inventoryReview: '2026-08-30T15:01:15.000Z',
  create: '2026-08-30T15:02:00.000Z',
  createReview: '2026-08-30T15:02:15.000Z',
  post: '2026-08-30T15:05:00.000Z',
  save: '2026-08-30T15:06:00.000Z',
  saveReview: '2026-08-30T15:06:15.000Z',
};

async function git(root: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: root });
  return stdout.trim();
}

async function createPostCreateRepository(
  t: test.TestContext,
  includeCliModules = false,
) {
  const root = await mkdtemp(join(tmpdir(), 'fcs-binding-verifier-'));
  t.after(async () => {
    await rm(root, { force: true, recursive: true });
  });
  await mkdir(join(root, '.openai'));
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      scripts: { 'verify:package0': 'node -e "process.exit(0)"' },
    }) + '\n',
  );
  await writeFile(
    join(root, '.openai', 'hosting.json'),
    JSON.stringify({ d1: 'DB', r2: null }) + '\n',
  );
  if (includeCliModules) {
    const moduleDirectory = join(root, 'tests', 'package0');
    const evidenceDirectory = join(root, 'docs', 'evidence');
    await mkdir(moduleDirectory, { recursive: true });
    await mkdir(evidenceDirectory, { recursive: true });
    for (const name of [
      'stage1-evidence-binding-verifier.ts',
      'stage1-evidence-validator.ts',
      'stage1-live-local-verifier.ts',
      'stage1-sites-receipt-validator.ts',
    ]) {
      await copyFile(
        new URL(`./${name}`, import.meta.url),
        join(moduleDirectory, name),
      );
    }
    await copyFile(
      new URL(
        '../../docs/evidence/PACKAGE0_EXTERNAL_RUNBOOK.json',
        import.meta.url,
      ),
      join(evidenceDirectory, 'PACKAGE0_EXTERNAL_RUNBOOK.json'),
    );
  }
  await git(root, 'init', '-b', 'main');
  await git(root, 'config', 'user.name', 'Package 0 Test');
  await git(root, 'config', 'user.email', 'package0-test@example.invalid');
  await git(root, 'add', '.');
  await git(root, 'commit', '-m', 'pre-create');
  const preCreateHead = await git(root, 'rev-parse', 'HEAD');

  await writeFile(
    join(root, '.openai', 'hosting.json'),
    JSON.stringify({
      project_id: 'opaque-test-project-id',
      d1: 'DB',
      r2: null,
    }) + '\n',
  );
  await git(root, 'add', '.openai/hosting.json');
  await git(root, 'commit', '-m', 'persist project id');
  return {
    root,
    preCreateHead,
    postCreateHead: await git(root, 'rev-parse', 'HEAD'),
  };
}

function reviewFor(
  receiptType: string,
  receipt: JsonRecord,
  reviewedAtUtc: string,
): JsonRecord {
  return {
    schemaVersion: 2,
    receiptType: 'INDEPENDENT_REVIEW',
    evidenceRunId,
    reviewedReceiptType: receiptType,
    reviewedReceiptSha256: hashSanitizedReceipt(receipt),
    reviewStatus: 'REVIEWED',
    reviewerRole: 'INDEPENDENT_READ_ONLY_REVIEWER',
    reviewedAtUtc,
    directlyObservedSanitizedReceipt: true,
    hostedActionPerformedByReviewer: false,
    containsSensitiveOrPrivateValues: false,
  };
}

function makeSitesBundle(
  commitSha: string,
  timeline: Timeline = fixedTimeline,
): JsonRecord {
  const inventory = {
    schemaVersion: 2,
    receiptType: 'OWNER_INVENTORY',
    evidenceRunId,
    surface: 'CHATGPT_DESKTOP',
    executionOwner: 'ONE_AUTHENTICATED_CHATGPT_OWNER',
    selectedContextConfirmation:
      'USER_CONFIRMED_IMMEDIATELY_BEFORE_CREATE',
    requestedRole: 'owner',
    requestedLimit: 50,
    maximumSupportedPageSize: 50,
    pagination: { pageCount: 1, cursorExhausted: true },
    observedAtUtc: timeline.inventory,
    comparison: 'CASE_INSENSITIVE_EXACT_TITLE_AND_SLUG',
    matches: { title: 0, slug: 0, combinedUnique: 0 },
    repeatPurpose: 'IMMEDIATE_PRE_CREATE_REPEAT',
    sanitization: {
      authenticationSucceeded: true,
      accountIdentifiersRecorded: false,
      unrelatedSiteNamesRecorded: false,
      siteIdentifiersRecorded: false,
      sensitiveValuesRecorded: false,
    },
  };
  const createAndRepository = {
    schemaVersion: 2,
    receiptType: 'CREATE_AND_SOURCE_REPOSITORY',
    evidenceRunId,
    surface: 'CHATGPT_DESKTOP',
    executionOwner: 'ONE_AUTHENTICATED_CHATGPT_OWNER',
    observedAtUtc: timeline.create,
    create: {
      exactTargetUsed: true,
      attemptCount: 1,
      projectIdReturnedAndPersisted: true,
      credentialNestedInSameResponse: true,
    },
    repository: {
      associationEvidence:
        'SAME_CREATE_RESPONSE_NESTED_SOURCE_REPOSITORY_CREDENTIAL',
      privateVisibilityEvidence: 'AUTHORITATIVE_SITES_OR_PROVIDER',
      privateVisibilityStatus: 'VERIFIED',
      defaultBranch: 'main',
    },
    credentialHandling: {
      handlingBoundary: 'PROTECTED_CONNECTOR_AND_IN_MEMORY_ONLY',
      gitAuthorization: 'PER_COMMAND_HTTP_AUTHORIZATION_HEADER_ONLY',
      tokenExposedInUrl: false,
      tokenPersistedInGitConfiguration: false,
      tokenPersistedInCredentialHelper: false,
      tokenWrittenToFile: false,
      tokenRecordedInShellHistory: false,
      tokenRecordedInEvidence: false,
      tokenRecordedInLogs: false,
      tokenCommitted: false,
      tokenReturnedInUserVisibleOutput: false,
    },
    sanitization: {
      accountIdentifiersRecorded: false,
      projectIdentifiersRecorded: false,
      repositoryIdentifiersRecorded: false,
      credentialValuesRecorded: false,
      sensitiveValuesRecorded: false,
    },
  };
  const saveOnly = {
    schemaVersion: 2,
    receiptType: 'SAVE_ONLY',
    evidenceRunId,
    surface: 'CHATGPT_DESKTOP',
    executionOwner: 'ONE_AUTHENTICATED_CHATGPT_OWNER',
    observedAtUtc: timeline.save,
    pushedCommitFullSha: commitSha,
    savedVersion: { exists: true, commitFullSha: commitSha },
    deploymentObservation: {
      deploymentToolInvoked: false,
      deploymentIdProduced: false,
      deploymentStatusProduced: false,
      currentLiveUrlState: 'ABSENT',
      numericalDeploymentCountClaimed: false,
    },
    sanitization: {
      projectIdentifiersRecorded: false,
      versionIdentifiersRecorded: false,
      urlsRecorded: false,
      sensitiveValuesRecorded: false,
    },
  };
  return {
    schemaVersion: 2,
    status: 'RECEIPT_CONSISTENCY_PASS',
    evidenceRunId,
    executionSurface: 'CHATGPT_DESKTOP',
    receipts: { inventory, createAndRepository, saveOnly },
    reviews: {
      inventory: reviewFor(
        'OWNER_INVENTORY',
        inventory,
        timeline.inventoryReview,
      ),
      createAndRepository: reviewFor(
        'CREATE_AND_SOURCE_REPOSITORY',
        createAndRepository,
        timeline.createReview,
      ),
      saveOnly: reviewFor(
        'SAVE_ONLY',
        saveOnly,
        timeline.saveReview,
      ),
    },
  };
}

function makeLocalReceipt(
  phase: 'POST_CREATE' | 'PRE_CREATE',
  head: string,
  observedAtUtc: string,
): JsonRecord {
  return {
    schemaVersion: 2,
    status: 'LOCAL_VERIFICATION_PASS',
    evidenceRunId,
    phase,
    observedAtUtc,
    observedHead: head,
    branch: 'main',
    workingTreeClean: true,
    remoteCount: 0,
    hostingProjectIdState:
      phase === 'POST_CREATE' ? 'PRESENT_REDACTED' : 'ABSENT',
    package0Verification: {
      command: 'npm run verify:package0',
      result: 'PASS',
    },
    containsSensitiveOrPrivateValues: false,
  };
}

function makeManifest(
  runbook: JsonRecord,
  sitesBundle: JsonRecord,
  preCreateReceipt: JsonRecord,
  postCreateReceipt: JsonRecord,
  head: string,
): JsonRecord {
  const sitesReceipts = sitesBundle.receipts as JsonRecord;
  const stage = (runbook.stages as JsonRecord[])[0];
  const recorded = (ids: unknown) =>
    (ids as string[]).map((id) => ({ id, result: 'RECORDED' }));
  const notObserved = (ids: unknown) =>
    (ids as string[]).map((id) => ({ id, result: 'NOT_OBSERVED' }));
  return {
    schemaVersion: 3,
    status: 'CONSISTENCY_PASS',
    evidenceRunId,
    target: {
      siteName: 'focus-contract-studio-package-0',
      siteSlug: 'focus-contract-studio-package-0',
      branch: 'main',
    },
    checkpoints: {
      preconditions: recorded(stage.preconditions),
      actions: recorded(stage.actions),
      forbiddenActions: notObserved(stage.forbiddenActions),
      requiredEvidence: recorded(stage.requiredEvidence),
      stopAfter: stage.stopAfter,
    },
    evidenceReferences: {
      inventoryReceiptSha256: hashSanitizedReceipt(sitesReceipts.inventory),
      preCreationLocalReceiptSha256:
        hashSanitizedReceipt(preCreateReceipt),
      createAndRepositoryReceiptSha256: hashSanitizedReceipt(
        sitesReceipts.createAndRepository,
      ),
      postCreationLocalReceiptSha256:
        hashSanitizedReceipt(postCreateReceipt),
      saveOnlyReceiptSha256: hashSanitizedReceipt(sitesReceipts.saveOnly),
      independentReviewBundleSha256: hashSanitizedReceipt(
        sitesBundle.reviews,
      ),
    },
    lineage: {
      post_creation_head_full_sha: head,
      reverification_head_full_sha: head,
      private_push_head_full_sha: head,
      package_source_head_full_sha: head,
      saved_version_commit_sha: head,
    },
    declarations: {
      containsSensitiveOrPrivateValues: false,
      numericalDeploymentCountClaimed: false,
    },
  };
}

async function makeEvidence(
  t: test.TestContext,
  savedSha?: string,
  options: { includeCliModules?: boolean; timeline?: Timeline } = {},
) {
  const timeline = options.timeline ?? fixedTimeline;
  const repository = await createPostCreateRepository(
    t,
    options.includeCliModules,
  );
  const runbook = JSON.parse(
    await readFile(
      new URL(
        '../../docs/evidence/PACKAGE0_EXTERNAL_RUNBOOK.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as JsonRecord;
  const preCreateReceipt = makeLocalReceipt(
    'PRE_CREATE',
    repository.preCreateHead,
    timeline.pre,
  );
  const postCreateReceipt = makeLocalReceipt(
    'POST_CREATE',
    repository.postCreateHead,
    timeline.post,
  );
  const sitesBundle = makeSitesBundle(
    savedSha ?? repository.postCreateHead,
    timeline,
  );
  const manifest = makeManifest(
    runbook,
    sitesBundle,
    preCreateReceipt,
    postCreateReceipt,
    repository.postCreateHead,
  );
  return {
    repository,
    runbook,
    manifest,
    sitesBundle,
    preCreateReceipt,
    postCreateReceipt,
  };
}

test('final binding recomputes every reference and binds hosted lineage to the actual checkout', async (t) => {
  const evidence = await makeEvidence(t);
  const result = await verifyStage1EvidenceBinding({
    repositoryRoot: evidence.repository.root,
    runbook: evidence.runbook,
    manifest: evidence.manifest,
    sitesReceiptBundle: evidence.sitesBundle,
    preCreateReceipt: evidence.preCreateReceipt,
    postCreateReceipt: evidence.postCreateReceipt,
    now: new Date('2026-08-30T15:10:00.000Z'),
  });

  assert.deepEqual(result, {
    status: 'EVIDENCE_BOUND',
    evidenceRunId,
    actualHead: evidence.repository.postCreateHead,
    referenceCount: 6,
    allReferencesBound: true,
    hostedFactsVerified: false,
    stage1Complete: false,
  });
});

test('cross-plane SHA disagreement and arbitrary manifest references fail closed', async (t) => {
  const shaMismatch = await makeEvidence(t, 'b'.repeat(40));
  await assert.rejects(
    verifyStage1EvidenceBinding({
      repositoryRoot: shaMismatch.repository.root,
      runbook: shaMismatch.runbook,
      manifest: shaMismatch.manifest,
      sitesReceiptBundle: shaMismatch.sitesBundle,
      preCreateReceipt: shaMismatch.preCreateReceipt,
      postCreateReceipt: shaMismatch.postCreateReceipt,
      now: new Date('2026-08-30T15:10:00.000Z'),
    }),
    { code: 'CROSS_PLANE_SHA_MISMATCH' },
  );

  const hashMismatch = await makeEvidence(t);
  const refs = hashMismatch.manifest.evidenceReferences as JsonRecord;
  refs.saveOnlyReceiptSha256 = 'f'.repeat(64);
  await assert.rejects(
    verifyStage1EvidenceBinding({
      repositoryRoot: hashMismatch.repository.root,
      runbook: hashMismatch.runbook,
      manifest: hashMismatch.manifest,
      sitesReceiptBundle: hashMismatch.sitesBundle,
      preCreateReceipt: hashMismatch.preCreateReceipt,
      postCreateReceipt: hashMismatch.postCreateReceipt,
      now: new Date('2026-08-30T15:10:00.000Z'),
    }),
    { code: 'EVIDENCE_REFERENCE_HASH_MISMATCH' },
  );
});

test('run-ID mismatch and stale replay fail closed', async (t) => {
  const runMismatch = await makeEvidence(t);
  runMismatch.postCreateReceipt.evidenceRunId = '2'.repeat(32);
  await assert.rejects(
    verifyStage1EvidenceBinding({
      repositoryRoot: runMismatch.repository.root,
      runbook: runMismatch.runbook,
      manifest: runMismatch.manifest,
      sitesReceiptBundle: runMismatch.sitesBundle,
      preCreateReceipt: runMismatch.preCreateReceipt,
      postCreateReceipt: runMismatch.postCreateReceipt,
      now: new Date('2026-08-30T15:10:00.000Z'),
    }),
    { code: 'EVIDENCE_RUN_ID_MISMATCH' },
  );

  const stale = await makeEvidence(t);
  await assert.rejects(
    verifyStage1EvidenceBinding({
      repositoryRoot: stale.repository.root,
      runbook: stale.runbook,
      manifest: stale.manifest,
      sitesReceiptBundle: stale.sitesBundle,
      preCreateReceipt: stale.preCreateReceipt,
      postCreateReceipt: stale.postCreateReceipt,
      now: new Date('2026-08-30T16:00:00.000Z'),
    }),
    { code: 'FINAL_BINDING_STALE' },
  );
});

test('final binding inputs and receipt must remain outside the repository', () => {
  assert.throws(
    () =>
      assertBindingEvidencePathIsOutsideRepository(
        '/work/repository/manifest.json',
        '/work/repository',
      ),
    { code: 'BINDING_EVIDENCE_MUST_BE_OUTSIDE_REPOSITORY' },
  );
  assert.doesNotThrow(() =>
    assertBindingEvidencePathIsOutsideRepository(
      '<TEMP_DIRECTORY>/fcs-stage1/manifest.json',
      '/work/repository',
    ),
  );
});

test('receipt, manifest, and final-binding CLIs succeed end to end with exclusive 0600 output', async (t) => {
  const base = Date.now();
  const at = (secondsBefore: number) =>
    new Date(base - secondsBefore * 1000).toISOString();
  const timeline: Timeline = {
    pre: at(480),
    inventory: at(420),
    inventoryReview: at(405),
    create: at(360),
    createReview: at(345),
    post: at(240),
    save: at(180),
    saveReview: at(165),
  };
  const evidence = await makeEvidence(t, undefined, {
    includeCliModules: true,
    timeline,
  });
  const externalDirectory = await mkdtemp(
    join(tmpdir(), 'fcs-binding-cli-evidence-'),
  );
  t.after(async () => {
    await rm(externalDirectory, { force: true, recursive: true });
  });
  const manifestPath = join(externalDirectory, 'manifest.json');
  const sitesPath = join(externalDirectory, 'sites.json');
  const prePath = join(externalDirectory, 'pre.json');
  const postPath = join(externalDirectory, 'post.json');
  const bindingPath = join(externalDirectory, 'binding.json');
  await Promise.all([
    writeFile(manifestPath, JSON.stringify(evidence.manifest) + '\n'),
    writeFile(sitesPath, JSON.stringify(evidence.sitesBundle) + '\n'),
    writeFile(prePath, JSON.stringify(evidence.preCreateReceipt) + '\n'),
    writeFile(postPath, JSON.stringify(evidence.postCreateReceipt) + '\n'),
  ]);

  const moduleDirectory = join(
    evidence.repository.root,
    'tests',
    'package0',
  );
  const sitesCli = await execFileAsync(
    process.execPath,
    [
      '--experimental-strip-types',
      join(moduleDirectory, 'stage1-sites-receipt-validator.ts'),
      sitesPath,
    ],
    { cwd: evidence.repository.root },
  );
  assert.match(sitesCli.stdout, /"status":"RECEIPT_CONSISTENCY_PASS"/);
  assert.equal(sitesCli.stderr, '');

  const manifestCli = await execFileAsync(
    process.execPath,
    [
      '--experimental-strip-types',
      join(moduleDirectory, 'stage1-evidence-validator.ts'),
      manifestPath,
    ],
    { cwd: evidence.repository.root },
  );
  assert.match(manifestCli.stdout, /"status":"CONSISTENCY_PASS"/);
  assert.equal(manifestCli.stderr, '');

  const bindingArgs = [
    '--experimental-strip-types',
    join(moduleDirectory, 'stage1-evidence-binding-verifier.ts'),
    '--manifest',
    manifestPath,
    '--sites-receipts',
    sitesPath,
    '--pre-create-receipt',
    prePath,
    '--post-create-receipt',
    postPath,
    '--receipt',
    bindingPath,
  ];
  const bindingCli = await execFileAsync(process.execPath, bindingArgs, {
    cwd: evidence.repository.root,
  });
  assert.match(bindingCli.stdout, /"status":"EVIDENCE_BOUND"/);
  assert.equal(bindingCli.stderr, '');
  assert.doesNotMatch(
    sitesCli.stdout + manifestCli.stdout + bindingCli.stdout,
    /opaque-test-project-id|credential|project_id/i,
  );
  const bindingReceipt = JSON.parse(
    await readFile(bindingPath, 'utf8'),
  ) as JsonRecord;
  assert.deepEqual(
    {
      status: bindingReceipt.status,
      actualHead: bindingReceipt.actualHead,
      hostedFactsVerified: bindingReceipt.hostedFactsVerified,
      stage1Complete: bindingReceipt.stage1Complete,
      mode: (await stat(bindingPath)).mode & 0o777,
    },
    {
      status: 'EVIDENCE_BOUND',
      actualHead: evidence.repository.postCreateHead,
      hostedFactsVerified: false,
      stage1Complete: false,
      mode: 0o600,
    },
  );

  await assert.rejects(
    execFileAsync(process.execPath, bindingArgs, {
      cwd: evidence.repository.root,
    }),
    (error: unknown) => {
      assert.ok(error && typeof error === 'object' && 'stderr' in error);
      assert.match(
        String((error as { stderr: unknown }).stderr),
        /"code":"BINDING_RECEIPT_ALREADY_EXISTS"/,
      );
      return true;
    },
  );
});
