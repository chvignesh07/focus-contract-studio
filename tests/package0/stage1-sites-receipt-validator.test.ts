import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import {
  assertReceiptBundlePathIsOutsideRepository,
  hashSanitizedReceipt,
  validateStage1SitesReceiptBundle,
} from './stage1-sites-receipt-validator.ts';

const sha = 'a'.repeat(40);
const execFileAsync = promisify(execFile);
const evidenceRunId = '1'.repeat(32);
const inventoryObservedAtUtc = '2026-08-30T15:00:00.000Z';
const inventoryReviewedAtUtc = '2026-08-30T15:00:15.000Z';
const createObservedAtUtc = '2026-08-30T15:01:00.000Z';
const createReviewedAtUtc = '2026-08-30T15:01:15.000Z';
const saveObservedAtUtc = '2026-08-30T15:05:00.000Z';
const saveReviewedAtUtc = '2026-08-30T15:05:15.000Z';

type JsonRecord = Record<string, unknown>;

function makeBundle(): JsonRecord {
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
    pagination: {
      pageCount: 1,
      cursorExhausted: true,
    },
    observedAtUtc: inventoryObservedAtUtc,
    comparison: 'CASE_INSENSITIVE_EXACT_TITLE_AND_SLUG',
    matches: {
      title: 0,
      slug: 0,
      combinedUnique: 0,
    },
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
    observedAtUtc: createObservedAtUtc,
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
    observedAtUtc: saveObservedAtUtc,
    pushedCommitFullSha: sha,
    savedVersion: {
      exists: true,
      commitFullSha: sha,
    },
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
  const reviewFor = (
    receiptType: string,
    receipt: JsonRecord,
    reviewedAtUtc: string,
  ) => ({
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
  });
  return {
    schemaVersion: 2,
    status: 'RECEIPT_CONSISTENCY_PASS',
    evidenceRunId,
    executionSurface: 'CHATGPT_DESKTOP',
    receipts: {
      inventory,
      createAndRepository,
      saveOnly,
    },
    reviews: {
      inventory: reviewFor(
        'OWNER_INVENTORY',
        inventory,
        inventoryReviewedAtUtc,
      ),
      createAndRepository: reviewFor(
        'CREATE_AND_SOURCE_REPOSITORY',
        createAndRepository,
        createReviewedAtUtc,
      ),
      saveOnly: reviewFor('SAVE_ONLY', saveOnly, saveReviewedAtUtc),
    },
  };
}

function at(root: JsonRecord, ...path: string[]): JsonRecord {
  let current: unknown = root;
  for (const key of path) {
    assert.ok(
      current !== null && typeof current === 'object' && !Array.isArray(current),
    );
    current = (current as JsonRecord)[key];
  }
  assert.ok(
    current !== null && typeof current === 'object' && !Array.isArray(current),
  );
  return current as JsonRecord;
}

test('sanitized Sites receipts and independent hash-bound reviews earn consistency only', () => {
  const bundle = makeBundle();
  const summary = validateStage1SitesReceiptBundle(bundle);
  assert.equal(summary.status, 'RECEIPT_CONSISTENCY_PASS');
  assert.equal(summary.inventoryMatchCount, 0);
  assert.equal(summary.savedVersionCommitSha, sha);
  assert.match(summary.inventoryReceiptSha256, /^[0-9a-f]{64}$/);
  assert.match(summary.createAndRepositoryReceiptSha256, /^[0-9a-f]{64}$/);
  assert.match(summary.saveOnlyReceiptSha256, /^[0-9a-f]{64}$/);
  assert.match(summary.independentReviewBundleSha256, /^[0-9a-f]{64}$/);
  assert.equal(summary.hostedFactsVerified, false);
  assert.equal(summary.stage1Complete, false);
});

