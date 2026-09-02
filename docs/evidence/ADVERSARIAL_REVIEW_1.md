# Formal Adversarial Review 1

Evidence ID: `E-018`

Review scope: **FULL RELEASE CANDIDATE**

Status: **LOCAL PASS**

## Custody and protocol

- Repository: `focus-contract-studio-package6-premium-surface`
- Review branch: `review/1-local-release-candidate`
- Exact base commit: `68c7cd9ecde2c4dee8f5fc49eaf49e84c1623929`
- Exact base tree: `946e5bfe6d09900a1ea9b27798b0e2f8811b7176`
- Base parent: `0707466f42902b25c1eb8814fd740e07e547f1f8`
- Recheck source-diff SHA-256: `4787cf3d7681bd013beb9d8db46ba852121b28a2859860ac7a1b2537e713a978`
- Final candidate commit: `TERMINAL_POST_COMMIT`
- Initial reviewer count: `3`
- Final recheck reviewer count: `3`
- Same reviewer identities: `PASS`
- Initial reviewers: /root/r1_authority_security, /root/r1_webmcp_evidence, /root/r1_ux_accessibility
- Final recheck reviewers: /root/r1_authority_security, /root/r1_webmcp_evidence, /root/r1_ux_accessibility

[Empirical] The root agent was the only writer. Each lane was read-only. The
post-recheck edits are limited to recording the returned dispositions and
regenerating deterministic evidence; the canonical verifier binds that final state.

## Finding register

Finding dispositions: `7/7 REMEDIATED`

### FCS-R1-001: REMEDIATED — tracked Gitleaks evidence was platform-specific

- Severity: `P1 / high`
- Evidence and failure path: `scripts/package8-release-checks.mjs` projected the
  runtime `executable_sha256` into tracked
  `.artifacts/security/release-security.json`. CI installs a checksum-pinned Linux
  executable while the tracked artifact held the local macOS/Homebrew digest, so
  otherwise identical scans failed with `release-security.json drift`.
- Root cause: a platform-specific runtime identity crossed into a deterministic,
  tracked projection.
- Permanent fix: `buildTrackedGitleaksEvidence` binds the required version, policy
  hashes, command and scope identities, exit statuses, findings, and planted-negative
  rejection without the executable digest. The ignored live receipt remains the sole
  executable-identity record, and its validator still requires a 64-hex digest.
- Preserved controls: CI archive checksum and runtime version validation; exact
  current-tree content scan; reachable `--all` history scan; forced policy and empty
  ignore file; planted-negative rejection.
- [RED] The new regression first failed `9/10` because the platform-independent
  projection did not exist, then failed `9/10` because the old tracked artifact still
  contained `executable_sha256`.
- [GREEN] `tests/package8-node/package8-scripts.test.ts` passed `10/10` at repair
  time; two different valid executable hashes now yield deeply equal tracked
  projections. The complete Package 8 Node gate later passed `14/14`.

### FCS-R1-002: REMEDIATED — active-variant mutation bypassed admission and idempotency

- Severity: `P2 / correctness-material medium`
- Evidence and failure path: `app/api/active-variant/route.ts` called a bare
  view-state CAS. An authenticated anonymous workspace could alternate variants for
  unbounded D1 writes, and a lost response had no replay receipt.
- Root cause: variant selection predated Package 8 mutation-family admission and was
  omitted from both the route inventory and durable audit-finalizer trigger.
- Permanent fix: the strict input now requires a UUID idempotency key. A recovery-first
  server operation uses a canonical request hash; immutable
  `variant_selection_commits`; unique workspace/key and workspace/revision guards; a
  three-statement D1 batch for commit, CAS update, and success audit; and the audit
  finalizer consumes the workspace-scoped `variant` quota in the same transaction.
  Replay precedes admission, conflict fails closed, a race recovers, and any downstream
  failure rolls back state, commit, audit, and admission together.
- [RED] TDD exposed the missing key and route inventory; the first D1 integration
  harness could not exercise the object-shaped operation (`db.prepare is not a
  function`) until the production API and tests converged on the guarded operation.
- [GREEN] Domain `4/4`, route `3/3`, admission wiring `1/1`, Package 8 D1 `14/14`,
  and built-browser behavior `4/4` pass. Saturation stops at 12 without another
  write, identical replay spends one unit, conflicting payloads fail, and injected
  downstream failure leaves all four durable counts unchanged.

### FCS-R1-003: REMEDIATED — source/evidence binding was stale

- Severity: `P1 / high`
- Evidence and failure path: the tracked source manifest and checkpoint markers still
  described pre-repair bytes, so canonical source/evidence verification rejected the
  candidate.
- Root cause: repaired source and tests had not yet been added to the exact inventory
  or passed through the record flow.
- Permanent fix: the inventory now covers exactly all 78 Package 7-to-candidate source,
  documentation, configuration, and test paths while excluding only declared evidence
  outputs. The Review 1 checker, submission validator, source manifest, local gate,
  checkpoint markers, and evidence binding all fail closed on drift.
- [RED] The source/evidence regression initially failed on the absent Review 1
  validator and the stale manifest.
- [GREEN] The exact-inventory regression passes `78/78`; final artifacts are
  regenerated only after all three reviewer dispositions exist and are verified by
  `verify:package8:source-binding`, `verify:review1:disposition`, and
  `verify:package8:evidence-binding` in the canonical gate.

### FCS-R1-004: REMEDIATED — recorded test totals were stale

