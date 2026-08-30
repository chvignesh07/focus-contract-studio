import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

type JsonRecord = Record<string, unknown>;

export type Stage1SitesReceiptSummary = {
  status: 'RECEIPT_CONSISTENCY_PASS';
  evidenceRunId: string;
  executionSurface: 'CHATGPT_DESKTOP' | 'CHATGPT_WEB';
  inventoryMatchCount: 0;
  savedVersionCommitSha: string;
  inventoryReceiptSha256: string;
  createAndRepositoryReceiptSha256: string;
  saveOnlyReceiptSha256: string;
  independentReviewBundleSha256: string;
  inventoryObservedAtUtc: string;
  inventoryReviewedAtUtc: string;
  createObservedAtUtc: string;
  createReviewedAtUtc: string;
  saveObservedAtUtc: string;
  saveReviewedAtUtc: string;
  hostedFactsVerified: false;
  stage1Complete: false;
};

export class Stage1SitesReceiptValidationError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'Stage1SitesReceiptValidationError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new Stage1SitesReceiptValidationError(code);
}

function asRecord(value: unknown, code: string): JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(code);
  }
  return value as JsonRecord;
}

function assertExactKeys(
  record: JsonRecord,
  expectedKeys: string[],
  code: string,
): void {
  const actual = Object.keys(record).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail(code);
  }
}

function assertTrue(value: unknown, code: string): void {
  if (value !== true) fail(code);
}

function assertFalse(value: unknown, code: string): void {
  if (value !== false) fail(code);
}

function assertZero(value: unknown, code: string): void {
  if (!Number.isInteger(value) || value !== 0) fail(code);
}

function assertOne(value: unknown, code: string): void {
  if (!Number.isInteger(value) || value !== 1) fail(code);
}

function assertPositiveInteger(value: unknown, code: string): void {
  if (!Number.isInteger(value) || (value as number) < 1) fail(code);
}

function assertFullSha(value: unknown, code: string): asserts value is string {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) {
    fail(code);
  }
}

function assertSha256(value: unknown, code: string): asserts value is string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    fail(code);
  }
}

function assertEvidenceRunId(
  value: unknown,
  code: string,
): asserts value is string {
  if (typeof value !== 'string' || !/^[0-9a-f]{32}$/.test(value)) {
    fail(code);
  }
}

function assertTimestamp(
  value: unknown,
  code: string,
): asserts value is string {
  if (typeof value !== 'string') fail(code);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    fail(code);
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('NON_JSON_RECEIPT_VALUE');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((item) => canonicalJson(item)).join(',') + ']';
  }
  if (typeof value === 'object') {
    const record = value as JsonRecord;
    return (
      '{' +
      Object.keys(record)
        .sort()
        .map(
          (key) =>
            JSON.stringify(key) + ':' + canonicalJson(record[key]),
        )
        .join(',') +
      '}'
    );
  }
  fail('NON_JSON_RECEIPT_VALUE');
}

