import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const repositoryUrl = new URL('../../', import.meta.url);
const historicalCommit = '382a4d1ef02cf437bd765602c55ac0fc0d43146c';

test('tracked local-gate artifacts are explicit historical evidence with measurements preserved', async () => {
  const runbook = JSON.parse(
    await readFile(
      new URL('docs/evidence/PACKAGE0_EXTERNAL_RUNBOOK.json', repositoryUrl),
      'utf8',
    ),
  ) as Record<string, unknown>;
  const localGate = JSON.parse(
    await readFile(
      new URL('.artifacts/test/package0-local-gate.json', repositoryUrl),
      'utf8',
    ),
  ) as Record<string, unknown>;
  const cleanCheckout = JSON.parse(
    await readFile(
      new URL('.artifacts/test/package0-clean-checkout.json', repositoryUrl),
      'utf8',
    ),
  ) as Record<string, unknown>;
  const localRequest = JSON.parse(
    await readFile(
      new URL('.artifacts/test/package0-local-request.json', repositoryUrl),
      'utf8',
    ),
  ) as Record<string, unknown>;
  const localBrowser = JSON.parse(
    await readFile(
      new URL(
        '.artifacts/browser/package0-local-browser.json',
        repositoryUrl,
      ),
      'utf8',
    ),
  ) as Record<string, unknown>;

  for (const artifact of [
    localGate,
    cleanCheckout,
    localRequest,
    localBrowser,
  ]) {
    assert.equal(artifact.evidence_scope, 'HISTORICAL_LOCAL');
    assert.equal(artifact.verified_source_commit, historicalCommit);
    assert.equal(artifact.is_current_head_evidence, false);
    assert.equal(artifact.current_head_must_be_reverified, true);
    assert.equal(artifact.result, 'PASS');
  }

  assert.deepEqual(runbook.evidenceAttribution, {
    trackedArtifacts: [
      '.artifacts/test/package0-local-gate.json',
      '.artifacts/test/package0-clean-checkout.json',
      '.artifacts/test/package0-local-request.json',
      '.artifacts/browser/package0-local-browser.json',
    ],
    evidenceScope: 'HISTORICAL_LOCAL',
    verifiedSourceCommit: historicalCommit,
    isCurrentHeadEvidence: false,
    currentHeadVerificationPolicy:
      'record_post_commit_verification_outside_the_repository',
    selfReferentialCommittedHeadClaimProhibited: true,
  });

  assert.deepEqual(localGate.checks, {
    typecheck: 'PASS',
    lint: 'PASS',
    authority_import_tests: 1,
    webmcp_tests: 6,
    hosted_handler_tests: 11,
    d1_tests: 10,
    cloudflare_vitest_tests: 1,
    build: 'PASS',
    runtime_audit_vulnerabilities: 0,
    complete_graph_critical: 0,
    complete_graph_high: 0,
    complete_graph_moderate_local_only: 4,
  });
  assert.equal(cleanCheckout.source_commit, historicalCommit);
  assert.deepEqual(cleanCheckout.commands, {
    npm_ci: 'PASS',
    npm_run_verify_package0: 'PASS',
    minimal_worker_request: 'PASS',
  });
  assert.deepEqual(cleanCheckout.clone, {
    path: '<TEMP_DIRECTORY>/fcs-package0-clean-verify.vVEKDq',
    mode: 'git clone --no-hardlinks',
    branch: 'main',
    status_after_verification: 'clean',
  });
  assert.deepEqual(cleanCheckout.minimal_worker_request, {
    target: 'http://127.0.0.1:4174/',
    request_count: 1,
    status: 200,
    body_bytes: 28522,
    expected_content: [
      'Focus Contract Studio',
      'Package 0',
      'D1 probe locked',
      'Finalize D1 cleanup',
    ],
    header_sha256:
      'd8b9d91143690da2d090467586c11058b32dfa1b75589b205ad3dc64354c22e1',
    body_sha256:
      'a7b5f8584098b3f50d79b2526abde88605efd03f6cf771c049d7f05436634d8e',
  });
  assert.equal(localRequest.body_bytes, 28522);
  assert.equal(
    localRequest.body_sha256,
    'cd50cde388e96c2c0e1bc25db3a394bc15f1079e086366a48501c43ae456083f',
  );
  assert.deepEqual(localBrowser.checks, {
    desktop_1280x720_visual: 'PASS',
    mobile_320x568_reflow_and_scroll: 'PASS',
    mobile_max_scroll_css_px: 361,
    mobile_status_bottom_at_max_scroll_css_px: 507,
    semantic_heading_region_button_checkbox_status_snapshot: 'PASS',
    keyboard_arm_and_control_focus_order: 'PASS',
    ordinary_browser_webmcp_fallback: 'PASS',
    probe_cookie_clear_by_keyboard: 'PASS',
    local_spoof_is_explicit_failure: 'PASS',
    d1_finalization_control_reachable: 'PASS',
    console_after_final_normal_journey: 'PASS',
  });
});

