import { readFile, realpath } from 'node:fs/promises';
import {
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';

type CheckpointResult = {
  id: string;
  result: 'NOT_RUN' | 'PASS';
};

export type Stage1EvidenceManifest = {
  schemaVersion: number;
  status: string;
  target: {
    siteName: string;
    siteSlug: string;
    branch: string;
  };
  checkpoints: {
    preconditions: CheckpointResult[];
    actions: CheckpointResult[];
    forbiddenActions: CheckpointResult[];
    requiredEvidence: CheckpointResult[];
    stopAfter: string;
  };
  observations: {
    inventoryBeforeCreate: {
      completed: boolean;
      unambiguous: boolean;
      comparison: string;
      caseInsensitiveTitleMatchCount: number;
      caseInsensitiveSlugMatchCount: number;
      combinedUniqueMatchCount: number;
    };
    custodyBeforeCreate: {
      approvedHeadFullSha: string;
      branch: string;
      workingTreeClean: boolean;
      package0GatePassed: boolean;
      cleanCheckoutPassed: boolean;
      gitRemoteCount: number;
      hostingProjectIdPresent: boolean;
      siteAlreadyCreatedForCheckout: boolean;
    };
    createOperation: {
      attemptCount: number;
      exactTargetUsed: boolean;
      projectIdReturned: boolean;
      projectIdPersisted: boolean;
      persistedProjectIdMatchesCreateResponse: boolean;
    };
    repositoryBeforePush: {
      returnedBySameCreateOperation: boolean;
      sitesManagedRepositoryVerified: boolean;
      privateVisibilityVerified: boolean;
      projectAssociationVerified: boolean;
      defaultBranch: string;
      pushOccurredOnlyAfterVerification: boolean;
      persistedGitRemoteCount: number;
      sourceCredentialRecorded: boolean;
    };
    postCreation: {
      workingTreeClean: boolean;
      package0GatePassed: boolean;
      cleanCheckoutPassed: boolean;
    };
    lineage: Record<string, string>;
    deployment: {
      count: number;
    };
    sensitiveOrPrivateValuesRecorded: boolean;
  };
};

export type Stage1EvidenceSummary = {
  status: 'PASS';
  siteName: string;
  siteSlug: string;
  branch: string;
  inventoryMatchCount: 0;
  deploymentCount: 0;
  sourceSha: string;
};

export class Stage1EvidenceValidationError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'Stage1EvidenceValidationError';
    this.code = code;
  }
}

type JsonRecord = Record<string, unknown>;

function fail(code: string): never {
  throw new Stage1EvidenceValidationError(code);
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

function assertFullSha(value: unknown, code: string): asserts value is string {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) {
    fail(code);
  }
}

function asStringArray(value: unknown, code: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    fail(code);
  }
  return value as string[];
}

function assertCheckpointResults(
  value: unknown,
  expectedIds: string[],
  expectedResult: 'NOT_RUN' | 'PASS',
  code: string,
): void {
  if (!Array.isArray(value) || value.length !== expectedIds.length) fail(code);
  for (let index = 0; index < expectedIds.length; index += 1) {
    const checkpoint = asRecord(value[index], code);
    assertExactKeys(checkpoint, ['id', 'result'], code);
    if (
      checkpoint.id !== expectedIds[index] ||
      checkpoint.result !== expectedResult
    ) {
      fail(code);
    }
  }
}

export function assertEvidenceManifestPathIsOutsideRepository(
  manifestPath: string,
  repositoryRoot: string,
): void {
  const resolvedManifest = resolve(manifestPath);
  const resolvedRepository = resolve(repositoryRoot);
  const pathFromRepository = relative(resolvedRepository, resolvedManifest);
  if (
    pathFromRepository === '' ||
    (pathFromRepository !== '..' &&
      !pathFromRepository.startsWith(`..${sep}`))
  ) {
    fail('EVIDENCE_MANIFEST_MUST_BE_OUTSIDE_REPOSITORY');
  }
}

