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

## Package 9 pre-freeze addendum

This addendum records five gaps found after Review 1 and before the local Package 9
freeze. It does not reopen or renumber the original `7/7 REMEDIATED` Review 1
finding register, expand Review 1 beyond `LOCAL PASS`, or authorize an external
action.

### FCS-P9-PF-001: REMEDIATED — standalone evidence binding depended on an ignored receipt

- Severity: `P1 / high`
- Reproduction: a credential-disabled `git clone --no-local --single-branch` of the
  starting Review 1 commit had no ignored runtime receipt, so the documented
  `npm run verify:package8:evidence-binding` command failed with `ENOENT` before it
  could establish live Gitleaks evidence. A pre-existing receipt also did not prove
  that the current Gitleaks executable was still available at exact version `8.30.1`.
- Root cause: receipt acquisition lived only in the wider release-check path, while
  the standalone evidence binder assumed that path had already run. Clean-worktree
  state was recorded and compared instead of being required.
- Permanent fix: the shared evidence helper now performs one live scan only when the
  receipt is absent. When a receipt exists it validates the current executable,
  exact version and executable digest before strictly validating the receipt; it
  never refreshes invalid, stale, malformed, wrong-scope, or finding-bearing evidence.
  Live scans require the exact clean HEAD/tree before and after execution.
- [RED] The fresh-clone reproduction failed on the missing receipt, and focused tests
  initially failed `0/2` because receipt acquisition was absent and dirty tracked
  content was accepted.
- [GREEN] Focused Node regressions pass `2/2`: an absent receipt is acquired once and
  then reused without a second scan; unavailable/wrong-version runtime and dirty
  tracked content fail closed. Exact-commit standalone and canonical clone proof is
  terminal Package 9 evidence.

### FCS-P9-PF-002: REMEDIATED — Package 5 CSS zoom was labeled as browser UI zoom

- Severity: `P2 / correctness-material medium`
- Reproduction: `tests/package5-browser/review-apply-undo.spec.ts` assigns
  `document.documentElement.style.zoom = String(value)`, but its profile and three
  Package 5 evidence documents described the result as 200% browser zoom.
- Root cause: CSS layout zoom and browser-chrome page zoom were treated as equivalent
  evidence even though the automation only exercised page CSS.
- Permanent fix: the current test profile and Package 5 evidence now say
  `CSS zoom 2×`; later DPR-2 responsive evidence remains separately labeled. No
  historical commit or frozen result was rewritten.
- [RED] The claim regression found the old profile name and unsupported evidence
  wording while execution truth already retained browser UI zoom as `NOT_RUN`.
- [GREEN] The claim regression binds the CSS assignment, corrected profile/evidence,
  and execution-state boundary. Actual browser UI 200% zoom remains `NOT_RUN`.

### FCS-P9-PF-003: REMEDIATED — active-variant concurrency lacked direct D1 proof

- Severity: `P2 / correctness-material medium`
- Reproduction: active-variant selection had sequential idempotency and admission
  coverage but no barriered simultaneous requests against real local D1. The API
  contract also omitted the already-required UUID idempotency key and conflict result.
- Root cause: the Package 8 regression matrix did not directly exercise the race
  recovery and losing-CAS branches of this mutation family.
- Permanent fix: three barriered real-D1 tests now cover identical same-key replay,
  conflicting same-key reuse, and different keys racing one expected revision. The
  active-variant contract now documents the required key and fail-closed conflict.
  Production code required no change because its existing recovery-first immutable
  commit, CAS update, audit, and trigger-coupled admission transaction is sound.
- [RED] A deliberate mutation that disabled raced replay recovery made the identical
  request test fail with `PACKAGE9_MUTATION_CHECK_RACED_REPLAY`; the mutation was
  immediately removed.
- [GREEN] The unmodified implementation passes `3/3`: identical requests converge on
  one state mutation, admission unit, commit/audit graph, and deterministic replay;
  conflicting payload reuse returns `IDEMPOTENCY_CONFLICT`; different keys produce
  one winner and one `VIEW_STATE_STALE` loser with no partial durable state.

### FCS-P9-PF-004: REMEDIATED — Package 6 automation docs overstated DPR emulation as browser zoom

