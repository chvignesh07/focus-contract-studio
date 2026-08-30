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
  preconditions: string[];
  requiredEvidence: string[];
  requiresFreshApproval: boolean;
  stopAfter: string;
};

type Stage1Contract = {
  evidenceValidator: {
    implementation: string;
    manifestLocation: string;
    manifestPolicy: string;
    requiredBeforeStageCompletion: boolean;
    requiredResult: string;
  };
  evidenceAssertions: {
    deploymentCount: {
      expected: number;
      scope: string;
    };
    fullShaEquality: {
      operands: string[];
      operator: string;
    };
  };
  inventoryPreflight: {
    comparison: string;
    fields: string[];
    requiredCombinedMatchCount: number;
    repeatImmediatelyBeforeCreate: boolean;
    scope: string;
  };
  sourceRepository: {
    allowedPushTarget: string;
    forbidden: string[];
    requiredBeforePush: string[];
  };
  stopConditions: {
    beforeCreate: string[];
    beforePush: string[];
    beforeSave: string[];
    afterSave: string[];
  };
  target: {
    branch: string;
    createToolFieldMapping: {
      siteName: string;
      siteSlug: string;
    };
    siteName: string;
    siteSlug: string;
  };
};

type Stage4 = Stage & {
  cleanupConfiguration: Record<string, string>;
  hardDisabledConfiguration: { remove: string[] };
  runConfiguration: Record<string, string>;
};

