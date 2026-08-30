import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const runbookUrl = new URL(
  '../../docs/evidence/PACKAGE0_EXTERNAL_RUNBOOK.json',
  import.meta.url,
);
const packageUrl = new URL('../../package.json', import.meta.url);

type Stage = {
  actions: string[];
  forbiddenActions: string[];
  id: string;
  preconditions: string[];
  requiredEvidence: string[];
  requiresFreshApproval: boolean;
  stopAfter: string;
};

type Stage4 = Stage & {
  cleanupConfiguration: Record<string, string>;
  hardDisabledConfiguration: { remove: string[] };
  runConfiguration: Record<string, string>;
};

async function loadRunbook(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(runbookUrl, 'utf8')) as Record<
    string,
    unknown
  >;
}

test('the Package 0 runbook gate executes every evidence-plane regression', async () => {
  const packageJson = JSON.parse(await readFile(packageUrl, 'utf8')) as {
    scripts: Record<string, string>;
  };
  assert.equal(
    packageJson.scripts['test:package0:runbook'],
    'node --experimental-strip-types --test tests/package0/external-runbook.test.ts tests/package0/evidence-attribution.test.ts tests/package0/stage1-evidence-validator.test.ts tests/package0/stage1-evidence-binding-verifier.test.ts tests/package0/stage1-live-local-verifier.test.ts tests/package0/stage1-sites-receipt-validator.test.ts',
  );
});

test('Stage 1 has three explicit evidence planes and none claims hosted completion', async () => {
  const runbook = await loadRunbook();
  const contract = runbook.stage1Contract as Record<string, unknown>;
  assert.deepEqual(contract.target, {
    siteName: 'focus-contract-studio-package-0',
    siteSlug: 'focus-contract-studio-package-0',
    branch: 'main',
    createToolFieldMapping: {
      siteName: 'title',
      siteSlug: 'slug',
    },
  });
  assert.deepEqual(contract.consistencyValidator, {
    implementation: 'tests/package0/stage1-evidence-validator.ts',
    manifestSchemaVersion: 3,
    manifestLocation: 'absolute_path_outside_repository',
    manifestPolicy: 'strict_allowlist_non_sensitive_values_only',
    evidenceRunIdRequired: true,
    requiredBeforeStageCompletion: true,
    requiredResult: 'CONSISTENCY_PASS',
    provesOnly: [
      'manifest_schema',
      'checkpoint_order_and_completeness',
      'receipt_reference_shape_and_uniqueness',
      'cross_field_sha_consistency',
    ],
    doesNotProve: [
      'hosted_fact',
      'actual_checkout_state',
      'independent_review',
      'stage_1_completion',
    ],
  });
  assert.deepEqual(contract.liveLocalVerifier, {
    implementation: 'tests/package0/stage1-live-local-verifier.ts',
    receiptSchemaVersion: 2,
    receiptLocation: 'absolute_path_outside_repository',
    requiredPhases: ['PRE_CREATE', 'POST_CREATE'],
    requiredResult: 'LOCAL_VERIFICATION_PASS',
    observedDirectly: [
      'git_rev_parse_head',
      'git_branch_show_current',
      'git_status_porcelain',
      'git_remote_count',
      'hosting_json_project_id_absent_or_valid_nonempty_string_without_value',
      'npm_run_verify_package0_exit_zero',
    ],
    evidenceRunId:
      'pre_create_generates_128_bit_nonsecret_id_post_create_reuses_it',
    postCreationRequirement:
      'record_actual_head_and_valid_project_id_before_push_without_final_manifest_dependency',
  });
  assert.deepEqual(contract.sitesReceiptValidator, {
    implementation: 'tests/package0/stage1-sites-receipt-validator.ts',
    receiptSchemaVersion: 2,
    receiptBundleLocation: 'absolute_path_outside_repository',
    requiredResult: 'RECEIPT_CONSISTENCY_PASS',
    sameEvidenceRunIdRequired: true,
    singleExecutionSurfaceAndOwnerRequired: true,
    independentHashBoundReviewRequired: true,
    provesOnly:
      'sanitized_receipt_schema_cross_field_consistency_and_review_hash_binding',
    doesNotProve:
      'authentication_hosted_fact_provider_fact_or_stage_1_completion',
  });
  assert.deepEqual(contract.finalBindingVerifier, {
    implementation: 'tests/package0/stage1-evidence-binding-verifier.ts',
    receiptLocation: 'absolute_path_outside_repository',
    requiredResult: 'EVIDENCE_BOUND',
    requiredAfterOtherValidators: true,
    rerunsLivePostCreateCheckoutAndPackage0Gate: true,
    maximumEvidenceRunSeconds: 14400,
    maximumFinalBindingLagSeconds: 900,
    binds: [
      'one_nonsecret_evidence_run_id_across_all_planes',
      'six_manifest_references_to_recomputed_exact_receipt_hashes',
      'saved_and_pushed_sha_to_manifest_lineage',
      'manifest_lineage_to_post_create_receipt_and_actual_git_head',
      'ordered_fresh_receipt_and_review_timestamps',
    ],
    doesNotProve:
      'authentication_hosted_fact_provider_fact_or_stage_1_completion_by_itself',
  });
  assert.deepEqual(contract.validationSequence, [
    'validate_sanitized_sites_receipt_bundle',
    'validate_structural_consistency_manifest',
    'run_final_cross_plane_binding_against_actual_checkout',
  ]);
});