test('owner inventory requires desktop or web, confirmed context, owner auth, limit 50, and cursor exhaustion', () => {
  const cases: Array<[string, (bundle: JsonRecord) => void]> = [
    ['CLI surface', (b) => (at(b, 'receipts', 'inventory').surface = 'CODEX_CLI')],
    ['wrong owner', (b) => (at(b, 'receipts', 'inventory').executionOwner = 'MULTIPLE_OWNERS')],
    ['unconfirmed context', (b) => (at(b, 'receipts', 'inventory').selectedContextConfirmation = 'NOT_CONFIRMED')],
    ['wrong role', (b) => (at(b, 'receipts', 'inventory').requestedRole = 'editor')],
    ['smaller page', (b) => (at(b, 'receipts', 'inventory').requestedLimit = 49)],
    ['invented maximum', (b) => (at(b, 'receipts', 'inventory').maximumSupportedPageSize = 100)],
    ['zero pages', (b) => (at(b, 'receipts', 'inventory', 'pagination').pageCount = 0)],
    ['cursor remains', (b) => (at(b, 'receipts', 'inventory', 'pagination').cursorExhausted = false)],
    ['unauthenticated', (b) => (at(b, 'receipts', 'inventory', 'sanitization').authenticationSucceeded = false)],
    ['title match', (b) => (at(b, 'receipts', 'inventory', 'matches').title = 1)],
    ['slug match', (b) => (at(b, 'receipts', 'inventory', 'matches').slug = 1)],
    ['combined match', (b) => (at(b, 'receipts', 'inventory', 'matches').combinedUnique = 1)],
    ['unrelated names retained', (b) => (at(b, 'receipts', 'inventory', 'sanitization').unrelatedSiteNamesRecorded = true)],
    ['account IDs retained', (b) => (at(b, 'receipts', 'inventory', 'sanitization').accountIdentifiersRecorded = true)],
  ];

  for (const [name, mutate] of cases) {
    const bundle = makeBundle();
    mutate(bundle);
    assert.throws(
      () => validateStage1SitesReceiptBundle(bundle),
      { name: 'Stage1SitesReceiptValidationError' },
      name,
    );
  }
});

test('one evidence run, execution surface, and authenticated owner span the full lifecycle', () => {
  const cases: Array<[string, (bundle: JsonRecord) => void]> = [
    [
      'create run mismatch',
      (b) =>
        (at(b, 'receipts', 'createAndRepository').evidenceRunId =
          '2'.repeat(32)),
    ],
    [
      'save surface mismatch',
      (b) => (at(b, 'receipts', 'saveOnly').surface = 'CHATGPT_WEB'),
    ],
    [
      'create owner mismatch',
      (b) =>
        (at(b, 'receipts', 'createAndRepository').executionOwner =
          'SECOND_OWNER'),
    ],
    [
      'review run mismatch',
      (b) =>
        (at(b, 'reviews', 'inventory').evidenceRunId = '2'.repeat(32)),
    ],
  ];
  for (const [name, mutate] of cases) {
    const bundle = makeBundle();
    mutate(bundle);
    assert.throws(
      () => validateStage1SitesReceiptBundle(bundle),
      { name: 'Stage1SitesReceiptValidationError' },
      name,
    );
  }
});

test('repository association and privacy require the same create response and authoritative evidence', () => {
  const cases: Array<[string, (bundle: JsonRecord) => void]> = [
    ['duplicate create', (b) => (at(b, 'receipts', 'createAndRepository', 'create').attemptCount = 2)],
    ['credential not nested', (b) => (at(b, 'receipts', 'createAndRepository', 'create').credentialNestedInSameResponse = false)],
    ['untrusted association', (b) => (at(b, 'receipts', 'createAndRepository', 'repository').associationEvidence = 'OPERATOR_ASSERTION')],
    ['untrusted privacy source', (b) => (at(b, 'receipts', 'createAndRepository', 'repository').privateVisibilityEvidence = 'OPERATOR_ASSERTION')],
    ['privacy inconclusive', (b) => (at(b, 'receipts', 'createAndRepository', 'repository').privateVisibilityStatus = 'INCONCLUSIVE')],
    ['wrong branch', (b) => (at(b, 'receipts', 'createAndRepository', 'repository').defaultBranch = 'develop')],
  ];
  for (const [name, mutate] of cases) {
    const bundle = makeBundle();
    mutate(bundle);
    assert.throws(
      () => validateStage1SitesReceiptBundle(bundle),
      { name: 'Stage1SitesReceiptValidationError' },
      name,
    );
  }
});

test('every credential exposure path is forbidden', () => {
  const keys = [
    'tokenExposedInUrl',
    'tokenPersistedInGitConfiguration',
    'tokenPersistedInCredentialHelper',
    'tokenWrittenToFile',
    'tokenRecordedInShellHistory',
    'tokenRecordedInEvidence',
    'tokenRecordedInLogs',
    'tokenCommitted',
    'tokenReturnedInUserVisibleOutput',
  ];
  for (const key of keys) {
    const bundle = makeBundle();
    at(
      bundle,
      'receipts',
      'createAndRepository',
      'credentialHandling',
    )[key] = true;
    assert.throws(
      () => validateStage1SitesReceiptBundle(bundle),
      { name: 'Stage1SitesReceiptValidationError' },
      key,
    );
  }
});

