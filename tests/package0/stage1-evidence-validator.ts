import { realpathSync } from 'node:fs';
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

type CheckpointResult = {
  id: string;
  result: 'NOT_OBSERVED' | 'RECORDED';
};

export type Stage1EvidenceManifest = {
  schemaVersion: number;
  status: string;
  evidenceRunId: string;
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
  evidenceReferences: {
    inventoryReceiptSha256: string;
    preCreationLocalReceiptSha256: string;
    createAndRepositoryReceiptSha256: string;
    postCreationLocalReceiptSha256: string;
    saveOnlyReceiptSha256: string;
    independentReviewBundleSha256: string;
  };
  lineage: Record<string, string>;
  declarations: {
    containsSensitiveOrPrivateValues: boolean;
    numericalDeploymentCountClaimed: boolean;
  };
};

export type Stage1EvidenceSummary = {
  status: 'CONSISTENCY_PASS';
  evidenceRunId: string;
  siteName: string;
  siteSlug: string;
  branch: string;
  receiptReferenceCount: 6;
  sourceSha: string;
  hostedFactsVerified: false;
  stage1Complete: false;
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

function assertFalse(value: unknown, code: string): void {
  if (value !== false) fail(code);
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

function asStringArray(value: unknown, code: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    fail(code);
  }
  return value as string[];
}

function assertCheckpointResults(
  value: unknown,
  expectedIds: string[],
  expectedResult: 'NOT_OBSERVED' | 'RECORDED',
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
    contract.consistencyValidator,
    'RUNBOOK_CONSISTENCY_VALIDATOR_MISSING',
  );
  const evidenceAssertions = asRecord(
    contract.evidenceAssertions,
    'RUNBOOK_ASSERTIONS_MISSING',
  );
  const fullShaEquality = asRecord(
    evidenceAssertions.fullShaEquality,
    'RUNBOOK_SHA_ASSERTION_MISSING',
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
    [
      'schemaVersion',
      'status',
      'evidenceRunId',
      'target',
      'checkpoints',
      'evidenceReferences',
      'lineage',
      'declarations',
    ],
    'MANIFEST_SCHEMA_NOT_ALLOWLISTED',
  );
  if (manifest.schemaVersion !== 3) fail('MANIFEST_SCHEMA_VERSION_INVALID');
  if (
    validatorContract.requiredResult !== 'CONSISTENCY_PASS' ||
    manifest.status !== validatorContract.requiredResult
  ) {
    fail('MANIFEST_STATUS_NOT_CONSISTENCY_PASS');
  }
  assertEvidenceRunId(manifest.evidenceRunId, 'EVIDENCE_RUN_ID_INVALID');

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
    'RECORDED',
    'PRECONDITIONS_INCOMPLETE_OR_OUT_OF_ORDER',
  );
  assertCheckpointResults(
    checkpoints.actions,
    asStringArray(stage.actions, 'RUNBOOK_ACTIONS_INVALID'),
    'RECORDED',
    'ACTIONS_INCOMPLETE_OR_OUT_OF_ORDER',
  );
  assertCheckpointResults(
    checkpoints.forbiddenActions,
    asStringArray(stage.forbiddenActions, 'RUNBOOK_FORBIDDEN_ACTIONS_INVALID'),
    'NOT_OBSERVED',
    'FORBIDDEN_ACTION_OBSERVED',
  );
  assertCheckpointResults(
    checkpoints.requiredEvidence,
    asStringArray(stage.requiredEvidence, 'RUNBOOK_EVIDENCE_INVALID'),
    'RECORDED',
    'REQUIRED_EVIDENCE_INCOMPLETE_OR_OUT_OF_ORDER',
  );
  if (
    typeof stage.stopAfter !== 'string' ||
    checkpoints.stopAfter !== stage.stopAfter
  ) {
    fail('STOP_AFTER_MISMATCH');
  }

  const evidenceReferences = asRecord(
    manifest.evidenceReferences,
    'EVIDENCE_REFERENCES_INVALID',
  );
  const receiptKeys = [
    'inventoryReceiptSha256',
    'preCreationLocalReceiptSha256',
    'createAndRepositoryReceiptSha256',
    'postCreationLocalReceiptSha256',
    'saveOnlyReceiptSha256',
    'independentReviewBundleSha256',
  ];
  assertExactKeys(
    evidenceReferences,
    receiptKeys,
    'EVIDENCE_REFERENCE_SCHEMA_NOT_ALLOWLISTED',
  );
  const receiptHashes = receiptKeys.map((key) => evidenceReferences[key]);
  for (const receiptHash of receiptHashes) {
    assertSha256(receiptHash, 'EVIDENCE_REFERENCE_SHA256_INVALID');
  }
  if (new Set(receiptHashes).size !== receiptHashes.length) {
    fail('EVIDENCE_REFERENCE_REUSED');
  }

  const lineage = asRecord(manifest.lineage, 'LINEAGE_INVALID');
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

  const declarations = asRecord(
    manifest.declarations,
    'DECLARATIONS_INVALID',
  );
  assertExactKeys(
    declarations,
    [
      'containsSensitiveOrPrivateValues',
      'numericalDeploymentCountClaimed',
    ],
    'DECLARATION_SCHEMA_NOT_ALLOWLISTED',
  );
  assertFalse(
    declarations.containsSensitiveOrPrivateValues,
    'SENSITIVE_OR_PRIVATE_VALUE_RECORDED',
  );
  assertFalse(
    declarations.numericalDeploymentCountClaimed,
    'UNSUPPORTED_NUMERICAL_DEPLOYMENT_COUNT_CLAIMED',
  );

  return {
    status: 'CONSISTENCY_PASS',
    evidenceRunId: manifest.evidenceRunId,
    siteName: target.siteName as string,
    siteSlug: target.siteSlug as string,
    branch: target.branch as string,
    receiptReferenceCount: 6,
    sourceSha: shaValues[0] as string,
    hostedFactsVerified: false,
    stage1Complete: false,
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
    process.stderr.write(
      `${JSON.stringify({ status: 'CONSISTENCY_FAIL', code })}\n`,
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