test('inventory is an authenticated owner-only exhaustive ChatGPT observation immediately before create', async () => {
  const runbook = await loadRunbook();
  const contract = runbook.stage1Contract as Record<string, unknown>;
  assert.deepEqual(contract.inventoryPreflight, {
    executionSurfaces: ['CHATGPT_DESKTOP', 'CHATGPT_WEB'],
    executionOwner: 'ONE_AUTHENTICATED_CHATGPT_OWNER',
    selectedContextConfirmation:
      'USER_CONFIRMED_IMMEDIATELY_BEFORE_CREATE',
    requestedRole: 'owner',
    requestedPageLimit: 50,
    maximumSupportedPageSize: 50,
    exhaustCursor: true,
    fields: ['title', 'slug'],
    comparison: 'case_insensitive_exact_match',
    requiredCombinedMatchCount: 0,
    maximumSecondsBeforeCreate: 300,
    repeatImmediatelyBeforeCreate: true,
    receiptMustRecord: [
      'authentication_success',
      'page_count',
      'cursor_exhaustion',
      'timestamp_utc',
      'case_insensitive_title_match_count',
      'case_insensitive_slug_match_count',
      'combined_unique_match_count',
    ],
    receiptMustExclude: [
      'account_identifiers',
      'workspace_identifiers',
      'unrelated_site_names',
      'site_identifiers',
      'raw_tool_payloads',
    ],
  });
});

test('repository association, private visibility, and credential handling fail closed', async () => {
  const runbook = await loadRunbook();
  const contract = runbook.stage1Contract as Record<string, unknown>;
  assert.deepEqual(contract.sourceRepository, {
    allowedPushTarget:
      'repository_identified_by_source_repository_credential_nested_in_same_create_site_response_only',
    associationEvidence:
      'same_create_site_response_nested_source_repository_credential',
    privateVisibilityEvidence:
      'authoritative_sites_or_provider_evidence_required',
    onMissingOrAmbiguousPrivacyEvidence: 'INCONCLUSIVE_AND_STOP',
    defaultBranch: 'main',
    credentialHandling: {
      boundary: 'protected_connector_and_in_memory_only',
      gitAuthorization: 'per_command_http_authorization_header_only',
    },
    forbiddenCredentialExposure: [
      'remote_url',
      'git_configuration',
      'credential_helper',
      'file',
      'shell_history',
      'evidence',
      'logs',
      'commit',
      'user_visible_output',
    ],
    forbiddenRepositoryActions: [
      'invent_a_remote',
      'select_an_existing_or_unrelated_remote',
      'overwrite_or_persist_a_remote',
      'push_before_authoritative_private_visibility_evidence',
    ],
  });
});

test('save-only proof uses observable facts and never an unsupported numerical deployment count', async () => {
  const runbook = await loadRunbook();
  const contract = runbook.stage1Contract as Record<string, unknown>;
  assert.deepEqual(contract.deploymentObservation, {
    authoritativeNumericalDeploymentCountAvailable: false,
    numericalDeploymentCountClaim: 'PROHIBITED',
    requiredObservableEvidence: [
      'no_deployment_tool_invoked',
      'no_deployment_id_produced',
      'no_deployment_status_produced',
      'saved_version_exists',
      'saved_version_commit_sha_equals_pushed_commit_sha',
      'current_live_url_absent_after_save_only',
    ],
  });
  const assertions = contract.evidenceAssertions as Record<string, unknown>;
  assert.equal('deploymentCount' in assertions, false);
  assert.deepEqual(assertions, {
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
    liveCheckoutBinding: {
      actualHeadCommand: 'git rev-parse HEAD',
      postCreationLineageMustEqualActualHead: true,
      syntheticShaInsufficient: true,
      enforcedBy: 'final_binding_verifier',
    },
    crossPlaneBinding: {
      recomputeAllSixReferencedHashes: true,
      oneEvidenceRunIdAcrossAllArtifacts: true,
      savedPushedManifestPostReceiptAndActualHeadMustMatch: true,
      staleReplayRejected: true,
    },
  });
});

