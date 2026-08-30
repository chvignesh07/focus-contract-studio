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
const sha = 'a'.repeat(40);

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
    evidenceValidator: {
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

const checkpointResults = (ids: string[], result: 'NOT_RUN' | 'PASS') =>
  ids.map((id) => ({ id, result }));

async function loadRunbook(): Promise<Runbook> {
  return JSON.parse(await readFile(runbookUrl, 'utf8')) as Runbook;
}

function makePassingManifest(runbook: Runbook): Stage1EvidenceManifest {
  const stage = runbook.stages[0];
  assert.ok(stage);
  return {
    schemaVersion: 1,
    status: 'PASS',
    target: {
      siteName: runbook.stage1Contract.target.siteName,
      siteSlug: runbook.stage1Contract.target.siteSlug,
      branch: runbook.stage1Contract.target.branch,
    },
    checkpoints: {
      preconditions: checkpointResults(stage.preconditions, 'PASS'),
      actions: checkpointResults(stage.actions, 'PASS'),
      forbiddenActions: checkpointResults(
        stage.forbiddenActions,
        'NOT_RUN',
      ),
      requiredEvidence: checkpointResults(stage.requiredEvidence, 'PASS'),
      stopAfter: stage.stopAfter,
    },
    observations: {
      inventoryBeforeCreate: {
        completed: true,
        unambiguous: true,
        comparison: 'case_insensitive_exact_match',
        caseInsensitiveTitleMatchCount: 0,
        caseInsensitiveSlugMatchCount: 0,
        combinedUniqueMatchCount: 0,
      },
      custodyBeforeCreate: {
        approvedHeadFullSha: sha,
        branch: 'main',
        workingTreeClean: true,
        package0GatePassed: true,
        cleanCheckoutPassed: true,
        gitRemoteCount: 0,
        hostingProjectIdPresent: false,
        siteAlreadyCreatedForCheckout: false,
      },
      createOperation: {
        attemptCount: 1,
        exactTargetUsed: true,
        projectIdReturned: true,
        projectIdPersisted: true,
        persistedProjectIdMatchesCreateResponse: true,
      },
      repositoryBeforePush: {
        returnedBySameCreateOperation: true,
        sitesManagedRepositoryVerified: true,
        privateVisibilityVerified: true,
        projectAssociationVerified: true,
        defaultBranch: 'main',
        pushOccurredOnlyAfterVerification: true,
        persistedGitRemoteCount: 0,
        sourceCredentialRecorded: false,
      },
      postCreation: {
        workingTreeClean: true,
        package0GatePassed: true,
        cleanCheckoutPassed: true,
      },
      lineage: {
        post_creation_head_full_sha: sha,
        reverification_head_full_sha: sha,
        private_push_head_full_sha: sha,
        package_source_head_full_sha: sha,
        saved_version_commit_sha: sha,
      },
      deployment: {
        count: 0,
      },
      sensitiveOrPrivateValuesRecorded: false,
    },
  };
}

test('a complete ordered and redacted Stage 1 manifest passes', async () => {
  const runbook = await loadRunbook();
  const summary = validateStage1EvidenceManifest(
    runbook,
    makePassingManifest(runbook),
  );
  assert.deepEqual(summary, {
    status: 'PASS',
    siteName: 'focus-contract-studio-package-0',
    siteSlug: 'focus-contract-studio-package-0',
    branch: 'main',
    inventoryMatchCount: 0,
    deploymentCount: 0,
    sourceSha: sha,
  });
});

test('Stage 1 manifest validation fail-closes every unsafe phase', async () => {
  const runbook = await loadRunbook();
  const cases: Array<[
    string,
    (manifest: Stage1EvidenceManifest) => void,
  ]> = [
    ['incomplete inventory', (m) => (m.observations.inventoryBeforeCreate.completed = false)],
    ['ambiguous inventory', (m) => (m.observations.inventoryBeforeCreate.unambiguous = false)],
    ['title collision', (m) => (m.observations.inventoryBeforeCreate.caseInsensitiveTitleMatchCount = 1)],
    ['slug collision', (m) => (m.observations.inventoryBeforeCreate.caseInsensitiveSlugMatchCount = 1)],
    ['combined collision', (m) => (m.observations.inventoryBeforeCreate.combinedUniqueMatchCount = 1)],
    ['wrong comparison', (m) => (m.observations.inventoryBeforeCreate.comparison = 'case_sensitive')],
    ['dirty tree', (m) => (m.observations.custodyBeforeCreate.workingTreeClean = false)],
    ['failed local gate', (m) => (m.observations.custodyBeforeCreate.package0GatePassed = false)],
    ['failed clean clone', (m) => (m.observations.custodyBeforeCreate.cleanCheckoutPassed = false)],
    ['pre-existing remote', (m) => (m.observations.custodyBeforeCreate.gitRemoteCount = 1)],
    ['pre-existing project id', (m) => (m.observations.custodyBeforeCreate.hostingProjectIdPresent = true)],
    ['pre-associated checkout', (m) => (m.observations.custodyBeforeCreate.siteAlreadyCreatedForCheckout = true)],
    ['duplicate create', (m) => (m.observations.createOperation.attemptCount = 2)],
    ['wrong create target', (m) => (m.observations.createOperation.exactTargetUsed = false)],
    ['missing returned project id', (m) => (m.observations.createOperation.projectIdReturned = false)],
    ['unpersisted project id', (m) => (m.observations.createOperation.projectIdPersisted = false)],
    ['project id mismatch', (m) => (m.observations.createOperation.persistedProjectIdMatchesCreateResponse = false)],
    ['unrelated repository', (m) => (m.observations.repositoryBeforePush.returnedBySameCreateOperation = false)],
    ['repository not verified as Sites-managed', (m) => (m.observations.repositoryBeforePush.sitesManagedRepositoryVerified = false)],
    ['unverified privacy', (m) => (m.observations.repositoryBeforePush.privateVisibilityVerified = false)],
    ['ambiguous project association', (m) => (m.observations.repositoryBeforePush.projectAssociationVerified = false)],
    ['wrong repository branch', (m) => (m.observations.repositoryBeforePush.defaultBranch = 'develop')],
    ['push before verification', (m) => (m.observations.repositoryBeforePush.pushOccurredOnlyAfterVerification = false)],
    ['persisted remote', (m) => (m.observations.repositoryBeforePush.persistedGitRemoteCount = 1)],
    ['recorded source credential', (m) => (m.observations.repositoryBeforePush.sourceCredentialRecorded = true)],
    ['dirty post-create tree', (m) => (m.observations.postCreation.workingTreeClean = false)],
    ['failed post-create gate', (m) => (m.observations.postCreation.package0GatePassed = false)],
    ['failed post-create clone', (m) => (m.observations.postCreation.cleanCheckoutPassed = false)],
    ['SHA mismatch', (m) => (m.observations.lineage.saved_version_commit_sha = 'b'.repeat(40))],
    ['malformed SHA', (m) => (m.observations.lineage.private_push_head_full_sha = 'a'.repeat(39))],
    ['deployment exists', (m) => (m.observations.deployment.count = 1)],
    ['sensitive value recorded', (m) => (m.observations.sensitiveOrPrivateValuesRecorded = true)],
    ['wrong target branch', (m) => (m.target.branch = 'develop')],
  ];

  for (const [name, mutate] of cases) {
    const manifest = structuredClone(makePassingManifest(runbook));
    mutate(manifest);
    assert.throws(
      () => validateStage1EvidenceManifest(runbook, manifest),
      { name: 'Stage1EvidenceValidationError' },
      name,
    );
  }
});

test('checkpoint order, completeness, forbidden-action absence, and schema allowlist are enforced', async () => {
  const runbook = await loadRunbook();

  const reordered = makePassingManifest(runbook);
  reordered.checkpoints.actions.reverse();
  assert.throws(
    () => validateStage1EvidenceManifest(runbook, reordered),
    { name: 'Stage1EvidenceValidationError' },
  );

  const missing = makePassingManifest(runbook);
  missing.checkpoints.preconditions.pop();
  assert.throws(
    () => validateStage1EvidenceManifest(runbook, missing),
    { name: 'Stage1EvidenceValidationError' },
  );

  const forbidden = makePassingManifest(runbook);
  const firstForbidden = forbidden.checkpoints.forbiddenActions[0];
  assert.ok(firstForbidden);
  firstForbidden.result = 'PASS';
  assert.throws(
    () => validateStage1EvidenceManifest(runbook, forbidden),
    { name: 'Stage1EvidenceValidationError' },
  );

  const withPrivateIdentifier = makePassingManifest(runbook) as unknown as {
    projectId: string;
  };
  withPrivateIdentifier.projectId = 'must-not-be-accepted';
  assert.throws(
    () => validateStage1EvidenceManifest(runbook, withPrivateIdentifier),
    { name: 'Stage1EvidenceValidationError' },
  );

  const withWorkspaceLabel = makePassingManifest(runbook) as unknown as {
    target: Stage1EvidenceManifest['target'] & { workspaceLabel: string };
  };
  withWorkspaceLabel.target.workspaceLabel = 'proj_example123';
  assert.throws(
    () => validateStage1EvidenceManifest(runbook, withWorkspaceLabel),
    { name: 'Stage1EvidenceValidationError' },
  );
});

test('the Stage 1 evidence manifest path must resolve outside the repository', () => {
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