- Severity: `P2 / correctness-material medium`
- Reproduction: the live Package 6 browser test used CDP device-metrics override for
  a 640-CSS-pixel viewport at DPR 2, but the active Package 6 specification, plan,
  quickstart, and tasks still described that automated profile as true browser/page
  200% zoom.
- Root cause: FCS-R1-007 corrected the executable test and Package 6 evidence, but the
  four active Spec Kit automation contracts were omitted from that repair and from
  the current Package 8 source inventory.
- Permanent fix: the four active documents now name `640 CSS px at DPR 2 responsive
  emulation`, retain true browser UI 200% zoom as founder-manual `NOT_RUN`, and are
  bound into the current source manifest. A focused claim regression ties those
  statements to the actual CDP profile and rejects unqualified automated zoom claims.
- [RED] The new focused regression failed `0/1` on
  `specs/004-package-6-premium-accessible-surface/spec.md` because the required DPR
  emulation label and manual boundary were absent.
- [GREEN] The same focused regression passes `1/1` after the four-document repair;
  Playwright remains accurately scoped to responsive emulation and actual browser UI
  200% zoom remains founder-manual `NOT_RUN`.

### FCS-P9-PF-005: REMEDIATED — controlling release docs overstated responsive emulation as browser zoom

- Severity: `P2 / correctness-material medium`
- Reproduction: the controlling test strategy, traceability matrix, implementation
  plan, and accessibility contract still placed 200% zoom inside Playwright or
  automated proof. The current build checklist repeated the same attribution in its
  verification line, although the executable profile is 640 CSS px at DPR 2.
- Root cause: the PF-004 repair closed the active Package 6 specifications but did
  not include the imported controlling release-proof documents in the current
  source inventory or claim-truth regression.
- Permanent fix: the five current automated-proof statements now name `640 CSS px at
  DPR 2 responsive emulation` and explicitly preserve actual browser UI 200% zoom as
  a founder-manual release requirement that is `NOT_RUN` until completed against the
  exact deployed version. Manual requirements and frozen historical descriptions
  remain unchanged.
- [RED] The focused release-control regression failed `0/1` on
  `docs/quality/TEST_STRATEGY.md` because its automated browser row lacked the DPR
  description and deployed-version manual boundary.
- [GREEN] The same regression passes `1/1` across the four named controlling
  documents plus the one additional current checklist verification statement, and
  rejects any remaining unqualified 200%-zoom claim inside those automated-proof
  surfaces.

Package 9 addendum finding dispositions: `5/5 REMEDIATED`.

### Package 9 addendum independent review

- Release/evidence/security reviewer `/root/release_evidence_security`: `PASS`
- Concurrency/UX/claim-truth reviewer `/root/concurrency_ux_claim`: `PASS`
- Unresolved critical: `0`
- Unresolved high: `0`
- Unresolved correctness-material medium: `0`

Both reviewers were read-only; root remained the sole writer. The reviewers
independently inspected the exact 18-path PF-001-through-PF-003 precommit overlay;
root separately verified that earlier overlay in a clean disposable no-local clone.
That record predates PF-004. The two reviewers found no unresolved material issue and
preserved the external/manual `NOT_RUN` boundaries for their reviewed scope.

### Package 9 PF-004 reseal independent review

- Zoom/claim-truth reviewer `/root/p9_zoom_claim_review`: `PASS`
- Release/evidence-binding reviewer `/root/p9_release_binding_review`: `PASS`
- Reviewed repair overlay: exactly `12` paths against starting candidate
  `eb2966036982dc5c1a4900748157800c33ac4bf7`
- Bound source identity: `87` files,
  `6a73fcad8a4d2327b1cdb707cfc269da985d076238fd5a41a38cc168b560a484`
- Unresolved critical: `0`
- Unresolved high: `0`
- Unresolved correctness-material medium: `0`

Both PF-004 reviewers were read-only; root remained the sole writer. The claim lane
traced the CDP device-metrics implementation against all four corrected active docs
and the focused regression. The release lane checked the exact source inventory,
generated artifacts, source markers, original Review 1 `7/7`, then-current Package 9
`4/4`, and
the prior-versus-current review provenance boundary. Root independently ran the
focused RED/GREEN proof, typecheck, lint, source binding, and Review 1 disposition
checks. No reviewer authorized or claimed an external or founder-manual action.