export function validateStage1EvidenceManifest(
  runbookValue: unknown,
  manifestValue: unknown,
): Stage1EvidenceSummary {
  const runbook = asRecord(runbookValue, 'RUNBOOK_INVALID');
  const contract = asRecord(runbook.stage1Contract, 'RUNBOOK_CONTRACT_MISSING');
  const targetContract = asRecord(contract.target, 'RUNBOOK_TARGET_MISSING');
  const validatorContract = asRecord(
    contract.evidenceValidator,
    'RUNBOOK_VALIDATOR_MISSING',
  );
  const evidenceAssertions = asRecord(
    contract.evidenceAssertions,
    'RUNBOOK_ASSERTIONS_MISSING',
  );
  const fullShaEquality = asRecord(
    evidenceAssertions.fullShaEquality,
    'RUNBOOK_SHA_ASSERTION_MISSING',
  );
  const deploymentAssertion = asRecord(
    evidenceAssertions.deploymentCount,
    'RUNBOOK_DEPLOYMENT_ASSERTION_MISSING',
  );
  const stages = runbook.stages;
  if (!Array.isArray(stages) || stages.length === 0) {
    fail('RUNBOOK_STAGE_1_MISSING');
  }
  const stage = asRecord(stages[0], 'RUNBOOK_STAGE_1_INVALID');
  if (stage.id !== 'stage-1-create-push-package-save-only') {
    fail('RUNBOOK_STAGE_1_INVALID');
  }

  const manifest = asRecord(manifestValue, 'MANIFEST_INVALID');
  assertExactKeys(
    manifest,
    ['schemaVersion', 'status', 'target', 'checkpoints', 'observations'],
    'MANIFEST_SCHEMA_NOT_ALLOWLISTED',
  );
  if (manifest.schemaVersion !== 1) fail('MANIFEST_SCHEMA_VERSION_INVALID');
  if (
    validatorContract.requiredResult !== 'PASS' ||
    manifest.status !== validatorContract.requiredResult
  ) {
    fail('MANIFEST_STATUS_NOT_PASS');
  }

  const target = asRecord(manifest.target, 'TARGET_INVALID');
  assertExactKeys(
    target,
    ['siteName', 'siteSlug', 'branch'],
    'TARGET_SCHEMA_NOT_ALLOWLISTED',
  );
  if (
    target.siteName !== targetContract.siteName ||
    target.siteSlug !== targetContract.siteSlug ||
    target.branch !== targetContract.branch
  ) {
    fail('TARGET_MISMATCH');
  }

  const checkpoints = asRecord(manifest.checkpoints, 'CHECKPOINTS_INVALID');
  assertExactKeys(
    checkpoints,
    [
      'preconditions',
      'actions',
      'forbiddenActions',
      'requiredEvidence',
      'stopAfter',
    ],
    'CHECKPOINT_SCHEMA_NOT_ALLOWLISTED',
  );
  assertCheckpointResults(
    checkpoints.preconditions,
    asStringArray(stage.preconditions, 'RUNBOOK_PRECONDITIONS_INVALID'),
    'PASS',
    'PRECONDITIONS_INCOMPLETE_OR_OUT_OF_ORDER',
  );
  assertCheckpointResults(
    checkpoints.actions,
    asStringArray(stage.actions, 'RUNBOOK_ACTIONS_INVALID'),
    'PASS',
    'ACTIONS_INCOMPLETE_OR_OUT_OF_ORDER',
  );
  assertCheckpointResults(
    checkpoints.forbiddenActions,
    asStringArray(stage.forbiddenActions, 'RUNBOOK_FORBIDDEN_ACTIONS_INVALID'),
    'NOT_RUN',
    'FORBIDDEN_ACTION_RECORDED',
  );
  assertCheckpointResults(
    checkpoints.requiredEvidence,
    asStringArray(stage.requiredEvidence, 'RUNBOOK_EVIDENCE_INVALID'),
    'PASS',
    'REQUIRED_EVIDENCE_INCOMPLETE_OR_OUT_OF_ORDER',
  );
  if (
    typeof stage.stopAfter !== 'string' ||
    checkpoints.stopAfter !== stage.stopAfter
  ) {
    fail('STOP_AFTER_MISMATCH');
  }

  const observations = asRecord(manifest.observations, 'OBSERVATIONS_INVALID');
  assertExactKeys(
    observations,
    [
      'inventoryBeforeCreate',
      'custodyBeforeCreate',
      'createOperation',
      'repositoryBeforePush',
      'postCreation',
      'lineage',
      'deployment',
      'sensitiveOrPrivateValuesRecorded',
    ],
    'OBSERVATION_SCHEMA_NOT_ALLOWLISTED',
  );

  const inventory = asRecord(
    observations.inventoryBeforeCreate,
    'INVENTORY_INVALID',
  );
  assertExactKeys(
    inventory,
    [
      'completed',
      'unambiguous',
      'comparison',
      'caseInsensitiveTitleMatchCount',
      'caseInsensitiveSlugMatchCount',
      'combinedUniqueMatchCount',
    ],
    'INVENTORY_SCHEMA_NOT_ALLOWLISTED',
  );
  assertTrue(inventory.completed, 'INVENTORY_INCOMPLETE');
  assertTrue(inventory.unambiguous, 'INVENTORY_AMBIGUOUS');
  if (inventory.comparison !== 'case_insensitive_exact_match') {
    fail('INVENTORY_COMPARISON_INVALID');
  }
  assertZero(
    inventory.caseInsensitiveTitleMatchCount,
    'SITE_TITLE_MATCH_EXISTS',
  );
  assertZero(inventory.caseInsensitiveSlugMatchCount, 'SITE_SLUG_MATCH_EXISTS');
  assertZero(inventory.combinedUniqueMatchCount, 'SITE_MATCH_EXISTS');

  const custody = asRecord(
    observations.custodyBeforeCreate,
    'CUSTODY_INVALID',
  );
  assertExactKeys(
    custody,
    [
      'approvedHeadFullSha',
      'branch',
      'workingTreeClean',
      'package0GatePassed',
      'cleanCheckoutPassed',
      'gitRemoteCount',
      'hostingProjectIdPresent',
      'siteAlreadyCreatedForCheckout',
    ],
    'CUSTODY_SCHEMA_NOT_ALLOWLISTED',
  );
  assertFullSha(custody.approvedHeadFullSha, 'APPROVED_HEAD_INVALID');
  if (custody.branch !== targetContract.branch) fail('BRANCH_NOT_MAIN');
  assertTrue(custody.workingTreeClean, 'WORKING_TREE_DIRTY');
  assertTrue(custody.package0GatePassed, 'PACKAGE0_GATE_NOT_PASSED');
  assertTrue(custody.cleanCheckoutPassed, 'CLEAN_CHECKOUT_NOT_PASSED');
  assertZero(custody.gitRemoteCount, 'PREEXISTING_GIT_REMOTE');
  assertFalse(custody.hostingProjectIdPresent, 'PREEXISTING_PROJECT_ID');
  assertFalse(
    custody.siteAlreadyCreatedForCheckout,
    'SITE_ALREADY_CREATED_FOR_CHECKOUT',
  );

  const createOperation = asRecord(
    observations.createOperation,
    'CREATE_OPERATION_INVALID',
  );
  assertExactKeys(
    createOperation,
    [
      'attemptCount',
      'exactTargetUsed',
      'projectIdReturned',
      'projectIdPersisted',
      'persistedProjectIdMatchesCreateResponse',
    ],
    'CREATE_OPERATION_SCHEMA_NOT_ALLOWLISTED',
  );
  assertOne(createOperation.attemptCount, 'CREATE_ATTEMPT_COUNT_INVALID');
  assertTrue(createOperation.exactTargetUsed, 'CREATE_TARGET_MISMATCH');
  assertTrue(createOperation.projectIdReturned, 'PROJECT_ID_NOT_RETURNED');
  assertTrue(createOperation.projectIdPersisted, 'PROJECT_ID_NOT_PERSISTED');
  assertTrue(
    createOperation.persistedProjectIdMatchesCreateResponse,
    'PROJECT_ID_PERSISTENCE_MISMATCH',
  );

  const repository = asRecord(
    observations.repositoryBeforePush,
    'REPOSITORY_INVALID',
  );
  assertExactKeys(
    repository,
    [
      'returnedBySameCreateOperation',
      'sitesManagedRepositoryVerified',
      'privateVisibilityVerified',
      'projectAssociationVerified',
      'defaultBranch',
      'pushOccurredOnlyAfterVerification',
      'persistedGitRemoteCount',
      'sourceCredentialRecorded',
    ],
    'REPOSITORY_SCHEMA_NOT_ALLOWLISTED',
  );
  assertTrue(
    repository.returnedBySameCreateOperation,
    'REPOSITORY_NOT_FROM_CREATE_OPERATION',
  );
  assertTrue(
    repository.sitesManagedRepositoryVerified,
    'REPOSITORY_NOT_VERIFIED_AS_SITES_MANAGED',
  );
  assertTrue(
    repository.privateVisibilityVerified,
    'REPOSITORY_PRIVACY_NOT_VERIFIED',
  );
  assertTrue(
    repository.projectAssociationVerified,
    'REPOSITORY_ASSOCIATION_NOT_VERIFIED',
  );
  if (repository.defaultBranch !== targetContract.branch) {
    fail('REPOSITORY_BRANCH_NOT_MAIN');
  }
  assertTrue(
    repository.pushOccurredOnlyAfterVerification,
    'PUSH_PRECEDED_REPOSITORY_VERIFICATION',
  );
  assertZero(repository.persistedGitRemoteCount, 'GIT_REMOTE_PERSISTED');
  assertFalse(
    repository.sourceCredentialRecorded,
    'SOURCE_CREDENTIAL_RECORDED',
  );

  const postCreation = asRecord(
    observations.postCreation,
    'POST_CREATION_INVALID',
  );
  assertExactKeys(
    postCreation,
    ['workingTreeClean', 'package0GatePassed', 'cleanCheckoutPassed'],
    'POST_CREATION_SCHEMA_NOT_ALLOWLISTED',
  );
  assertTrue(postCreation.workingTreeClean, 'POST_CREATION_TREE_DIRTY');
  assertTrue(postCreation.package0GatePassed, 'POST_CREATION_GATE_NOT_PASSED');
  assertTrue(
    postCreation.cleanCheckoutPassed,
    'POST_CREATION_CLEAN_CHECKOUT_NOT_PASSED',
  );

  const lineage = asRecord(observations.lineage, 'LINEAGE_INVALID');
  const shaOperands = asStringArray(
    fullShaEquality.operands,
    'RUNBOOK_SHA_OPERANDS_INVALID',
  );
  assertExactKeys(lineage, shaOperands, 'LINEAGE_SCHEMA_NOT_ALLOWLISTED');
  const shaValues = shaOperands.map((operand) => lineage[operand]);
  for (const value of shaValues) {
    assertFullSha(value, 'LINEAGE_SHA_INVALID');
  }
  if (shaValues.some((value) => value !== shaValues[0])) {
    fail('LINEAGE_SHA_MISMATCH');
  }

  const deployment = asRecord(observations.deployment, 'DEPLOYMENT_INVALID');
  assertExactKeys(deployment, ['count'], 'DEPLOYMENT_SCHEMA_NOT_ALLOWLISTED');
  if (deploymentAssertion.expected !== 0) {
    fail('RUNBOOK_DEPLOYMENT_ASSERTION_INVALID');
  }
  assertZero(deployment.count, 'DEPLOYMENT_COUNT_NOT_ZERO');
  assertFalse(
    observations.sensitiveOrPrivateValuesRecorded,
    'SENSITIVE_OR_PRIVATE_VALUE_RECORDED',
  );

  return {
    status: 'PASS',
    siteName: target.siteName as string,
    siteSlug: target.siteSlug as string,
    branch: target.branch as string,
    inventoryMatchCount: 0,
    deploymentCount: 0,
    sourceSha: shaValues[0] as string,
  };
}