test('Stage 1 ordered checkpoints transfer the whole Sites lifecycle to one authenticated ChatGPT owner', async () => {
  const runbook = await loadRunbook();
  const stage1 = (runbook.stages as Stage[])[0];
  assert.equal(stage1?.id, 'stage-1-create-push-package-save-only');
  assert.deepEqual(stage1.preconditions, [
    'entire_sites_lifecycle_transferred_to_one_authenticated_chatgpt_desktop_or_web_owner',
    'user_confirmed_selected_account_and_workspace_immediately_before_create',
    'approved_target_name_slug_and_branch_match_stage_1_contract',
    'current_head_is_the_approved_stage_1_start_head',
    'branch_is_main',
    'working_tree_is_clean',
    'live_pre_creation_local_verifier_passed_for_exact_current_head',
    'git_has_no_remote',
    'hosting_json_has_no_project_id',
    'authenticated_owner_inventory_used_limit_50_and_exhausted_every_cursor',
    'inventory_has_zero_case_insensitive_exact_title_or_slug_matches',
    'inventory_receipt_was_sanitized_and_independently_reviewed',
    'no_site_has_been_created_for_this_checkout',
  ]);
  assert.deepEqual(stage1.actions, [
    'confirm_selected_account_and_workspace_with_user',
    'run_authenticated_owner_inventory_in_chatgpt_with_limit_50_until_cursor_exhaustion',
    'record_and_independently_review_sanitized_inventory_receipt',
    'create_site_once_with_exact_target_if_and_only_if_all_preconditions_hold',
    'persist_returned_project_id_verbatim_without_recording_its_value',
    'retain_nested_source_repository_credential_only_in_protected_connector_memory',
    'verify_private_visibility_from_authoritative_sites_or_provider_evidence',
    'record_and_independently_review_sanitized_create_and_repository_receipt',
    'commit_project_id_source_change',
    'run_post_creation_live_local_verifier_before_push_without_final_manifest_dependency',
    'push_main_with_per_command_http_authorization_only',
    'package_exact_post_creation_head',
    'save_version_with_exact_post_creation_head_commit_sha',
    'observe_saved_version_commit_and_current_live_url_without_deploying',
    'record_and_independently_review_sanitized_save_only_receipt',
  ]);
  assert.deepEqual(stage1.forbiddenActions, [
    'perform_sites_lifecycle_from_codex_cli',
    'create_site_without_immediate_user_confirmed_account_and_workspace',
    'create_site_when_inventory_is_incomplete_ambiguous_or_has_any_name_or_slug_match',
    'create_site_when_project_id_or_git_remote_already_exists',
    'call_create_site_more_than_once',
    'invent_select_overwrite_or_persist_a_git_remote',
    'push_to_a_repository_not_identified_by_the_same_create_response_credential',
    'push_when_private_visibility_evidence_is_missing_or_ambiguous',
    'expose_source_credential_through_any_forbidden_surface',
    'deploy_saved_version',
    'invoke_or_poll_any_deployment_tool',
    'claim_a_numerical_deployment_count',
    'change_site_access',
    'set_runtime_environment_values',
    'mutate_hosted_d1',
    'run_identity_probe',
    'publish_source_or_site',
  ]);
  assert.deepEqual(stage1.requiredEvidence, [
    'live_pre_creation_local_receipt_for_exact_approved_head',
    'sanitized_authenticated_owner_inventory_receipt_with_limit_50_page_count_cursor_exhaustion_timestamp_and_zero_matches',
    'independent_hash_bound_review_of_inventory_receipt',
    'sanitized_create_receipt_confirming_one_exact_create_and_project_id_persistence_without_value',
    'same_create_response_nested_source_repository_credential_association',
    'authoritative_private_repository_visibility_evidence',
    'sanitized_credential_handling_receipt_with_every_exposure_path_false',
    'independent_hash_bound_review_of_create_and_repository_receipt',
    'live_post_creation_local_receipt_recording_actual_head_and_valid_nonempty_project_id_presence',
    'post_creation_head_private_push_package_and_saved_version_full_sha_equality',
    'sanitized_save_only_receipt_showing_no_deployment_call_id_or_status_and_absent_current_live_url',
    'independent_hash_bound_review_of_save_only_receipt',
    'no_private_identifier_credential_url_or_raw_tool_payload_recorded',
  ]);
  assert.equal(
    stage1.stopAfter,
    'saved_version_observed_without_deployment_operation_and_with_live_url_absent',
  );
});

test('later Package 0 stages still separate observation, identity, and bounded D1 mutation', async () => {
  const runbook = (await loadRunbook()) as {
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