### Package 9 PF-005 reseal independent review

- Release-control claim-truth reviewer `/root/p9_pf005_claim_review`: `PASS`
- Release/evidence-binding reviewer `/root/p9_pf005_binding_review`: `PASS`
- Reviewed repair overlay: exactly `13` paths against starting candidate
  `399eab07ba9967cb449ac4911bb27ef830e6cd6a`
- Bound source identity: `92` files,
  `1008a681da01e4dc14953577b69e5da85ee1e1f56536683c8f2c842c3261b644`
- Prior ignored runtime receipt: bound to earlier unpublished candidate
  `eb2966036982dc5c1a4900748157800c33ac4bf7`; exact post-amend reacquisition
  required
- Unresolved critical: `0`
- Unresolved high: `0`
- Unresolved correctness-material medium: `0`

Both PF-005 reviewers were read-only; root remained the sole writer. The claim lane
checked the executable CDP profile, the four required controlling documents, the one
additional current checklist verification statement, the focused regression, and
the manual/historical preservation boundary. The release lane checked the exact
source inventory and artifacts, source markers, PF-005 RED/GREEN proof, original
Review 1 `7/7`, Package 9 `5/5`, canonical `531/531`, and the ignored-receipt refresh
design. No reviewer authorized or claimed browser-UI zoom, deployment, or another
external/manual action.

### Package 9 addendum root-observed retest matrix

- Standalone evidence acquisition regressions: `2/2 PASS`
- Zoom/contract claim regression: `1/1 PASS`
- Package 6 DPR/documentation claim regression: `1/1 PASS`
- Release-control DPR/documentation claim regression: `1/1 PASS`
- Simultaneous active-variant D1 regressions: `3/3 PASS`
- Typecheck and lint: `PASS`
- Package 8 Node core: `16/16 PASS`
- Package 8 atomic D1: `17/17 PASS`
- Deterministic seed/reset: `7/7 PASS`
- Memory counterfactual: `5/5 PASS`
- Built Chromium CSP/WebMCP/focus/responsive/Axe journeys: `4/4 PASS`
- Live release checks, including Gitleaks tree/history/planted-negative: `16 PASS`
- Source manifest: `92/92` files bound
- Exact local canonical total: `531/531 PASS`
- Explicit production build after the canonical gate: `PASS`
- Clean precommit no-local snapshot and non-ignored residue check: `PASS`
- Exact final commit clean clone: `TERMINAL_POST_COMMIT`

## Package 9 Sites migration-packaging hotfix addendum

This addendum is limited to the local Sites migration-packaging repair based on
`825f7ee012d0ab7c59f95ca62581ad5b5e5c28b2`. It preserves the preceding evidence
byte-for-byte and does not alter Package 8's external or manual truth boundaries.

<!-- package9-migration-source-binding files=12 sha256=228ec8e487debc6b4cdada52ff16c56dcf74b1db8e655ab9c942842ff4f3c49d -->

### Root cause and repair

- The installed Drizzle loader read only the three journaled files and split them
  only on literal `--> statement-breakpoint` markers. The six SQL files contained
  `178` top-level SQLite statements but no markers, so each journaled file was
  emitted as one incomplete multi-statement chunk for the Sites execution shape.
- The journal now closes exactly over the unchanged migration names 0001 through
  0006 in monotonic order. Exactly `172` markers separate the `178` parser-confirmed
  top-level statements; no marker is inside a trigger, `CASE`, comment, or string.
- Removing only those markers restores the six starting SQL files to their exact
  SHA-256 identities. No schema statement, migration name/order, runtime route, or
  dependency changed.

### Root-observed evidence

- Focused RED: `1/4 PASS`, `3/4 FAIL`; the installed loader exposed only three
  migrations and emitted migration 0001 as one chunk instead of 99 statements.
  The fresh-D1 test separately failed `0/1` on the same three-versus-six closure.
- Focused GREEN: `5/5 PASS` across four loader/journal/parser/archive checks and one
  real local D1 application/rerun check.
- Clean D1: `6/6 PASS`, repeated application `PASS`.
- Pre-commit inherited Package 0-through-8 gates, typecheck, lint, offline audits,
  production build, and built Chromium checks: `PASS`.