async function runCli(): Promise<void> {
  try {
    const manifestArgument = process.argv[2];
    if (
      typeof manifestArgument !== 'string' ||
      process.argv.length !== 3 ||
      !isAbsolute(manifestArgument)
    ) {
      fail('ABSOLUTE_EVIDENCE_MANIFEST_PATH_REQUIRED');
    }
    const repositoryRoot = await realpath(
      fileURLToPath(new URL('../../', import.meta.url)),
    );
    const manifestPath = await realpath(manifestArgument);
    assertEvidenceManifestPathIsOutsideRepository(manifestPath, repositoryRoot);
    const [runbookText, manifestText] = await Promise.all([
      readFile(
        new URL(
          '../../docs/evidence/PACKAGE0_EXTERNAL_RUNBOOK.json',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(manifestPath, 'utf8'),
    ]);
    const summary = validateStage1EvidenceManifest(
      JSON.parse(runbookText),
      JSON.parse(manifestText),
    );
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  } catch (error) {
    const code =
      error instanceof Stage1EvidenceValidationError
        ? error.code
        : 'EVIDENCE_MANIFEST_READ_OR_PARSE_FAILED';
    process.stderr.write(`${JSON.stringify({ status: 'FAIL', code })}\n`);
    process.exitCode = 1;
  }
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  void runCli();
}
