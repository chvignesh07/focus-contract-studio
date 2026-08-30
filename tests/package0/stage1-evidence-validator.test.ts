import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  assertEvidenceManifestPathIsOutsideRepository,
  type Stage1EvidenceManifest,
  validateStage1EvidenceManifest,
} from './stage1-evidence-validator.ts';

const repositoryUrl = new URL('../../', import.meta.url);
const runbookUrl = new URL(
  'docs/evidence/PACKAGE0_EXTERNAL_RUNBOOK.json',
  repositoryUrl,
);
const syntheticSha = 'a'.repeat(40);
const evidenceRunId = '1'.repeat(32);

type Stage = {
  actions: string[];
  forbiddenActions: string[];
  id: string;
  preconditions: string[];
  requiredEvidence: string[];
  stopAfter: string;
};

type Runbook = {
  stage1Contract: {
    consistencyValidator: {
      requiredResult: string;
    };
    target: {
      branch: string;
      siteName: string;
      siteSlug: string;
    };
  };
  stages: Stage[];
};

type ConsistencyManifest = {
  schemaVersion: number;
  status: string;
  evidenceRunId: string;
  target: {
    siteName: string;
    siteSlug: string;
    branch: string;
  };
  checkpoints: {
    preconditions: Array<{ id: string; result: string }>;
    actions: Array<{ id: string; result: string }>;
    forbiddenActions: Array<{ id: string; result: string }>;
    requiredEvidence: Array<{ id: string; result: string }>;
    stopAfter: string;
  };
  evidenceReferences: Record<string, string>;
  lineage: Record<string, string>;
  declarations: {
    containsSensitiveOrPrivateValues: boolean;
    numericalDeploymentCountClaimed: boolean;
  };
};

const checkpointResults = (ids: string[], result: string) =>
  ids.map((id) => ({ id, result }));

async function loadRunbook(): Promise<Runbook> {
  return JSON.parse(await readFile(runbookUrl, 'utf8')) as Runbook;
}

function makeConsistencyManifest(runbook: Runbook): ConsistencyManifest {
  const stage = runbook.stages[0];
  assert.ok(stage);
  return {
    schemaVersion: 3,
    status: 'CONSISTENCY_PASS',
    evidenceRunId,
    target: {
      siteName: runbook.stage1Contract.target.siteName,
      siteSlug: runbook.stage1Contract.target.siteSlug,
      branch: runbook.stage1Contract.target.branch,
    },
    checkpoints: {
      preconditions: checkpointResults(stage.preconditions, 'RECORDED'),
      actions: checkpointResults(stage.actions, 'RECORDED'),
      forbiddenActions: checkpointResults(
        stage.forbiddenActions,
        'NOT_OBSERVED',
      ),
      requiredEvidence: checkpointResults(
        stage.requiredEvidence,
        'RECORDED',
      ),
      stopAfter: stage.stopAfter,
    },
    evidenceReferences: {
      inventoryReceiptSha256: '1'.repeat(64),
      preCreationLocalReceiptSha256: '2'.repeat(64),
      createAndRepositoryReceiptSha256: '3'.repeat(64),
      postCreationLocalReceiptSha256: '4'.repeat(64),
      saveOnlyReceiptSha256: '5'.repeat(64),
      independentReviewBundleSha256: '6'.repeat(64),
    },
    lineage: {
      post_creation_head_full_sha: syntheticSha,
      reverification_head_full_sha: syntheticSha,
      private_push_head_full_sha: syntheticSha,
      package_source_head_full_sha: syntheticSha,
      saved_version_commit_sha: syntheticSha,
    },
    declarations: {
      containsSensitiveOrPrivateValues: false,
      numericalDeploymentCountClaimed: false,
    },
  };
}

test('synthetic evidence can earn consistency only, never hosted or Stage 1 completion', async () => {
  const runbook = await loadRunbook();
  const summary = validateStage1EvidenceManifest(
    runbook,
    makeConsistencyManifest(runbook) as unknown as Stage1EvidenceManifest,
  );
  assert.deepEqual(summary, {
    status: 'CONSISTENCY_PASS',
    evidenceRunId,
    siteName: 'focus-contract-studio-package-0',
    siteSlug: 'focus-contract-studio-package-0',
    branch: 'main',
    receiptReferenceCount: 6,
    sourceSha: syntheticSha,
    hostedFactsVerified: false,
    stage1Complete: false,
  });
});