- Archive identity: `PASS`; the seven corrected migration inputs in `drizzle/` and
  `dist/.openai/drizzle/` have the same aggregate SHA-256
  `dc3e6e6c8dedcf8b493069b13061e8a190542cf9b823a83d41d2fbe6b5953fbd` over
  `path`, byte length, and bytes.
- Final clean-commit canonical: `TERMINAL_POST_COMMIT`.

### Independent review

- Correctness reviewer `/root/migration_correctness_review`: `PASS` after an initial
  P1 canonical-binding and P2 evidence finding were remediated with this exact
  Package 9 overlay/source binder and addendum.
- Security/data-integrity reviewer `/root/migration_security_review`: `PASS` on
  initial migration review and expanded source/evidence-binding recheck; no material
  finding.
- Root remains the only writer. Both reviewers are read-only.

### Truth boundary

- Hosted D1: `NOT_RUN`.
- Saved Sites version, deployment, supported-client proof, push, tag, merge, GitHub
  Release, Package 10, publication, and Devpost: `NOT_RUN`.
- No external action: **YES**.

## Package 9 Sites migration-boundary descendant hotfix addendum

This descendant is limited to the local migration-boundary defect proven after
`a665be3ddcf0d2ebac0c07c4aedc857a10624660`. It preserves every preceding byte of
this evidence file, migration names 0001 through 0006, journal order, application
code, hosting configuration, dependencies, and all external/manual truth
boundaries.

<!-- package9-migration-boundaries-r3-source-binding files=4 sha256=d3ccd663c7614d276e5ffe95ea31ced228533280f8d574bed0f64a23ab1c4a50 -->

### Root cause and minimal repair

- Migration 0006 has one table and six top-level triggers, but Drizzle emitted five
  chunks. Its fifth chunk combined `trg_package8_admit_audit_mutation`,
  `trg_package8_admit_rehearsal_start`, and
  `trg_package8_admit_rehearsal_finalize`.
- Wrangler 4.116.0 closes a compound block only when its accumulated text ends in
  `END;` or `END` plus whitespace. The inner `CASE` token `END,` therefore remained
  open and hid the next two trigger boundaries from the parser.
- The only SQL-source delta is `END,` to `END ,` plus one literal
  `--> statement-breakpoint` immediately after each of the first two admission
  trigger endings. Removing breakpoint comments and insignificant whitespace makes
  the prior and current SQL token streams byte-identical.
- Migration totals: `180` top-level statements and `174` breakpoints. Migration
  0006 now emits exactly seven chunks, each containing exactly one expected named
  table/trigger definition.

### Hash provenance and archive identity

- Historical migration 0006 full-file SHA-256:
  `ede4971b27cd93a417bd9147d236f9b53b329fd2a5124b63c61da9d1163889a5`.
- Historical migration 0006 SQL-without-breakpoints SHA-256:
  `ce66bc2568669742c1ac7be7c26b9ac51c7aedd02fb2eb321df62829d876c167`.
- Historical Package 9 source binding and archive aggregate remain unchanged above:
  `228ec8e487debc6b4cdada52ff16c56dcf74b1db8e655ab9c942842ff4f3c49d`
  and `dc3e6e6c8dedcf8b493069b13061e8a190542cf9b823a83d41d2fbe6b5953fbd`.
- Current migration 0006 full-file SHA-256:
  `419ba2f2bc70dd7eadfc2fddded84a5c44a6742f518b86037c3b4beb9ddc38b2`.
- Current migration 0006 SQL-without-breakpoints SHA-256:
  `3672b158f14ad27a0757abba72f3d9e889f71b8877bf6b68abeca6b7deacd4d7`.
- Archive identity: `PASS`. All seven packaged migration files (six SQL migrations
  plus `meta/_journal.json`) are byte-identical to `drizzle/`; their ordered
  `sha256  bytes  relative-path` manifest SHA-256 is
  `eabe29d3dfdf64edfb54744ab0a5ccebd8d718cbb58222450d8fc3e2c851b3cf`.

### Red-to-green and local verification

- Before the regression, the prior Wrangler-oracle Node suite passed `4/4` and the
  helper-based local D1 test passed `1/1`, demonstrating the blind spot.