export function hashSanitizedReceipt(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function assertSurface(
  value: unknown,
  code: string,
): asserts value is 'CHATGPT_DESKTOP' | 'CHATGPT_WEB' {
  if (value !== 'CHATGPT_DESKTOP' && value !== 'CHATGPT_WEB') fail(code);
}

function validateInventory(
  receiptValue: unknown,
  expectedRunId: string,
  expectedSurface: string,
): JsonRecord {
  const receipt = asRecord(receiptValue, 'INVENTORY_RECEIPT_INVALID');
  assertExactKeys(
    receipt,
    [
      'schemaVersion',
      'receiptType',
      'evidenceRunId',
      'surface',
      'executionOwner',
      'selectedContextConfirmation',
      'requestedRole',
      'requestedLimit',
      'maximumSupportedPageSize',
      'pagination',
      'observedAtUtc',
      'comparison',
      'matches',
      'repeatPurpose',
      'sanitization',
    ],
    'INVENTORY_RECEIPT_SCHEMA_NOT_ALLOWLISTED',
  );
  if (receipt.schemaVersion !== 2) fail('INVENTORY_SCHEMA_VERSION_INVALID');
  if (receipt.receiptType !== 'OWNER_INVENTORY') {
    fail('INVENTORY_RECEIPT_TYPE_INVALID');
  }
  assertSurface(receipt.surface, 'INVENTORY_SURFACE_NOT_CHATGPT');
  if (
    receipt.surface !== expectedSurface ||
    receipt.evidenceRunId !== expectedRunId
  ) {
    fail('INVENTORY_RUN_CONTEXT_MISMATCH');
  }
  if (receipt.executionOwner !== 'ONE_AUTHENTICATED_CHATGPT_OWNER') {
    fail('INVENTORY_EXECUTION_OWNER_INVALID');
  }
  if (
    receipt.selectedContextConfirmation !==
    'USER_CONFIRMED_IMMEDIATELY_BEFORE_CREATE'
  ) {
    fail('SELECTED_CONTEXT_NOT_CONFIRMED');
  }
  if (receipt.requestedRole !== 'owner') fail('INVENTORY_ROLE_NOT_OWNER');
  if (
    receipt.requestedLimit !== 50 ||
    receipt.maximumSupportedPageSize !== 50
  ) {
    fail('INVENTORY_PAGE_SIZE_NOT_MAXIMUM_SUPPORTED');
  }
  assertTimestamp(receipt.observedAtUtc, 'INVENTORY_TIMESTAMP_INVALID');
  if (receipt.comparison !== 'CASE_INSENSITIVE_EXACT_TITLE_AND_SLUG') {
    fail('INVENTORY_COMPARISON_INVALID');
  }
  if (receipt.repeatPurpose !== 'IMMEDIATE_PRE_CREATE_REPEAT') {
    fail('INVENTORY_NOT_IMMEDIATE_PRE_CREATE_REPEAT');
  }

  const pagination = asRecord(
    receipt.pagination,
    'INVENTORY_PAGINATION_INVALID',
  );
  assertExactKeys(
    pagination,
    ['pageCount', 'cursorExhausted'],
    'INVENTORY_PAGINATION_SCHEMA_NOT_ALLOWLISTED',
  );
  assertPositiveInteger(pagination.pageCount, 'INVENTORY_PAGE_COUNT_INVALID');
  assertTrue(pagination.cursorExhausted, 'INVENTORY_CURSOR_NOT_EXHAUSTED');

  const matches = asRecord(receipt.matches, 'INVENTORY_MATCHES_INVALID');
  assertExactKeys(
    matches,
    ['title', 'slug', 'combinedUnique'],
    'INVENTORY_MATCH_SCHEMA_NOT_ALLOWLISTED',
  );
  assertZero(matches.title, 'INVENTORY_TITLE_MATCH_EXISTS');
  assertZero(matches.slug, 'INVENTORY_SLUG_MATCH_EXISTS');
  assertZero(matches.combinedUnique, 'INVENTORY_MATCH_EXISTS');

  const sanitization = asRecord(
    receipt.sanitization,
    'INVENTORY_SANITIZATION_INVALID',
  );
  assertExactKeys(
    sanitization,
    [
      'authenticationSucceeded',
      'accountIdentifiersRecorded',
      'unrelatedSiteNamesRecorded',
      'siteIdentifiersRecorded',
      'sensitiveValuesRecorded',
    ],
    'INVENTORY_SANITIZATION_SCHEMA_NOT_ALLOWLISTED',
  );
  assertTrue(
    sanitization.authenticationSucceeded,
    'INVENTORY_AUTHENTICATION_NOT_VERIFIED',
  );
  assertFalse(
    sanitization.accountIdentifiersRecorded,
    'ACCOUNT_IDENTIFIER_RECORDED',
  );
  assertFalse(
    sanitization.unrelatedSiteNamesRecorded,
    'UNRELATED_SITE_NAME_RECORDED',
  );
  assertFalse(
    sanitization.siteIdentifiersRecorded,
    'SITE_IDENTIFIER_RECORDED',
  );
  assertFalse(
    sanitization.sensitiveValuesRecorded,
    'SENSITIVE_VALUE_RECORDED',
  );
  return receipt;
}

function validateCreateAndRepository(
  receiptValue: unknown,
  expectedRunId: string,
  expectedSurface: string,
): JsonRecord {
  const receipt = asRecord(
    receiptValue,
    'CREATE_REPOSITORY_RECEIPT_INVALID',
  );
  assertExactKeys(
    receipt,
    [
      'schemaVersion',
      'receiptType',
      'evidenceRunId',
      'surface',
      'executionOwner',
      'observedAtUtc',
      'create',
      'repository',
      'credentialHandling',
      'sanitization',
    ],
    'CREATE_REPOSITORY_RECEIPT_SCHEMA_NOT_ALLOWLISTED',
  );
  if (receipt.schemaVersion !== 2) {
    fail('CREATE_REPOSITORY_SCHEMA_VERSION_INVALID');
  }
  if (receipt.receiptType !== 'CREATE_AND_SOURCE_REPOSITORY') {
    fail('CREATE_REPOSITORY_RECEIPT_TYPE_INVALID');
  }
  assertSurface(receipt.surface, 'CREATE_REPOSITORY_SURFACE_NOT_CHATGPT');
  if (
    receipt.surface !== expectedSurface ||
    receipt.evidenceRunId !== expectedRunId
  ) {
    fail('CREATE_REPOSITORY_RUN_CONTEXT_MISMATCH');
  }
  if (receipt.executionOwner !== 'ONE_AUTHENTICATED_CHATGPT_OWNER') {
    fail('CREATE_REPOSITORY_EXECUTION_OWNER_INVALID');
  }
  assertTimestamp(receipt.observedAtUtc, 'CREATE_REPOSITORY_TIMESTAMP_INVALID');

  const create = asRecord(receipt.create, 'CREATE_OBSERVATION_INVALID');
  assertExactKeys(
    create,
    [
      'exactTargetUsed',
      'attemptCount',
      'projectIdReturnedAndPersisted',
      'credentialNestedInSameResponse',
    ],
    'CREATE_OBSERVATION_SCHEMA_NOT_ALLOWLISTED',
  );
  assertTrue(create.exactTargetUsed, 'CREATE_TARGET_NOT_EXACT');
  assertOne(create.attemptCount, 'CREATE_ATTEMPT_COUNT_INVALID');
  assertTrue(
    create.projectIdReturnedAndPersisted,
    'PROJECT_ID_NOT_RETURNED_AND_PERSISTED',
  );
  assertTrue(
    create.credentialNestedInSameResponse,
    'SOURCE_CREDENTIAL_NOT_NESTED_IN_CREATE_RESPONSE',
  );

  const repository = asRecord(
    receipt.repository,
    'REPOSITORY_OBSERVATION_INVALID',
  );
  assertExactKeys(
    repository,
    [
      'associationEvidence',
      'privateVisibilityEvidence',
      'privateVisibilityStatus',
      'defaultBranch',
    ],
    'REPOSITORY_OBSERVATION_SCHEMA_NOT_ALLOWLISTED',
  );
  if (
    repository.associationEvidence !==
    'SAME_CREATE_RESPONSE_NESTED_SOURCE_REPOSITORY_CREDENTIAL'
  ) {
    fail('REPOSITORY_ASSOCIATION_NOT_FROM_CREATE_RESPONSE');
  }
  if (
    repository.privateVisibilityEvidence !==
    'AUTHORITATIVE_SITES_OR_PROVIDER'
  ) {
    fail('REPOSITORY_PRIVACY_EVIDENCE_NOT_AUTHORITATIVE');
  }
  if (repository.privateVisibilityStatus !== 'VERIFIED') {
    fail('REPOSITORY_PRIVACY_INCONCLUSIVE');
  }
  if (repository.defaultBranch !== 'main') {
    fail('REPOSITORY_BRANCH_NOT_MAIN');
  }

  const credentialHandling = asRecord(
    receipt.credentialHandling,
    'CREDENTIAL_HANDLING_INVALID',
  );
  const exposureKeys = [
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
  assertExactKeys(
    credentialHandling,
    ['handlingBoundary', 'gitAuthorization', ...exposureKeys],
    'CREDENTIAL_HANDLING_SCHEMA_NOT_ALLOWLISTED',
  );
  if (
    credentialHandling.handlingBoundary !==
    'PROTECTED_CONNECTOR_AND_IN_MEMORY_ONLY'
  ) {
    fail('CREDENTIAL_HANDLING_BOUNDARY_INVALID');
  }
  if (
    credentialHandling.gitAuthorization !==
    'PER_COMMAND_HTTP_AUTHORIZATION_HEADER_ONLY'
  ) {
    fail('GIT_AUTHORIZATION_MODE_INVALID');
  }
  for (const key of exposureKeys) {
    assertFalse(credentialHandling[key], 'CREDENTIAL_EXPOSURE_DETECTED');
  }

  const sanitization = asRecord(
    receipt.sanitization,
    'CREATE_REPOSITORY_SANITIZATION_INVALID',
  );
  assertExactKeys(
    sanitization,
    [
      'accountIdentifiersRecorded',
      'projectIdentifiersRecorded',
      'repositoryIdentifiersRecorded',
      'credentialValuesRecorded',
      'sensitiveValuesRecorded',
    ],
    'CREATE_REPOSITORY_SANITIZATION_SCHEMA_NOT_ALLOWLISTED',
  );
  for (const value of Object.values(sanitization)) {
    assertFalse(value, 'CREATE_REPOSITORY_PRIVATE_VALUE_RECORDED');
  }
  return receipt;
}

function validateSaveOnly(
  receiptValue: unknown,
  expectedRunId: string,
  expectedSurface: string,
): {
  receipt: JsonRecord;
  commitSha: string;
} {
  const receipt = asRecord(receiptValue, 'SAVE_ONLY_RECEIPT_INVALID');
  assertExactKeys(
    receipt,
    [
      'schemaVersion',
      'receiptType',
      'evidenceRunId',
      'surface',
      'executionOwner',
      'observedAtUtc',
      'pushedCommitFullSha',
      'savedVersion',
      'deploymentObservation',
      'sanitization',
    ],
    'SAVE_ONLY_RECEIPT_SCHEMA_NOT_ALLOWLISTED',
  );
  if (receipt.schemaVersion !== 2) fail('SAVE_ONLY_SCHEMA_VERSION_INVALID');
  if (receipt.receiptType !== 'SAVE_ONLY') {
    fail('SAVE_ONLY_RECEIPT_TYPE_INVALID');
  }
  assertSurface(receipt.surface, 'SAVE_ONLY_SURFACE_NOT_CHATGPT');
  if (
    receipt.surface !== expectedSurface ||
    receipt.evidenceRunId !== expectedRunId
  ) {
    fail('SAVE_ONLY_RUN_CONTEXT_MISMATCH');
  }
  if (receipt.executionOwner !== 'ONE_AUTHENTICATED_CHATGPT_OWNER') {
    fail('SAVE_ONLY_EXECUTION_OWNER_INVALID');
  }
  assertTimestamp(receipt.observedAtUtc, 'SAVE_ONLY_TIMESTAMP_INVALID');
  assertFullSha(receipt.pushedCommitFullSha, 'PUSHED_COMMIT_SHA_INVALID');

  const savedVersion = asRecord(
    receipt.savedVersion,
    'SAVED_VERSION_INVALID',
  );
  assertExactKeys(
    savedVersion,
    ['exists', 'commitFullSha'],
    'SAVED_VERSION_SCHEMA_NOT_ALLOWLISTED',
  );
  assertTrue(savedVersion.exists, 'SAVED_VERSION_NOT_OBSERVED');
  assertFullSha(savedVersion.commitFullSha, 'SAVED_VERSION_SHA_INVALID');
  if (savedVersion.commitFullSha !== receipt.pushedCommitFullSha) {
    fail('SAVED_VERSION_SHA_MISMATCH');
  }

  const deployment = asRecord(
    receipt.deploymentObservation,
    'DEPLOYMENT_OBSERVATION_INVALID',
  );
  assertExactKeys(
    deployment,
    [
      'deploymentToolInvoked',
      'deploymentIdProduced',
      'deploymentStatusProduced',
      'currentLiveUrlState',
      'numericalDeploymentCountClaimed',
    ],
    'DEPLOYMENT_OBSERVATION_SCHEMA_NOT_ALLOWLISTED',
  );
  assertFalse(
    deployment.deploymentToolInvoked,
    'DEPLOYMENT_TOOL_WAS_INVOKED',
  );
  assertFalse(
    deployment.deploymentIdProduced,
    'DEPLOYMENT_ID_WAS_PRODUCED',
  );
  assertFalse(
    deployment.deploymentStatusProduced,
    'DEPLOYMENT_STATUS_WAS_PRODUCED',
  );
  if (deployment.currentLiveUrlState !== 'ABSENT') {
    fail('CURRENT_LIVE_URL_NOT_ABSENT');
  }
  assertFalse(
    deployment.numericalDeploymentCountClaimed,
    'UNSUPPORTED_NUMERICAL_DEPLOYMENT_COUNT_CLAIMED',
  );

  const sanitization = asRecord(
    receipt.sanitization,
    'SAVE_ONLY_SANITIZATION_INVALID',
  );
  assertExactKeys(
    sanitization,
    [
      'projectIdentifiersRecorded',
      'versionIdentifiersRecorded',
      'urlsRecorded',
      'sensitiveValuesRecorded',
    ],
    'SAVE_ONLY_SANITIZATION_SCHEMA_NOT_ALLOWLISTED',
  );
  for (const value of Object.values(sanitization)) {
    assertFalse(value, 'SAVE_ONLY_PRIVATE_VALUE_RECORDED');
  }
  return {
    receipt,
    commitSha: savedVersion.commitFullSha,
  };
}

function validateReview(
  reviewValue: unknown,
  expectedReceiptType: string,
  receipt: JsonRecord,
  expectedRunId: string,
): JsonRecord {
  const review = asRecord(reviewValue, 'INDEPENDENT_REVIEW_INVALID');
  assertExactKeys(
    review,
    [
      'schemaVersion',
      'receiptType',
      'evidenceRunId',
      'reviewedReceiptType',
      'reviewedReceiptSha256',
      'reviewStatus',
      'reviewerRole',
      'reviewedAtUtc',
      'directlyObservedSanitizedReceipt',
      'hostedActionPerformedByReviewer',
      'containsSensitiveOrPrivateValues',
    ],
    'INDEPENDENT_REVIEW_SCHEMA_NOT_ALLOWLISTED',
  );
  if (
    review.schemaVersion !== 2 ||
    review.receiptType !== 'INDEPENDENT_REVIEW' ||
    review.reviewedReceiptType !== expectedReceiptType ||
    review.evidenceRunId !== expectedRunId
  ) {
    fail('INDEPENDENT_REVIEW_IDENTITY_INVALID');
  }
  assertSha256(
    review.reviewedReceiptSha256,
    'INDEPENDENT_REVIEW_SHA256_INVALID',
  );
  if (review.reviewedReceiptSha256 !== hashSanitizedReceipt(receipt)) {
    fail('INDEPENDENT_REVIEW_RECEIPT_HASH_MISMATCH');
  }
  if (review.reviewStatus !== 'REVIEWED') {
    fail('INDEPENDENT_REVIEW_STATUS_INVALID');
  }
  if (review.reviewerRole !== 'INDEPENDENT_READ_ONLY_REVIEWER') {
    fail('INDEPENDENT_REVIEWER_NOT_SEPARATE');
  }
  assertTimestamp(review.reviewedAtUtc, 'INDEPENDENT_REVIEW_TIMESTAMP_INVALID');
  assertTimestamp(
    receipt.observedAtUtc,
    'REVIEWED_RECEIPT_TIMESTAMP_INVALID',
  );
  if (
    Date.parse(review.reviewedAtUtc) < Date.parse(receipt.observedAtUtc)
  ) {
    fail('INDEPENDENT_REVIEW_PRECEDES_OBSERVATION');
  }
  assertTrue(
    review.directlyObservedSanitizedReceipt,
    'SANITIZED_RECEIPT_NOT_DIRECTLY_REVIEWED',
  );
  assertFalse(
    review.hostedActionPerformedByReviewer,
    'REVIEWER_PERFORMED_HOSTED_ACTION',
  );
  assertFalse(
    review.containsSensitiveOrPrivateValues,
    'INDEPENDENT_REVIEW_CONTAINS_PRIVATE_VALUE',
  );
  return review;
}

export function validateStage1SitesReceiptBundle(
  bundleValue: unknown,
): Stage1SitesReceiptSummary {
  const bundle = asRecord(bundleValue, 'RECEIPT_BUNDLE_INVALID');
  assertExactKeys(
    bundle,
    [
      'schemaVersion',
      'status',
      'evidenceRunId',
      'executionSurface',
      'receipts',
      'reviews',
    ],
    'RECEIPT_BUNDLE_SCHEMA_NOT_ALLOWLISTED',
  );
  if (bundle.schemaVersion !== 2) fail('RECEIPT_BUNDLE_VERSION_INVALID');
  if (bundle.status !== 'RECEIPT_CONSISTENCY_PASS') {
    fail('RECEIPT_BUNDLE_STATUS_INVALID');
  }
  assertEvidenceRunId(bundle.evidenceRunId, 'EVIDENCE_RUN_ID_INVALID');
  assertSurface(bundle.executionSurface, 'EXECUTION_SURFACE_NOT_CHATGPT');
  const evidenceRunId = bundle.evidenceRunId;
  const executionSurface = bundle.executionSurface;
  const receipts = asRecord(bundle.receipts, 'RECEIPTS_INVALID');
  const reviews = asRecord(bundle.reviews, 'REVIEWS_INVALID');
  const keys = ['inventory', 'createAndRepository', 'saveOnly'];
  assertExactKeys(receipts, keys, 'RECEIPTS_SCHEMA_NOT_ALLOWLISTED');
  assertExactKeys(reviews, keys, 'REVIEWS_SCHEMA_NOT_ALLOWLISTED');

  const inventory = validateInventory(
    receipts.inventory,
    evidenceRunId,
    executionSurface,
  );
  const createAndRepository = validateCreateAndRepository(
    receipts.createAndRepository,
    evidenceRunId,
    executionSurface,
  );
  const saveOnly = validateSaveOnly(
    receipts.saveOnly,
    evidenceRunId,
    executionSurface,
  );
  const inventoryObservedAt = Date.parse(
    inventory.observedAtUtc as string,
  );
  const createObservedAt = Date.parse(
    createAndRepository.observedAtUtc as string,
  );
  const saveObservedAt = Date.parse(
    saveOnly.receipt.observedAtUtc as string,
  );
  if (
    createObservedAt < inventoryObservedAt ||
    createObservedAt - inventoryObservedAt > 300_000
  ) {
    fail('INVENTORY_NOT_IMMEDIATELY_BEFORE_CREATE');
  }
  if (saveObservedAt < createObservedAt) {
    fail('SAVE_OBSERVATION_PRECEDES_CREATE');
  }
  const inventoryReview = validateReview(
    reviews.inventory,
    'OWNER_INVENTORY',
    inventory,
    evidenceRunId,
  );
  const createReview = validateReview(
    reviews.createAndRepository,
    'CREATE_AND_SOURCE_REPOSITORY',
    createAndRepository,
    evidenceRunId,
  );
  const saveReview = validateReview(
    reviews.saveOnly,
    'SAVE_ONLY',
    saveOnly.receipt,
    evidenceRunId,
  );
  const inventoryReviewedAt = Date.parse(
    inventoryReview.reviewedAtUtc as string,
  );
  const createReviewedAt = Date.parse(createReview.reviewedAtUtc as string);
  const saveReviewedAt = Date.parse(saveReview.reviewedAtUtc as string);
  if (inventoryReviewedAt > createObservedAt) {
    fail('INVENTORY_REVIEW_NOT_BEFORE_CREATE');
  }
  if (
    createReviewedAt < createObservedAt ||
    createReviewedAt > saveObservedAt
  ) {
    fail('CREATE_REPOSITORY_REVIEW_OUT_OF_SEQUENCE');
  }
  if (saveReviewedAt < saveObservedAt) {
    fail('SAVE_REVIEW_PRECEDES_SAVE');
  }

  return {
    status: 'RECEIPT_CONSISTENCY_PASS',
    evidenceRunId,
    executionSurface: executionSurface as
      | 'CHATGPT_DESKTOP'
      | 'CHATGPT_WEB',
    inventoryMatchCount: 0,
    savedVersionCommitSha: saveOnly.commitSha,
    inventoryReceiptSha256: hashSanitizedReceipt(inventory),
    createAndRepositoryReceiptSha256:
      hashSanitizedReceipt(createAndRepository),
    saveOnlyReceiptSha256: hashSanitizedReceipt(saveOnly.receipt),
    independentReviewBundleSha256: hashSanitizedReceipt(reviews),
    inventoryObservedAtUtc: inventory.observedAtUtc as string,
    inventoryReviewedAtUtc: inventoryReview.reviewedAtUtc as string,
    createObservedAtUtc: createAndRepository.observedAtUtc as string,
    createReviewedAtUtc: createReview.reviewedAtUtc as string,
    saveObservedAtUtc: saveOnly.receipt.observedAtUtc as string,
    saveReviewedAtUtc: saveReview.reviewedAtUtc as string,
    hostedFactsVerified: false,
    stage1Complete: false,
  };
}

export function assertReceiptBundlePathIsOutsideRepository(
  bundlePath: string,
  repositoryRoot: string,
): void {
  const resolvedBundle = resolve(bundlePath);
  const resolvedRepository = resolve(repositoryRoot);
  const pathFromRepository = relative(resolvedRepository, resolvedBundle);
  if (
    pathFromRepository === '' ||
    (pathFromRepository !== '..' &&
      !pathFromRepository.startsWith('..' + sep))
  ) {
    fail('RECEIPT_BUNDLE_MUST_BE_OUTSIDE_REPOSITORY');
  }
}

async function runCli(): Promise<void> {
  try {
    const bundleArgument = process.argv[2];
    if (
      typeof bundleArgument !== 'string' ||
      process.argv.length !== 3 ||
      !isAbsolute(bundleArgument)
    ) {
      fail('ABSOLUTE_RECEIPT_BUNDLE_PATH_REQUIRED');
    }
    const repositoryRoot = await realpath(
      fileURLToPath(new URL('../../', import.meta.url)),
    );
    const bundlePath = await realpath(bundleArgument);
    assertReceiptBundlePathIsOutsideRepository(bundlePath, repositoryRoot);
    const summary = validateStage1SitesReceiptBundle(
      JSON.parse(await readFile(bundlePath, 'utf8')),
    );
    process.stdout.write(JSON.stringify(summary) + '\n');
  } catch (error) {
    const code =
      error instanceof Stage1SitesReceiptValidationError
        ? error.code
        : 'RECEIPT_BUNDLE_READ_OR_PARSE_FAILED';
    process.stderr.write(
      JSON.stringify({ status: 'RECEIPT_CONSISTENCY_FAIL', code }) + '\n',
    );
    process.exitCode = 1;
  }
}

const modulePath = fileURLToPath(import.meta.url);
if (
  process.argv[1] &&
  realpathSync(resolve(process.argv[1])) === realpathSync(modulePath)
) {
  void runCli();
}