test('consistency validation rejects missing, reused, or malformed evidence references', async () => {
  const runbook = await loadRunbook();

  const missing = makeConsistencyManifest(runbook);
  delete missing.evidenceReferences.saveOnlyReceiptSha256;
  assert.throws(
    () =>
      validateStage1EvidenceManifest(
        runbook,
        missing as unknown as Stage1EvidenceManifest,
      ),
    { name: 'Stage1EvidenceValidationError' },
  );

  const reused = makeConsistencyManifest(runbook);
  reused.evidenceReferences.saveOnlyReceiptSha256 =
    reused.evidenceReferences.inventoryReceiptSha256 ?? '';
  assert.throws(
    () =>
      validateStage1EvidenceManifest(
        runbook,
        reused as unknown as Stage1EvidenceManifest,
      ),
    { name: 'Stage1EvidenceValidationError' },
  );

  const malformed = makeConsistencyManifest(runbook);
  malformed.evidenceReferences.postCreationLocalReceiptSha256 = 'f'.repeat(63);
  assert.throws(
    () =>
      validateStage1EvidenceManifest(
        runbook,
        malformed as unknown as Stage1EvidenceManifest,
      ),
    { name: 'Stage1EvidenceValidationError' },
  );
});

test('consistency validation rejects lineage disagreement but does not claim the SHA was observed', async () => {
  const runbook = await loadRunbook();
  const mismatch = makeConsistencyManifest(runbook);
  mismatch.lineage.saved_version_commit_sha = 'b'.repeat(40);
  assert.throws(
    () =>
      validateStage1EvidenceManifest(
        runbook,
        mismatch as unknown as Stage1EvidenceManifest,
      ),
    { name: 'Stage1EvidenceValidationError' },
  );

  const malformed = makeConsistencyManifest(runbook);
  malformed.lineage.private_push_head_full_sha = 'a'.repeat(39);
  assert.throws(
    () =>
      validateStage1EvidenceManifest(
        runbook,
        malformed as unknown as Stage1EvidenceManifest,
      ),
    { name: 'Stage1EvidenceValidationError' },
  );
});

test('consistency validation rejects numerical deployment claims and private fields', async () => {
  const runbook = await loadRunbook();
  const countClaim = makeConsistencyManifest(runbook) as ConsistencyManifest & {
    deploymentCount: number;
  };
  countClaim.deploymentCount = 0;
  assert.throws(
    () =>
      validateStage1EvidenceManifest(
        runbook,
        countClaim as unknown as Stage1EvidenceManifest,
      ),
    { name: 'Stage1EvidenceValidationError' },
  );

  const privateIdentifier = makeConsistencyManifest(
    runbook,
  ) as ConsistencyManifest & { projectId: string };
  privateIdentifier.projectId = 'must-not-be-accepted';
  assert.throws(
    () =>
      validateStage1EvidenceManifest(
        runbook,
        privateIdentifier as unknown as Stage1EvidenceManifest,
      ),
    { name: 'Stage1EvidenceValidationError' },
  );

  const numericalClaim = makeConsistencyManifest(runbook);
  numericalClaim.declarations.numericalDeploymentCountClaimed = true;
  assert.throws(
    () =>
      validateStage1EvidenceManifest(
        runbook,
        numericalClaim as unknown as Stage1EvidenceManifest,
      ),
    { name: 'Stage1EvidenceValidationError' },
  );
});

test('checkpoint order and the consistency-only vocabulary are exact', async () => {
  const runbook = await loadRunbook();

  const reordered = makeConsistencyManifest(runbook);
  reordered.checkpoints.actions.reverse();
  assert.throws(
    () =>
      validateStage1EvidenceManifest(
        runbook,
        reordered as unknown as Stage1EvidenceManifest,
      ),
    { name: 'Stage1EvidenceValidationError' },
  );

  const falsePass = makeConsistencyManifest(runbook);
  falsePass.status = 'PASS';
  assert.throws(
    () =>
      validateStage1EvidenceManifest(
        runbook,
        falsePass as unknown as Stage1EvidenceManifest,
      ),
    { name: 'Stage1EvidenceValidationError' },
  );

  const forbiddenObserved = makeConsistencyManifest(runbook);
  const firstForbidden = forbiddenObserved.checkpoints.forbiddenActions[0];
  assert.ok(firstForbidden);
  firstForbidden.result = 'RECORDED';
  assert.throws(
    () =>
      validateStage1EvidenceManifest(
        runbook,
        forbiddenObserved as unknown as Stage1EvidenceManifest,
      ),
    { name: 'Stage1EvidenceValidationError' },
  );

  const invalidRunId = makeConsistencyManifest(runbook);
  invalidRunId.evidenceRunId = 'operator-chosen-label';
  assert.throws(
    () =>
      validateStage1EvidenceManifest(
        runbook,
        invalidRunId as unknown as Stage1EvidenceManifest,
      ),
    { name: 'Stage1EvidenceValidationError' },
  );
});

test('the consistency manifest path must resolve outside the repository', () => {
  assert.throws(
    () =>
      assertEvidenceManifestPathIsOutsideRepository(
        '<LOCAL_USER_HOME>/Developer/focus-contract-studio/stage1.json',
        '<LOCAL_USER_HOME>/Developer/focus-contract-studio',
      ),
    { name: 'Stage1EvidenceValidationError' },
  );
  assert.doesNotThrow(() =>
    assertEvidenceManifestPathIsOutsideRepository(
      '<TEMP_DIRECTORY>/fcs-stage1/stage1.json',
      '<LOCAL_USER_HOME>/Developer/focus-contract-studio',
    ),
  );
});