- Severity: `P2 / correctness-material medium`
- Evidence and failure path: evidence still claimed Package 8 Node `13/13` and total
  `523/523` after the cross-platform regression was added; the active-variant repair
  also added two D1 tests.
- Root cause: hard-coded release totals were not updated with the new executable tests.
- Permanent fix: the local-gate producer and validator require Node `14`, D1 `14`,
  inherited `482`, seed `7`, memory `5`, browser `4`, and exact total `526`.
- [RED] The updated validator rejects the former `13`, `12`, and `523` values.
- [GREEN] Fresh focused results match `14/14` Node and `14/14` D1; the canonical
  recorded total is `526/526`.

### FCS-R1-005: REMEDIATED — draft submission metadata overstated deployment and reviews

- Severity: `P2 / correctness-material medium`
- Evidence and failure path: `.devpost-hackathon-state.json` said Codex performed
  deployment and two adversarial passes while execution truth marked deployment and
  Review 1 `NOT_RUN`.
- Root cause: aspirational workflow copy was stored as if already executed.
- Permanent fix: the draft now says deployment is pending explicit authorization and
  evidence and Review 2 is pending. A strict validator binds that exact copy to draft
  stage, deployment `NOT_RUN`, and completed local Review 1.
- [RED] The negative regression rejects the former deployment/two-review claim.
- [GREEN] The truthful draft claim passes while deployment remains `NOT_RUN`.

### FCS-R1-006: REMEDIATED — confirmation Cancel lost keyboard focus

- Severity: `P2 / correctness-material medium`
- Evidence and user path: confirmation focus moved to the destructive confirm button,
  but Cancel unmounted that panel without returning focus to its initiator.
- Root cause: the inline confirmation had focus entry but no connected return target.
- Permanent fix: `beginMutation` captures the invoking element; closing confirmation
  restores it only if it remains connected. Receipt wording is separately corrected
  from `Cancel` to `Close receipt`.
- [RED] The DOM regression initially failed because the Approve initiator did not
  regain focus; the first browser assertion also revealed an ambiguous non-exact
  `Cancel` locator.
- [GREEN] The exact accessible-name journey opens confirmation with Enter, verifies
  focus on Confirm, cancels with Enter, and verifies focus on Approve in both DOM and
  built Chromium. DOM passes `4/4`; the built-browser suite passes `4/4`.

### FCS-R1-007: REMEDIATED — DPR emulation was mislabeled as true 200% browser zoom

- Severity: `P2 / correctness-material medium`
- Evidence and user path: tests used device-metrics emulation to produce a 640-CSS-pixel
  viewport at DPR 2 but called it `true 200% zoom`, which exceeded what the automation
  proved.
- Root cause: responsive viewport/DPR evidence and browser-UI zoom evidence were
  conflated.
- Permanent fix: tests, visual manifests, scripts, and Package 6 evidence consistently
  name the automated profile `640 CSS px at DPR 2`; true browser UI 200% zoom is
  explicitly retained as `NOT_RUN`.
- [RED] The review traced the old label to device-metrics override rather than browser
  UI zoom.
- [GREEN] Responsive 320, 375, and 640-CSS-pixel/DPR-2 journeys pass with keyboard
  focus, reflow, pointer targets, and Axe checks without making a zoom claim.

## Independent final recheck

[Empirical] The authority/security lane returned `FINAL RECHECK PASS` and closed
FCS-R1-002. The WebMCP/evidence lane returned `FINAL RECHECK PASS` and closed
FCS-R1-001, FCS-R1-003, FCS-R1-004, and FCS-R1-005. The UX/accessibility lane
returned `FINAL RECHECK PASS` and closed FCS-R1-006 and FCS-R1-007. No lane reported
a new material finding.

- Unresolved critical: `0`
- Unresolved high: `0`
- Unresolved correctness-material medium: `0`

[Empirical] A sealed Codex Security diff-scan contract
`fcs_review1_diff_20260902_014058z` validated successfully with complete declared
local-diff coverage and zero surviving reportable findings. Its explicit exclusion is
the unauthorized hosted Cloudflare/client-isolation probe.

## Root-observed retest matrix

- Typecheck: `PASS`
- Lint: `PASS`
- Package 8 Node: `14/14 PASS`
- Package 8 atomic D1: `14/14 PASS`
- Active-variant route: `3/3 PASS`
- Package 6 DOM: `4/4 PASS`
- Deterministic seed/reset: `7/7 PASS`
- Memory counterfactual: `5/5 PASS`
- Built Chromium CSP/WebMCP/focus/responsive/Axe journeys: `4/4 PASS`
- Clean numbered migrations: `6/6 PASS`, repeated application `PASS`
- Development benchmark: `12/12 PASS`, forbidden leakage `0`
- Production build: `PASS`
- Live release checks, including Gitleaks tree/history/planted-negative: `16 PASS`
- Exact local canonical total: `526/526 PASS`

## Truth boundary

- Package 8 overall: **BLOCKED**
- Package 0 overall: **INCONCLUSIVE**
- Actual Sites edge client isolation: `NOT_RUN`
- True browser UI 200% zoom: `NOT_RUN`
- Hosted use, supported-client proof, Chrome trace, deployment, holdout, founder-manual evaluation, push, merge, publication, and Devpost: `NOT_RUN`
- Hosted D1 and hosted CI: `NOT_RUN`
- No external action: **YES**
- Exact final commit clean clone: `TERMINAL_POST_COMMIT`

Review 1 is a local release-candidate disposition only. It does not authorize or
claim Package 9, deployment, account access, hosted mutation, push, merge,
publication, or submission.