- Focused RED: `0/1 PASS`, `1/1 FAIL` with `5 !== 7`.
- Full RED file: `4/5 PASS`, `1/5 FAIL`.
- Focused GREEN: `1/1 PASS` after only the three authorized SQL edits.
- Focused boundary/hash/totals checks: `3/3 PASS`; complete Package 9 migration
  Node suite: `6/6 PASS`.
- Fresh D1: `180/180 PASS`; rerun after a complete successful application executed `0` statements.
  Each migration chunk is executed directly through one
  `database.prepare(statement).run()` call.
- Typecheck, lint, explicit production build, packaged byte checks, Package 8 D1
  `17/17`, seed `7/7`, memory counterfactual `5/5`, clean-D1 rerun, browser `4/4`,
  and offline audits: `PASS`.
- The pre-commit inherited canonical run reached the live Gitleaks step after all
  preceding checks passed, then correctly returned `INCONCLUSIVE` because that step
  requires a clean committed worktree. Final clean-source canonical verification is
  terminal post-commit evidence.

### Independent review

- Correctness reviewer `/root/migration_boundary_correctness_review`: `PASS`.
- Security/data-integrity reviewer `/root/migration_boundary_security_review`: `PASS`
  after both evidence-truthfulness findings were resolved.
- Root is the only writer. Both reviewers are read-only.

### Truth boundary

- Hosted D1: `NOT_RUN`.
- Final clean-commit canonical: `TERMINAL_POST_COMMIT`.
- Saved Sites Version 3 was not retried. No Site version was saved or deployed.
- Push, tag, merge, hosted D1 mutation, Sites access/environment/source changes,
  GitHub Release, Package 10, media, publication, and Devpost: `NOT_RUN`.
- No external action: **YES**.
## Package 9 Sites D1 CASE-parser R4 descendant hotfix addendum

This descendant is limited to the local Cloudflare D1 trigger-parser compatibility
repair based on `814745b3ce44569c61174eb7a413156955cde831`. It preserves every
preceding byte of this evidence file and does not change migration names or order,
application behavior, dependencies, hosting configuration, or any external/manual
truth boundary.

<!-- package9-sites-d1-case-parser-r4-source-binding files=8 sha256=1ca3b470b227f2289a2fc1d1562374b2fd3cf19dd77ddb1e91956978b77fc16c -->

### Public compatibility model and incident boundary