test('Stage 1 fixes the target and fail-closes inventory and source-repository selection', async () => {
  const runbook = JSON.parse(await readFile(runbookUrl, 'utf8')) as {
    stage1Contract: Stage1Contract;
    stages: Stage[];
  };
  const stage1 = runbook.stages[0];
  assert.equal(stage1?.id, 'stage-1-create-push-package-save-only');
  assert.deepEqual(runbook.stage1Contract.target, {
    siteName: 'focus-contract-studio-package-0',
    siteSlug: 'focus-contract-studio-package-0',
    branch: 'main',
    createToolFieldMapping: {
      siteName: 'title',
      siteSlug: 'slug',
    },
  });
  assert.deepEqual(runbook.stage1Contract.evidenceValidator, {
    implementation: 'tests/package0/stage1-evidence-validator.ts',
    manifestLocation: 'absolute_path_outside_repository',
    manifestPolicy: 'strict_allowlist_non_sensitive_values_only',
    requiredBeforeStageCompletion: true,
    requiredResult: 'PASS',
  });
  assert.deepEqual(runbook.stage1Contract.inventoryPreflight, {
    scope: 'owner_sites_in_the_selected_workspace',
    fields: ['title', 'slug'],
    comparison: 'case_insensitive_exact_match',
    requiredCombinedMatchCount: 0,
    repeatImmediatelyBeforeCreate: true,
  });
  assert.deepEqual(runbook.stage1Contract.sourceRepository, {
    allowedPushTarget:
      'private_sites_managed_repository_returned_by_the_same_create_site_operation_only',
    requiredBeforePush: [
      'repository_was_returned_by_the_same_create_site_operation',
      'private_visibility_is_verified',
      'project_association_matches_the_returned_project_id',
      'returned_default_branch_is_main',
    ],
    forbidden: [
      'invent_a_remote',
      'select_an_existing_or_unrelated_remote',
      'overwrite_a_remote',
      'persist_a_git_remote_or_source_credential',
    ],
  });
  assert.deepEqual(runbook.stage1Contract.stopConditions, {
    beforeCreate: [
      'sites_inventory_is_unavailable_incomplete_or_ambiguous',
      'case_insensitive_site_name_or_slug_match_count_is_not_zero',
      'branch_is_not_main',
      'working_tree_is_not_clean',
      'package0_reverification_is_not_passed',
      'hosting_json_contains_a_project_id',
      'git_remote_exists',
    ],
    beforePush: [
      'returned_project_id_is_missing_or_unexpected',
      'source_repository_was_not_returned_by_the_same_create_operation',
      'source_repository_privacy_is_not_verified',
      'source_repository_project_association_is_not_verified',
      'returned_source_branch_is_not_main',
      'an_unexpected_git_remote_exists',
    ],
    beforeSave: [
      'post_creation_head_is_not_clean',
      'post_creation_reverification_failed',
      'private_push_head_or_package_head_differs_from_post_creation_head',
    ],
    afterSave: [
      'saved_version_commit_sha_differs_from_post_creation_head',
      'deployment_count_is_not_zero',
    ],
  });
  assert.deepEqual(stage1?.preconditions, [
    'approved_target_name_slug_and_branch_match_stage_1_contract',
    'current_head_is_the_approved_stage_1_start_head',
    'branch_is_main',
    'working_tree_is_clean',
    'local_package0_gate_and_clean_checkout_reverification_passed_for_current_head',
    'git_has_no_remote',
    'hosting_json_has_no_project_id',
    'read_only_owner_site_inventory_is_complete_and_unambiguous',
    'read_only_inventory_has_zero_case_insensitive_name_or_slug_matches',
    'no_site_has_been_created_for_this_checkout',
  ]);
  assert.deepEqual(stage1.actions, [
    'repeat_read_only_owner_site_inventory_for_exact_name_and_slug',
    'create_site_once_with_exact_target_if_and_only_if_all_preconditions_hold',
    'persist_returned_project_id_verbatim',
    'verify_returned_private_sites_repository_and_project_association_before_push',
    'commit_project_id_source_change',
    'reverify_post_creation_head',
    'push_main_post_creation_head_to_same_create_operation_repository_with_per_command_auth_only',
    'package_post_creation_head',
    'save_version_with_post_creation_head_commit_sha',
    'verify_saved_version_commit_sha_and_zero_deployments',
  ]);
  assert.deepEqual(stage1.forbiddenActions, [
    'create_site_when_inventory_is_incomplete_ambiguous_or_has_any_name_or_slug_match',
    'create_site_when_project_id_or_git_remote_already_exists',
    'call_create_site_more_than_once',
    'invent_select_overwrite_or_persist_a_git_remote',
    'push_to_a_repository_not_returned_by_the_same_create_operation',
    'push_before_private_visibility_and_project_association_are_verified',
    'persist_or_record_a_source_credential',
    'deploy_saved_version',
    'change_site_access',
    'set_runtime_environment_values',
    'mutate_hosted_d1',
    'run_identity_probe',
    'publish_source_or_site',
  ]);
  assert.deepEqual(stage1.requiredEvidence, [
    'non_sensitive_selected_workspace_label',
    'read_only_inventory_is_complete_unambiguous_and_match_count_is_zero',
    'approved_pre_creation_head_branch_clean_state_no_remote_and_no_project_id',
    'returned_project_id_is_persisted_and_matches_the_same_create_response_without_recording_its_value',
    'returned_source_repository_is_private_sites_managed_and_associated_with_returned_project_before_push',
    'returned_source_branch_is_main',
    'post_creation_head_full_sha',
    'clean_reverification_for_post_creation_head',
    'private_push_head_matches_post_creation_head',
    'package_built_from_post_creation_head',
    'saved_version_commit_sha_matches_post_creation_head',
    'deployment_count_is_zero_for_site_created_by_this_stage',
    'no_git_remote_credential_private_identifier_or_deployment_was_persisted_or_recorded',
  ]);
  assert.equal(stage1.stopAfter, 'saved_version_exists_without_deployment');
});

test('Stage 1 contract defines full-SHA equality and an exact zero deployment count', async () => {
  const runbook = JSON.parse(await readFile(runbookUrl, 'utf8')) as {
    stage1Contract: Stage1Contract;
  };
  const contract = runbook.stage1Contract;
  assert.deepEqual(contract.evidenceAssertions, {
    fullShaEquality: {
      operator: 'all_exactly_equal_full_40_character_lowercase_git_sha',
      operands: [
        'post_creation_head_full_sha',
        'reverification_head_full_sha',
        'private_push_head_full_sha',
        'package_source_head_full_sha',
        'saved_version_commit_sha',
      ],
    },
    deploymentCount: {
      scope: 'site_created_by_the_same_stage_1_create_operation',
      expected: 0,
    },
  });
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
