import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const runbookUrl = new URL(
  '../../docs/evidence/PACKAGE0_EXTERNAL_RUNBOOK.json',
  import.meta.url,
);

type Stage = {
  actions: string[];
  forbiddenActions: string[];
  id: string;
  requiredEvidence: string[];
  requiresFreshApproval: boolean;
  stopAfter: string;
};

type Stage4 = Stage & {
  cleanupConfiguration: Record<string, string>;
  hardDisabledConfiguration: { remove: string[] };
  runConfiguration: Record<string, string>;
};

test('external Package 0 checkpoints preserve post-creation source lineage and save before deploy', async () => {
  const runbook = JSON.parse(await readFile(runbookUrl, 'utf8')) as {
    stages: Stage[];
  };
  const stage1 = runbook.stages[0];
  assert.equal(stage1?.id, 'stage-1-create-push-package-save-only');
  assert.deepEqual(stage1.actions, [
    'create_site_once_if_project_id_absent',
    'persist_returned_project_id_verbatim',
    'commit_project_id_source_change',
    'reverify_post_creation_head',
    'push_post_creation_head_privately',
    'package_post_creation_head',
    'save_version_with_post_creation_head_commit_sha',
  ]);
  assert.ok(stage1.forbiddenActions.includes('deploy_saved_version'));
  assert.ok(stage1.forbiddenActions.includes('mutate_hosted_d1'));
});

test('external Package 0 stages separate observation, identity, and bounded D1 mutation', async () => {
  const runbook = JSON.parse(await readFile(runbookUrl, 'utf8')) as {
    externalActionsPerformed: unknown[];
    globalInvariants: Record<string, boolean>;
    stages: Stage[];
    status: string;
  };
  assert.equal(runbook.status, 'NOT_RUN');
  assert.deepEqual(runbook.externalActionsPerformed, []);
  assert.ok(runbook.stages.every((stage) => stage.requiresFreshApproval));
  assert.deepEqual(
    runbook.stages.map((stage) => stage.id),
    [
      'stage-1-create-push-package-save-only',
      'stage-2-owner-only-read-only-observation',
      'stage-3-optional-identity-observation',
      'stage-4-bounded-d1-run-and-cleanup',
    ],
  );

  const [stage1, stage2, stage3, untypedStage4] = runbook.stages;
  const stage4 = untypedStage4 as Stage4 | undefined;
  assert.ok(stage1?.forbiddenActions.includes('deploy_saved_version'));
  assert.ok(stage2?.forbiddenActions.includes('enable_d1_run'));
  assert.ok(stage2?.forbiddenActions.includes('run_identity_probe'));
  assert.ok(stage3?.forbiddenActions.includes('enable_d1_run'));
  assert.deepEqual(stage4?.actions, [
    'verify_owner_only_access_prerequisite',
    'configure_operator_token_digest_as_secret',
    'enable_bounded_d1_run_window',
    'deploy_run_configuration',
    'execute_disposable_d1_once',
    'prove_repeat_rejection',
    'disable_d1_run_keep_owner_and_operator_authorization',
    'wait_for_stored_run_window_expiry_plus_five_second_drain',
    'enable_bounded_cleanup_window',
    'deploy_cleanup_configuration',
    'finalize_without_browser_cookie_dependency',
    'prove_zero_exact_probe_schema',
    'remove_all_temporary_values',
    'redeploy_hard_disabled_configuration',
  ]);
  assert.deepEqual(stage4?.runConfiguration, {
    PACKAGE0_OWNER_ONLY_ACCESS_CONFIRMED: 'true',
    PACKAGE0_D1_OPERATOR_TOKEN_SHA256:
      'secret_lowercase_sha256_of_32_byte_base64url_token',
    PACKAGE0_HOSTED_D1_PROBE_ENABLED: 'true',
    PACKAGE0_HOSTED_D1_PROBE_WINDOW_NOT_BEFORE: 'integer_unix_seconds',
    PACKAGE0_HOSTED_D1_PROBE_WINDOW_EXPIRES_AT:
      'integer_unix_seconds_at_most_900_after_not_before',
    PACKAGE0_HOSTED_D1_CLEANUP_ENABLED: 'false_or_absent',
    PACKAGE0_HOSTED_D1_CLEANUP_WINDOW_NOT_BEFORE: 'absent',
    PACKAGE0_HOSTED_D1_CLEANUP_WINDOW_EXPIRES_AT: 'absent',
  });
  assert.deepEqual(stage4?.cleanupConfiguration, {
    PACKAGE0_OWNER_ONLY_ACCESS_CONFIRMED: 'true',
    PACKAGE0_D1_OPERATOR_TOKEN_SHA256:
      'same_secret_digest_as_run_configuration',
    PACKAGE0_HOSTED_D1_PROBE_ENABLED: 'false_or_absent',
    PACKAGE0_HOSTED_D1_PROBE_WINDOW_NOT_BEFORE: 'absent',
    PACKAGE0_HOSTED_D1_PROBE_WINDOW_EXPIRES_AT: 'absent',
    PACKAGE0_HOSTED_D1_CLEANUP_ENABLED: 'true',
    PACKAGE0_HOSTED_D1_CLEANUP_WINDOW_NOT_BEFORE: 'integer_unix_seconds',
    PACKAGE0_HOSTED_D1_CLEANUP_WINDOW_EXPIRES_AT:
      'integer_unix_seconds_at_most_900_after_not_before',
  });
  assert.deepEqual(stage4?.hardDisabledConfiguration.remove, [
    'PACKAGE0_OWNER_ONLY_ACCESS_CONFIRMED',
    'PACKAGE0_D1_OPERATOR_TOKEN_SHA256',
    'PACKAGE0_HOSTED_D1_PROBE_ENABLED',
    'PACKAGE0_HOSTED_D1_PROBE_WINDOW_NOT_BEFORE',
    'PACKAGE0_HOSTED_D1_PROBE_WINDOW_EXPIRES_AT',
    'PACKAGE0_HOSTED_D1_CLEANUP_ENABLED',
    'PACKAGE0_HOSTED_D1_CLEANUP_WINDOW_NOT_BEFORE',
    'PACKAGE0_HOSTED_D1_CLEANUP_WINDOW_EXPIRES_AT',
    'PACKAGE0_IDENTITY_PROBE_KEY',
  ]);
  assert.ok(
    stage4?.requiredEvidence.includes(
      'cleanup_started_only_after_stored_run_window_expiry_plus_five_second_drain',
    ),
  );
  assert.ok(
    stage4?.requiredEvidence.includes(
      'cleanup_succeeded_without_any_browser_cleanup_cookie',
    ),
  );
  assert.ok(
    stage4?.forbiddenActions.includes(
      'remove_owner_or_operator_authorization_before_finalization',
    ),
  );
  assert.equal(
    runbook.globalInvariants
      .browserAutomationScreenshotsSnapshotsAndNetworkLogsAreForbiddenWhileOperatorTokenIsPresent,
    true,
  );
});