- [Empirical] Cloudflare workers-sdk issue
  [#4727](https://github.com/cloudflare/workers-sdk/issues/4727) documents
  `incomplete input` for a trigger containing an outer unparenthesized
  `SELECT CASE ... END;` and documents `SELECT (CASE ... END);` as the narrow
  compatibility form.
- [Empirical] Wrangler `4.116.0` splits both the public broken and parenthesized
  two-statement fixtures into two chunks locally. Wrangler's current splitter is
  therefore not used as the sole oracle for the historical hosted failure.
- [Empirical — user-provided, not independently accessed] Saved Sites Version 4
  failed once with `incomplete input: SQLITE_ERROR`; the hosted D1 observation
  showed zero user tables. Version 4 was not retried, and this local run did not
  access or mutate hosted D1.

### Minimal semantic-preserving repair

- Repaired outer CASE statements: `42`: 18 in migration 0001, 4 in 0002, 10 in
  0003, 6 in 0004, 0 in 0005, and 4 in 0006.
- Each repair changes only `SELECT CASE ... END;` to
  `SELECT (CASE ... END);`. The token-aware regression derives the expected bytes
  from the exact base commit while ignoring comments and quoted strings, balancing
  parentheses and nested CASE blocks, and leaving every nested CASE unwrapped.
- Added only `drizzle/*.sql text eol=lf` to `.gitattributes`. The packaged scanner
  rejects carriage returns and non-uppercase trigger `BEGIN` tokens and cross-checks
  that every top-level trigger was scanned.
- Migration 0005 bytes and `drizzle/meta/_journal.json` are unchanged; no migration
  name, journal tag/order, or prior commit was rewritten. Runtime/application code,
  dependencies, and hosting configuration are unchanged. The R3
  whitespace/breakpoint provenance and all earlier hashes remain preserved above
  and in the executable regression.

### Current hashes and archive identity

| Migration | Full-file SHA-256 | SQL-without-breakpoints SHA-256 |
| --- | --- | --- |
| 0001 | `8317f107cfe7dc5e1dd8e49cac2c23fc832dbeed2f4dd34e23f8713068b9bdd9` | `987da80aa99ba78e06029e54ab4b161316433d96c34618fc819dba8b07120cf2` |
| 0002 | `8509a40ad83dd9d4595cb154a7cbb00028108fddc85317cf9e223f54747399fd` | `4b8db460bcadafb2919bca3aa4d4b398a47ab4e15d3b3a9525778ffce438f149` |
| 0003 | `f3e59553d7ace92769bfc217d036b4da88c5de8411f692a395c669888d643a86` | `ce49766adf8d08733de39d9c2f863944c562d80c3ac700072da5bdf71db3cb79` |
| 0004 | `d2681c1b0abd68fea35d2c01f3d7a2d2a993b51bc83a286472f78a54f71f44a0` | `1cfc151ced6ee28f063d92df3e5850cc95d2db9b990083e7548c83c3ae0c0477` |
| 0005 | `b57b9e735d945d5ba0be27d6acec22865c005cbfc51b1148a10a0937e83a9f02` | `58fcb6ccdb158c5538b4b26dc6115ef43aef6ee72194683ccfb860476ffd302e` |
| 0006 | `0d1f04cf366e7ff3115c5bf4cbbb4d58ffc61ddc1ad16d839d76df0ba3c15428` | `6bb860cc53e9377bdb59cf63dc04d80821760f7adbc7ab71a049878835f89c17` |

- Archive identity: `PASS`. All six packaged SQL files and
  `meta/_journal.json` are byte-identical to `drizzle/`; their ordered
  `sha256  bytes  relative-path` manifest SHA-256 is
  `902c4fb1f97bb75cfa26549c53e5fb586d0ea618b6172e7ad641e76b2b82febd`.
- Migration totals: `180` top-level statements and `174` breakpoints.

### Red-to-green and local verification

- Public compatibility fixture: `1/1 PASS` for token-safe comment, quoted-string,
  nested-CASE, parenthesized-CASE, and uppercase-`BEGIN` handling.
- Focused RED: `0/2 PASS`, `2/2 FAIL`; the packaged scan reported all 42 hazards
  plus the absent LF rule, and the exact-delta test rejected the five affected SQL
  files.
- Focused GREEN: `2/2 PASS` after only the 42 wrappers and one LF rule.
- Complete migration Node suite: `9/9 PASS`.
- Fresh D1: `180/180 PASS`; rerun after a complete successful application executed `0` statements.
  Every migration statement uses one literal `database.prepare(statement).run()`
  path. The initial restricted-sandbox run could not bind loopback (`EPERM`); the
  authorized local-loopback rerun passed and made no external connection.
- Typecheck, lint, explicit production build, and packaged byte checks: `PASS`.
- Package 8 D1 `17/17`, deterministic seed `7/7`, memory counterfactual `5/5`,
  clean-D1 repeat, development benchmark `12/12`, built Chromium `4/4`, and both
  offline audits with zero vulnerabilities: `PASS`.
- The pre-commit inherited gate passed every preceding stage and then correctly
  returned `INCONCLUSIVE` only at the terminal live Gitleaks step because that step
  requires a clean committed worktree. Three new Node checks raise the expected
  exact clean-commit canonical total from `533` to `536`.

### Independent review

- Correctness reviewer `/root/sites_d1_case_correctness_review`: `PASS` after the
  ambiguous unchanged-migration wording was narrowed to migration 0005 bytes and
  journal/tag/order provenance.
- Security/data-integrity reviewer `/root/sites_d1_case_security_review`: `PASS`
  after optional `SELECT DISTINCT/ALL CASE` scanner bypasses were closed with
  explicit fixtures and the same evidence wording was corrected.
- Root is the only writer. Both reviewer lanes are read-only.

### Truth boundary

- Hosted D1: `NOT_RUN`.
- Saved Sites Version 4: `NOT_RETRIED`.
- Final clean-commit canonical: `TERMINAL_POST_COMMIT`.
- No Site version was saved or deployed. Push, tag, merge, hosted D1 mutation,
  Sites access/environment/source changes, GitHub Release, Package 10, media,
  publication, and Devpost: `NOT_RUN`.
- No external action: **YES**.