test('product evidence distinguishes historical tracked proof from post-commit current-HEAD proof', async () => {
  const [bootstrap, hardening] = await Promise.all([
    readFile(
      new URL('docs/evidence/BOOTSTRAP_PROBES.md', repositoryUrl),
      'utf8',
    ),
    readFile(
      new URL('docs/evidence/PACKAGE0_SECURITY_HARDENING.md', repositoryUrl),
      'utf8',
    ),
  ]);

  assert.match(
    bootstrap,
    /historical local evidence[^\n]+not current HEAD[^\n]+382a4d1ef02cf437bd765602c55ac0fc0d43146c/i,
  );
  assert.match(
    hardening,
    /post-commit verification[^\n]+outside the repository/i,
  );
});

test('Markdown evidence separates consistency, live checkout proof, and reviewed Sites receipts', async () => {
  const [runbook, bootstrap, hardening] = await Promise.all([
    readFile(
      new URL('docs/evidence/PACKAGE0_EXTERNAL_RUNBOOK.md', repositoryUrl),
      'utf8',
    ),
    readFile(
      new URL('docs/evidence/BOOTSTRAP_PROBES.md', repositoryUrl),
      'utf8',
    ),
    readFile(
      new URL('docs/evidence/PACKAGE0_SECURITY_HARDENING.md', repositoryUrl),
      'utf8',
    ),
  ]);

  assert.match(
    runbook,
    /no standalone Codex CLI management view[\s\S]+ChatGPT desktop or web/i,
  );
  assert.match(
    runbook,
    /structural manifest consistency[\s\S]+CONSISTENCY_PASS[\s\S]+never hosted or Stage 1 completion/i,
  );
  assert.match(
    runbook,
    /live local Git\/hosting verification[\s\S]+actual `git rev-parse HEAD`[\s\S]+Package 0 verification/i,
  );
  assert.match(
    runbook,
    /PRE_CREATE[^\n]+128-bit non-secret evidence run ID[\s\S]+POST_CREATE[^\n]+reuses/i,
  );
  assert.match(
    runbook,
    /POST_CREATE[^\n]+valid non-empty string[^\n]+without recording its value/i,
  );
  assert.match(
    runbook,
    /independently reviewed[\s\S]+sanitized Sites-tool receipts/i,
  );
  assert.match(
    runbook,
    /maximum supported page size[^\n]+50[\s\S]+cursor exhaustion[\s\S]+case-insensitive exact/i,
  );
  assert.match(
    runbook,
    /user-confirmed selected account\/workspace[\s\S]+immediately before `create_site`/i,
  );
  assert.match(
    runbook,
    /no deployment tool was invoked[\s\S]+no deployment ID or status[\s\S]+current live URL remains absent/i,
  );
  assert.match(
    runbook,
    /never claim a numerical deployment count/i,
  );
  assert.match(
    runbook,
    /same authoritative `create_site` response[\s\S]+authoritative Sites or provider evidence[\s\S]+INCONCLUSIVE/i,
  );
  assert.match(
    runbook,
    /forbidden in URLs, Git configuration, credential helpers, files, shell history, evidence, logs, commits, and user-visible output/i,
  );
  assert.match(
    runbook,
    /final cross-plane binding[\s\S]+recomputes all six[\s\S]+actual checkout HEAD[\s\S]+15 minutes/i,
  );
  assert.match(
    runbook,
    /post-create local receipt[^\n]+before push[^\n]+does not require the not-yet-created final manifest/i,
  );

  assert.match(
    bootstrap,
    /Read-only pre-Stage-1 owner inventory[^\n]+limit `50`[^\n]+zero items[^\n]+INCONCLUSIVE[^\n]+not Stage 1 proof or authorization/i,
  );
  assert.match(
    hardening,
    /Stage 1 evidence contract hardening[\s\S]+runtime product behavior was not changed/i,
  );
});