test('save-only proof uses observable absence and forbids numerical deployment claims', () => {
  const cases: Array<[string, (bundle: JsonRecord) => void]> = [
    ['no saved version', (b) => (at(b, 'receipts', 'saveOnly', 'savedVersion').exists = false)],
    ['saved SHA mismatch', (b) => (at(b, 'receipts', 'saveOnly', 'savedVersion').commitFullSha = 'b'.repeat(40))],
    ['deployment invoked', (b) => (at(b, 'receipts', 'saveOnly', 'deploymentObservation').deploymentToolInvoked = true)],
    ['deployment ID', (b) => (at(b, 'receipts', 'saveOnly', 'deploymentObservation').deploymentIdProduced = true)],
    ['deployment status', (b) => (at(b, 'receipts', 'saveOnly', 'deploymentObservation').deploymentStatusProduced = true)],
    ['live URL present', (b) => (at(b, 'receipts', 'saveOnly', 'deploymentObservation').currentLiveUrlState = 'PRESENT')],
    ['numeric claim', (b) => (at(b, 'receipts', 'saveOnly', 'deploymentObservation').numericalDeploymentCountClaimed = true)],
  ];
  for (const [name, mutate] of cases) {
    const bundle = makeBundle();
    mutate(bundle);
    assert.throws(
      () => validateStage1SitesReceiptBundle(bundle),
      { name: 'Stage1SitesReceiptValidationError' },
      name,
    );
  }

  const countField = makeBundle();
  at(countField, 'receipts', 'saveOnly', 'deploymentObservation').deploymentCount = 0;
  assert.throws(
    () => validateStage1SitesReceiptBundle(countField),
    { name: 'Stage1SitesReceiptValidationError' },
  );
});

test('independent reviews are bound to exact sanitized receipt hashes', () => {
  const wrongHash = makeBundle();
  at(wrongHash, 'reviews', 'inventory').reviewedReceiptSha256 = 'f'.repeat(64);
  assert.throws(
    () => validateStage1SitesReceiptBundle(wrongHash),
    { name: 'Stage1SitesReceiptValidationError' },
  );

  const ownerReview = makeBundle();
  at(ownerReview, 'reviews', 'saveOnly').reviewerRole = 'EXECUTION_OWNER';
  assert.throws(
    () => validateStage1SitesReceiptBundle(ownerReview),
    { name: 'Stage1SitesReceiptValidationError' },
  );

  const privateReview = makeBundle();
  at(
    privateReview,
    'reviews',
    'createAndRepository',
  ).containsSensitiveOrPrivateValues = true;
  assert.throws(
    () => validateStage1SitesReceiptBundle(privateReview),
    { name: 'Stage1SitesReceiptValidationError' },
  );
});

test('receipt and review timestamps preserve the immediate, ordered observation sequence', () => {
  const staleInventory = makeBundle();
  at(staleInventory, 'receipts', 'inventory').observedAtUtc =
    '2026-08-30T14:49:59.000Z';
  at(staleInventory, 'reviews', 'inventory').reviewedReceiptSha256 =
    hashSanitizedReceipt(at(staleInventory, 'receipts', 'inventory'));
  assert.throws(
    () => validateStage1SitesReceiptBundle(staleInventory),
    { name: 'Stage1SitesReceiptValidationError' },
  );

  const reviewBeforeObservation = makeBundle();
  at(reviewBeforeObservation, 'reviews', 'saveOnly').reviewedAtUtc =
    '2026-08-30T14:59:59.000Z';
  assert.throws(
    () => validateStage1SitesReceiptBundle(reviewBeforeObservation),
    { name: 'Stage1SitesReceiptValidationError' },
  );
});

test('receipt bundle paths must resolve outside the repository', () => {
  assert.throws(
    () =>
      assertReceiptBundlePathIsOutsideRepository(
        '/work/repository/receipts.json',
        '/work/repository',
      ),
    { code: 'RECEIPT_BUNDLE_MUST_BE_OUTSIDE_REPOSITORY' },
  );
  assert.doesNotThrow(() =>
    assertReceiptBundlePathIsOutsideRepository(
      '<TEMP_DIRECTORY>/fcs-stage1/receipts.json',
      '/work/repository',
    ),
  );
});

test('the receipt CLI rejects an in-repository bundle with sanitized output', async () => {
  const modulePath = fileURLToPath(
    new URL('./stage1-sites-receipt-validator.ts', import.meta.url),
  );
  const inRepositoryJson = fileURLToPath(
    new URL('../../package.json', import.meta.url),
  );
  await assert.rejects(
    execFileAsync(
      process.execPath,
      ['--experimental-strip-types', modulePath, inRepositoryJson],
      { cwd: fileURLToPath(new URL('../../', import.meta.url)) },
    ),
    (error: unknown) => {
      assert.ok(error && typeof error === 'object' && 'stderr' in error);
      const stderr = String((error as { stderr: unknown }).stderr);
      assert.equal(
        stderr,
        '{"status":"RECEIPT_CONSISTENCY_FAIL","code":"RECEIPT_BUNDLE_MUST_BE_OUTSIDE_REPOSITORY"}\n',
      );
      assert.doesNotMatch(stderr, /account|credential|token|project_id/i);
      return true;
    },
  );
});
