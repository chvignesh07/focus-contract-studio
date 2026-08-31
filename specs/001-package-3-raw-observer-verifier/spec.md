# Feature Specification: Package 3 Raw Observer and Independent Verifier

**Feature Branch**: `feat/package-3-raw-observer-verifier`
**Created**: 2026-08-30
**Status**: Clarified — Prompt B complete
**Input**: Package 3 raw observer and independent verifier, derived only from controlling Focus Contract Studio authority; no product implementation, plan, tasks, external action, or new founder decision.
**Authority Baseline**: `docs/evidence/spec-kit/PACKAGE3_AUTHORITY_BASELINE.json`
**Authority Baseline SHA-256**: `eb2491238f82111a1cee3121a0276d2d7c748a771856659318409b57d61aaed0`
**Authority Baseline Commit**: `cb75d76e0cfd91534e27ea1ce6a2f192423d99c7`

This specification is a derived flow-forward record. Root `AGENTS.md`,
`START_HERE.md`, and its complete mandatory read order remain controlling. A
conflict, omission, or hash drift blocks later Spec Kit work; this file cannot
amend or reinterpret product authority.

Persisted Prompt B paths use only `<REPOSITORY_ROOT>` and
`<PLANNING_WORKSPACE>`. The Prompt B validator resolves those aliases solely
from its required runtime arguments and never persists the resolved paths.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capture a Real, Privacy-Bounded Rehearsal (Priority: P1)

As an accessibility or design-system lead, I need the product to record what
the active Delete Account dialog actually did during one bounded keyboard
rehearsal so later verification is based on real behavior rather than a
generated story.

**Why this priority**: Independent verification has no trustworthy input unless
the observation is real, revision-bound, immutable, and free of typed content.

**Independent Test**: Start and complete the authority-defined keyboard
rehearsal against one active variant, then inspect the finalized manifest and
ordered events. The record contains only allowlisted target identifiers and
behavior metadata, matches the exact workspace/variant/revision, respects all
bounds, and cannot be changed after finalization.

**Acceptance Scenarios**:

1. **Given** an active rendered dialog and implemented revision, **When** the reviewer completes the exact opening, traversal, wrapping, Escape, and return-focus sequence, **Then** one finalized session contains the actual rendered-target manifest, ordered allowlisted events, and immutable manifest/event digests.
2. **Given** a reason field containing a unique sensitive marker, **When** the complete rehearsal is captured, **Then** the marker and all other typed values, arbitrary text, clipboard data, DOM snapshots, and non-allowlisted key content are absent from stored records, logs, errors, and verification output.
3. **Given** an unfinished, over-limit, unknown-target, duplicate-sequence, or out-of-order rehearsal, **When** finalization is requested, **Then** the session cannot become valid verification evidence.
4. **Given** a finalized rehearsal, **When** any caller attempts to append, replace, reorder, or otherwise mutate its manifest or events, **Then** the attempt fails without changing the frozen evidence.

---

### User Story 2 - Verify Six Behaviors Independently (Priority: P1)

As the reviewer, I need each named focus behavior evaluated from the finalized
raw rehearsal and actual rendered manifest so a stored target configuration,
proposal, precedent, or fixture cannot manufacture a passing result.

**Why this priority**: The product's core proof is that observed renderer
behavior can contradict expected or proposed behavior and that all six rules
must be observed before the result passes.

**Independent Test**: Supply an exact positive rehearsal and the named
implemented configuration to `focus-event-verifier-v1`. All six checks pass and
reference raw sequence numbers. Remove or alter one required observation and
the affected check fails or becomes `not_observed`; the overall result fails.

**Acceptance Scenarios**:

1. **Given** a finalized rehearsal whose actual events match the named implemented revision, **When** verification runs, **Then** initial focus, focus order, forward wrap, backward wrap, Escape action, and return focus each pass from explicit evidence sequences and the overall result is `pass`.
2. **Given** any required behavior was not observed, **When** verification runs, **Then** that check is `not_observed` and the overall result is `fail`.
3. **Given** a configuration or expected fixture changes without any change to frozen raw evidence, **When** verification runs, **Then** the frozen evidence does not change and cannot be regenerated to fit the new expectation.
4. **Given** a valid verification result, **When** it is persisted, **Then** one immutable receipt binds the workspace, variant, implemented revision, finalized session, manifest/event digests, verifier version, six results, evidence sequences, and whether that revision was active at verification time.

---

### User Story 3 - Fail Closed on Tamper, Replay, and Isolation Violations (Priority: P2)

As the workspace owner, I need malformed, tampered, stale, foreign, and
conflicting verification attempts to fail without disclosing another
workspace's records or changing authoritative product state.

**Why this priority**: Raw evidence and receipts are security boundaries. A
cross-workspace oracle, conflicting replay, or mutable receipt would make a
correct behavior evaluator unsafe to expose.

**Independent Test**: Run the same invalid request matrix against foreign and
nonexistent opaque identifiers, wrong revision/variant bindings, changed
digests, reordered events, unfinished sessions, and replay conflicts. Each
fails through the existing safe public boundary with no new or modified
receipt and no implemented-configuration mutation; foreign and nonexistent
identifiers remain indistinguishable.

**Acceptance Scenarios**:

1. **Given** a foreign rehearsal ID and a nonexistent rehearsal ID, **When** otherwise identical verification requests are made, **Then** both use the same public not-found code, status, response size class, and timing budget.
2. **Given** a finalized session whose manifest, events, digest, workspace, variant, or revision binding is tampered with, **When** verification is requested, **Then** the request is rejected and produces no success-like receipt or product mutation.
3. **Given** a byte-identical retry for the same session and verifier version, **When** verification is requested again, **Then** the original receipt is returned without a duplicate.
4. **Given** a replay that conflicts with the frozen evidence or prior natural-key request, **When** verification is requested, **Then** it fails closed without changing or replacing the original receipt.

---

### User Story 4 - Audit Behavior and Evidence Accessibly (Priority: P3)

As a reviewer or independent auditor, I need the six outcomes, source sequence
references, privacy proof, planted-divergence results, and exact evidence status
to be inspectable without relying on color, hidden state, or unsupported claims.

**Why this priority**: Package 3 is incomplete unless another reviewer can
reproduce its claims and a keyboard or assistive-technology user can understand
the result.

**Independent Test**: Run the positive, missing-event, seven planted-divergence,
privacy-marker, dependency-boundary, keyboard-browser, and evidence-validator
checks. Every artifact is tied to the exact source identity, every divergence
fails its named rule, no critical/high review issue remains, and no plan or
interrupted check is labeled `PASS`.

**Acceptance Scenarios**:

1. **Given** each of the seven authority-defined behavioral mutations, **When** the verifier evaluates its raw trace, **Then** the named check fails independently and no altered expected-event fixture supplies substitute evidence.
2. **Given** a displayed verification receipt, **When** a keyboard or assistive-technology user reviews it, **Then** all six results and their evidence sequences are available as text, failures are not conveyed by color alone, and `not_observed` is explicitly a failure.
3. **Given** an interrupted, wrong-source, mock-only, or incomplete check, **When** evidence is recorded, **Then** its status is `INCONCLUSIVE`, `NOT_RUN`, or `FAIL` as appropriate and never inferred as `PASS`.

### Edge Cases

- No active dialog, no active variant, no observation session, or no completed observation session exists.
- The dialog closes before the complete rehearsal, the observer is interrupted, or the session exceeds 30 seconds.
- More than 64 events arrive, or an event/target/key/reason falls outside the closed grammar.
- Event sequences are missing, duplicated, reordered, appended after finalization, or paired with a changed manifest.
- The actual tabbable set differs from the configured set, contains an omitted target, or has a different DOM order.
- The first focus event is missing or occurs outside the rendered manifest.
- Tab or Shift+Tab escapes to a background/outside target.
- Escape leaves the dialog open, closes for the destructive action, or lacks a close observation.
- Focus does not return, returns to the wrong target, or no return-focus fact is recorded.
- Workspace, variant, implemented revision, session nonce, manifest digest, event digest, or verifier version does not match.
- A session is foreign, nonexistent, stale for the requested revision, unfinished, expired with its workspace, or already verified.
- A byte-identical retry arrives after a lost response; a later retry uses conflicting frozen evidence.
- A valid complete trace fails one or more behavior rules; this creates a truthful fail receipt, unlike an invalid/tampered request, which creates no verification receipt.
- Rationale, proposal text, precedent, benchmark judgments, expected events, typed form content, hostile strings, or private identity data attempt to enter observation or verifier input/output.
- The verifier or observer gains a forbidden dependency on retrieval, proposal-target construction, benchmark judgments, or expected-event generation.

## Requirements *(mandatory)*

### Scope and Authority Requirements

- **P3-AUT-001**: Package 3 artifacts MUST remain derived from the recorded authority baseline, persist repository and planning-workspace paths only through `<REPOSITORY_ROOT>` and `<PLANNING_WORKSPACE>`, resolve those aliases only from explicit validator runtime arguments, and stop on any manifest, Git-blob, byte-hash, or source-anchor drift before a later Spec Kit command.
- **P3-AUT-002**: Package 3 MUST cover only raw rehearsal observation, independent six-rule verification, immutable verification receipts, and their tests/evidence/documentation; it MUST NOT add retrieval, review authority, apply/undo/reset behavior, precedent projection, tool registration, deployment, or another product scope.
- **P3-AUT-003**: Observation and verification MUST remain evidence operations and MUST NOT approve, authorize, apply, undo, reset, or otherwise change the implemented focus configuration.
- **P3-AUT-004**: Expected configurations, proposal targets, precedent outcomes, model text, benchmark judgments, and test fixtures MUST NOT manufacture, replace, alter, or be reported as actual observed events.
- **P3-AUT-005**: Invalid or unauthorized Package 3 requests MUST fail closed with zero implemented-configuration mutation, zero approval/review mutation, and no success-like receipt.

### Rehearsal and Observation Requirements

- **P3-OBS-001**: Starting a rehearsal session MUST bind it to the server-resolved workspace, active variant, named implemented revision, generated nonce, and bounded environment metadata.
- **P3-OBS-002**: At observation start, the observer MUST capture an actual-DOM allowlisted rendered manifest containing present targets from the closed set `dialog-title`, `reason-input`, `cancel-button`, `delete-button`, and `delete-trigger`; actual tabbable DOM order; dialog role/open/modal/name/description facts; active variant; and implemented revision.
- **P3-OBS-003**: Observation events MUST use only the closed authority grammar: dialog open, focus entry, Tab or Escape keydown with Shift state, dialog close with an allowlisted reason, and focus return, each using an allowlisted stable target ID.
- **P3-OBS-004**: The server MUST assign one monotonic sequence to each accepted event. Client-relative monotonic time MAY be retained only as bounded diagnostic metadata and MUST NOT establish authoritative order.
- **P3-OBS-005**: One complete rehearsal MUST follow the authority-defined order: focus trigger and open; first focus; one forward traversal in configured order; forward wrap; backward wrap; Escape close before destructive dispatch; and focus return to the trigger.
- **P3-OBS-006**: A session MUST accept at most 64 events within at most 30 seconds. Overflow, timeout, unknown targets/events, invalid keys/reasons, duplicates, gaps, or out-of-order sequences MUST make finalization invalid.
- **P3-OBS-007**: Observation MUST store stable identifiers and bounded behavior metadata only. It MUST NOT capture or persist typed values, arbitrary text, rationale, clipboard contents, full DOM snapshots, selectors supplied by callers, or keystroke content beyond allowlisted Tab/Escape and Shift state.
- **P3-OBS-008**: Production observation MUST NOT read proposed/precedent outcomes to generate events, dispatch synthetic focus movements as evidence, import expected-event generators, or decide verification pass/fail.
- **P3-OBS-009**: Successful finalization MUST canonicalize and freeze exactly one rendered manifest and ordered event sequence, record their immutable SHA-256 digests, and prevent every post-finalize change.
- **P3-OBS-010**: Unfinished, invalid, interrupted, expired, or post-finalize-mutated sessions MUST NOT be accepted as verification evidence.
- **P3-OBS-011**: Finalized manifests and events MUST remain immutable while their workspace is retained and MUST follow the workspace lifecycle without creating a separate sensitive-data retention claim.

### Independent Verification Requirements

- **P3-VER-001**: `focus-event-verifier-v1` MUST receive only an immutable finalized manifest, immutable raw events, and the named implemented configuration for the same server-resolved workspace, variant, session, and revision.
- **P3-VER-002**: Verification MUST reject a nonexistent, foreign, unfinished, tampered, wrong-variant, or wrong-revision session before behavior evaluation.
- **P3-VER-003**: The verifier MUST have no import or runtime dependency on retrieval, proposal-target construction, field-evidence support, model logic, benchmark judgments, holdout/reference-evaluator outputs, or any expected-event generator.
- **P3-VER-004**: `initialFocus` MUST pass only when the first `focusin` after `dialog_open` equals the configured initial focus and that target exists in the frozen manifest.
- **P3-VER-005**: `focusOrder` MUST pass only when the first forward traversal from the configured first tabbable target visits every configured target once in exact order before wrap and the frozen manifest's tabbable set equals the configured set.
- **P3-VER-006**: `trapTab` MUST pass only when forward Tab on the configured final target is followed by focus on the configured first target with no outside target.
- **P3-VER-007**: `trapShiftTab` MUST pass only when Shift+Tab on the configured first target is followed by focus on the configured final target.
- **P3-VER-008**: `escapeAction` MUST pass only when Escape while the dialog is open is followed by close reason `escape` and never by close reason `delete`.
- **P3-VER-009**: `returnFocus` MUST pass only when the first focus-return fact after close equals `delete-trigger`.
- **P3-VER-010**: Missing evidence for any named behavior MUST produce `not_observed` for that check; `not_observed` MUST make the overall result `fail`.
- **P3-VER-011**: Overall verification MUST be `pass` only when all six named checks pass; any fail or `not_observed` result MUST make it `fail`.
- **P3-VER-012**: Every behavior result MUST cite the exact raw event sequence numbers that support its result and MUST NOT cite generated expected events.
- **P3-VER-013**: A valid verification MUST create one immutable receipt that binds workspace, variant, implemented revision, finalized rehearsal session, bounded environment metadata, manifest digest, event digest, verifier version, each behavior result/evidence sequence, overall result, verification time, and active-at-verification status.
- **P3-VER-014**: A byte-identical replay for the same natural key of rehearsal session plus verifier version MUST return the original receipt without a second receipt or projection.
- **P3-VER-015**: A conflicting replay for an existing natural key MUST fail without changing, replacing, or duplicating the original receipt.
- **P3-VER-016**: Verification MUST NOT change the implemented focus configuration or create review/approval state. Verified-precedent projection remains outside Package 3.

### Isolation, Integrity, and Privacy Requirements

- **P3-SEC-001**: The server MUST resolve workspace ownership and active subject state; no Package 3 request may select or assert an authoritative workspace.
- **P3-SEC-002**: Every Package 3 repository read and write MUST include the authoritative workspace/variant/revision binding needed to prevent cross-workspace access.
- **P3-SEC-003**: Foreign and nonexistent opaque rehearsal or receipt identifiers MUST return the same relevant public code, status, response-size class, and timing budget.
- **P3-SEC-004**: Manifest/event digest tamper, reordered evidence, changed bindings, and post-finalize mutation attempts MUST be detected and rejected before a success receipt can exist.
- **P3-SEC-005**: Invalid-input, not-found, incomplete, conflict, and internal failures MUST use the existing safe public error envelope and MUST NOT expose stacks, storage details, cookies, subject/workspace identifiers, raw payloads, sensitive marker content, or an existence oracle.
- **P3-SEC-006**: Logs and evidence artifacts MUST contain only safe correlation, operation, result, duration, and non-reversible bounded identifiers; they MUST exclude event arrays, typed values, arbitrary text, raw identity, cookies, tokens, and CSRF material.
- **P3-SEC-007**: A behavior mismatch in otherwise valid frozen evidence MUST produce an immutable fail receipt; a malformed, unauthorized, tampered, or incomplete request MUST produce no verification receipt.
- **P3-SEC-008**: Concurrent or repeated verification for the same natural key MUST preserve exactly one authoritative receipt and deterministic replay behavior.
- **P3-SEC-009**: Every observation, finalization, and verification request MUST enforce the existing request boundary: correct method; JSON content type and bounded body for JSON mutations; strict schema; server-resolved session; same Origin; CSRF for UI mutations; ordinary server authorization for page-bound agent execution; no state-changing GET; validated opaque-ID format before repository access; and `Cache-Control: no-store` on workspace/session/review/receipt responses.
- **P3-SEC-010**: Verification persistence MUST recheck finalized session, immutable manifest/event digests, workspace, variant, implemented revision, verifier version, and natural key inside one guarded atomic write. Preliminary reads are diagnostic only. The immutable receipt, exactly six immutable check records, and safe audit MUST all commit together or none may commit; every required affected-row count MUST be exact, and a zero-row guard/downstream write, finalizer failure, or statement error MUST roll back the full verification write.

### Deliberate Divergence Requirements

- **P3-MUT-001**: A trace whose initial focus is Delete while the named configuration requires Cancel MUST fail `initialFocus`.
- **P3-MUT-002**: A trace that swaps Cancel and Delete in forward traversal MUST fail `focusOrder`.
- **P3-MUT-003**: A rendered manifest that omits one configured tabbable target MUST fail `focusOrder`.
- **P3-MUT-004**: A forward Tab from the configured final target that escapes to the trigger or background MUST fail `trapTab`.
- **P3-MUT-005**: A backward Shift+Tab from the configured first target that escapes MUST fail `trapShiftTab`.
- **P3-MUT-006**: Escape that leaves the dialog open or dispatches Delete MUST fail `escapeAction`.
- **P3-MUT-007**: Close that returns focus to body, title, or any target other than `delete-trigger` MUST fail `returnFocus`.

### Accessibility, Testing, and Evidence Requirements

- **P3-EVD-001**: Positive exact traces MUST cover each supported implemented configuration and prove all six behaviors from raw sequence references.
- **P3-EVD-002**: Missing-event and `not_observed` cases MUST prove that absent evidence cannot pass.
- **P3-EVD-003**: Automated checks MUST cover tampered, reordered, foreign, nonexistent, stale, wrong-variant, wrong-revision, unfinished, expired, overflow, post-finalize mutation, byte-identical replay, conflicting replay, and concurrent natural-key attempts.
- **P3-EVD-004**: A static dependency rule MUST fail if observer/verifier production code imports or otherwise depends on retrieval, proposal-target construction, field-support logic, benchmark judgments, holdout/reference-evaluator outputs, or expected-event generation.
- **P3-EVD-005**: A sensitive-marker test and storage/log/error/output scan MUST prove that typed content, arbitrary text, raw identity/session material, and other prohibited content never enters Package 3 evidence surfaces.
- **P3-EVD-006**: A real-browser keyboard journey and bounded manual keyboard smoke MUST exercise the complete rehearsal. While the dialog is open, the browser journey MUST assert its accessible name, description, and modal semantics and MUST prove background controls reject pointer activation and keyboard focus until close. Mocks, manifest claims alone, or generated event fixtures cannot substitute for this browser evidence.
- **P3-EVD-007**: Any Package 3 result surface MUST expose the dialog semantics captured in the manifest and present all six results, `not_observed`, overall outcome, and evidence sequence references as keyboard-accessible text without relying on color alone or announcing every raw event.
- **P3-EVD-008**: Verifier safety-core branches MUST have 100% branch coverage; remaining first-party Package 3 code MUST meet the repository's applicable line/branch thresholds without weakening assertions.
- **P3-EVD-009**: Package 3 evidence MUST update the applicable registered unit/contracts (`E-006`), D1 integration (`E-007`), component/UI (`E-008`), browser (`E-009`), accessibility automation (`E-010`), verifier-independence (`E-011`), coverage (`E-014`), traceability, and review artifacts with exact source/runtime identity and approved status vocabulary.
- **P3-EVD-010**: An independent review MUST find no unresolved critical/high issue and no missing controlling requirement before Package 3 can later exit implementation.
- **P3-EVD-011**: A specification, mock, local HTTP success, interrupted command, screenshot, or generated expected trace MUST NOT be recorded as passing implementation, browser, accessibility, privacy, security, or verifier evidence.
- **P3-EVD-012**: Route/adapter tests MUST reject wrong method, wrong or missing JSON content type, oversized body, unknown fields, invalid opaque IDs, missing/invalid server session, cross-origin requests, missing/invalid UI CSRF, and state-changing GET; they MUST also prove `no-store` on Package 3 workspace/session/review/receipt responses and ordinary authorization on page-bound agent execution.
- **P3-EVD-013**: Real persistence tests MUST force the verification guard and every receipt/check/audit statement to zero rows or error in turn, including finalizer failure, and MUST prove all verification rows/audits roll back. Positive pass and truthful fail receipts MUST each contain exactly six immutable checks and one safe audit; concurrent same-natural-key attempts MUST leave exactly one complete receipt.

### Key Entities

- **Rehearsal Session (domain observation session)**: Workspace/variant/revision-bound lifecycle record with nonce, bounded environment metadata, recording/finalized state, and immutable evidence digests.
- **Rendered Manifest**: One immutable allowlisted snapshot of actual stable target IDs, actual tabbable order, and dialog semantics for a rehearsal.
- **Observation Event**: One server-sequenced allowlisted dialog/focus/key/close/return fact containing no typed value or arbitrary text.
- **Verification Check**: One of six named behavior evaluations with `pass`, `fail`, or `not_observed` and exact evidence sequence references.
- **Verification Receipt**: Immutable natural-keyed result binding the finalized evidence, named revision/configuration, verifier version, six checks, overall result, and active-at-verification fact.

## Requirement Source Map

Every stable requirement below is anchored to controlling source headings in the
authority baseline. A path/heading change is drift; similar prose elsewhere is
not a substitute.

| Requirement ID | Controlling source path and heading anchor(s) |
|---|---|
| P3-AUT-001 | `AGENTS.md > Scope and authority`; `START_HERE.md > Authority order`; `docs/delivery/SUBMISSION_PLAN.md > Public repository package`; `<PLANNING_WORKSPACE>/docs/delivery/SPEC_KIT_ADOPTION_PLAN_2026-08-30.md > Authority model after adoption`; `<PLANNING_WORKSPACE>/docs/delivery/SPEC_KIT_ADOPTION_PLAN_2026-08-30.md > Gate 3 — Package 3 planning pilot`; adoption baseline receipt |
| P3-AUT-002 | `docs/delivery/CODEX_IMPLEMENTATION_PLAN.md > Package 3 — Raw observer and independent verifier`; `docs/delivery/CODEX_IMPLEMENTATION_PLAN.md > Critical path`; `docs/hackathon-build/scope.md > Explicit non-goals`; `<PLANNING_WORKSPACE>/docs/delivery/SPEC_KIT_ADOPTION_PLAN_2026-08-30.md > Gate 0.5 — One-prompt and authorization protocol`; `<PLANNING_WORKSPACE>/docs/delivery/SPEC_KIT_ADOPTION_PLAN_2026-08-30.md > Gate 3 — Package 3 planning pilot` |
| P3-AUT-003 | `AGENTS.md > Product invariants`; `docs/authority/PRODUCT_TRUTH.md > Authority boundary`; `` docs/contracts/WEBMCP_TOOL_CONTRACT.md > 4. `verify_focus_contract` `` |
| P3-AUT-004 | `START_HERE.md > Non-negotiable product truth`; `docs/authority/PRODUCT_TRUTH.md > Authority boundary`; `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Observer independence` |
| P3-AUT-005 | `AGENTS.md > Product invariants`; `docs/architecture/DOMAIN_MODEL.md > Verification invariant`; `docs/quality/TEST_STRATEGY.md > Critical D1 matrix`; `docs/quality/SECURITY_AND_PRIVACY.md > Security objective` |
| P3-OBS-001 | `docs/architecture/ARCHITECTURE.md > Core flows > Render and observe`; `docs/architecture/DOMAIN_MODEL.md > Entities`; `docs/delivery/CODEX_IMPLEMENTATION_PLAN.md > Package 3 — Raw observer and independent verifier` |
| P3-OBS-002 | `docs/architecture/ARCHITECTURE.md > Core flows > Render and observe`; `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Observer independence`; `docs/architecture/DOMAIN_MODEL.md > Fixed value objects`; `docs/architecture/DOMAIN_MODEL.md > Entities` |
| P3-OBS-003 | `docs/architecture/DOMAIN_MODEL.md > Raw observation grammar`; `docs/hackathon-build/prd.md > PRD-004 — Capture raw behavior` |
| P3-OBS-004 | `docs/architecture/DOMAIN_MODEL.md > Raw observation grammar`; `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Observer independence` |
| P3-OBS-005 | `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Complete rehearsal script`; `docs/product/UX_SPEC.md > Hero interaction > Observe` |
| P3-OBS-006 | `docs/architecture/DOMAIN_MODEL.md > Raw observation grammar`; `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Complete rehearsal script`; `docs/quality/SECURITY_AND_PRIVACY.md > Proposed limits — not confirmed until hosted load tests` |
| P3-OBS-007 | `docs/authority/PRODUCT_TRUTH.md > Authority boundary`; `docs/hackathon-build/prd.md > PRD-004 — Capture raw behavior`; `docs/quality/SECURITY_AND_PRIVACY.md > Threat controls`; `docs/quality/SECURITY_AND_PRIVACY.md > Data inventory and retention` |
| P3-OBS-008 | `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Observer independence`; `docs/architecture/ARCHITECTURE.md > Layer rules`; `START_HERE.md > Stop conditions` |
| P3-OBS-009 | `docs/architecture/ARCHITECTURE.md > Core flows > Render and observe`; `docs/architecture/DOMAIN_MODEL.md > Entities`; `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Observer independence` |
| P3-OBS-010 | `docs/architecture/DOMAIN_MODEL.md > State machines > Observation`; `docs/architecture/DOMAIN_MODEL.md > Verification invariant`; `docs/architecture/ARCHITECTURE.md > Failure behavior` |
| P3-OBS-011 | `docs/architecture/DOMAIN_MODEL.md > State machines > Observation`; `docs/architecture/ARCHITECTURE.md > Data lifecycle and observability`; `docs/quality/SECURITY_AND_PRIVACY.md > Data inventory and retention` |
| P3-VER-001 | `docs/architecture/DOMAIN_MODEL.md > Verification invariant`; `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Verifier v1 rules`; `docs/hackathon-build/spec.md > Components and responsibilities > Independent verifier and history` |
| P3-VER-002 | `docs/architecture/DOMAIN_MODEL.md > Verification invariant`; `docs/contracts/WEBMCP_TOOL_CONTRACT.md > Public errors`; `docs/hackathon-build/prd.md > Edge cases` |
| P3-VER-003 | `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Deliberate mutation tests`; `docs/delivery/CODEX_IMPLEMENTATION_PLAN.md > Package 3 — Raw observer and independent verifier`; `docs/retrieval/RETRIEVAL_AND_RRF_SPEC.md > Purpose and authority`; `docs/retrieval/RRF_BENCHMARK.md > Seal and holdout honesty` |
| P3-VER-004 | `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Verifier v1 rules`; `docs/architecture/DOMAIN_MODEL.md > Verification invariant` |
| P3-VER-005 | `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Verifier v1 rules`; `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Renderer contract` |
| P3-VER-006 | `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Verifier v1 rules`; `docs/hackathon-build/prd.md > PRD-011 — Verify raw rehearsal evidence` |
| P3-VER-007 | `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Verifier v1 rules`; `docs/hackathon-build/prd.md > PRD-011 — Verify raw rehearsal evidence` |
| P3-VER-008 | `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Verifier v1 rules`; `docs/hackathon-build/prd.md > PRD-011 — Verify raw rehearsal evidence` |
| P3-VER-009 | `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Verifier v1 rules`; `docs/hackathon-build/prd.md > PRD-011 — Verify raw rehearsal evidence` |
| P3-VER-010 | `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Verifier v1 rules`; `` docs/contracts/WEBMCP_TOOL_CONTRACT.md > 4. `verify_focus_contract` ``; `docs/product/UX_SPEC.md > Hero interaction > Verify` |
| P3-VER-011 | `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Verifier v1 rules`; `docs/architecture/DOMAIN_MODEL.md > Verification invariant` |
| P3-VER-012 | `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Verifier v1 rules`; `` docs/contracts/WEBMCP_TOOL_CONTRACT.md > 4. `verify_focus_contract` ``; `docs/product/UX_SPEC.md > Hero interaction > Verify` |
| P3-VER-013 | `docs/architecture/DOMAIN_MODEL.md > Entities`; `docs/architecture/DOMAIN_MODEL.md > Verification invariant`; `` docs/contracts/WEBMCP_TOOL_CONTRACT.md > 4. `verify_focus_contract` ``; `docs/hackathon-build/prd.md > PRD-011 — Verify raw rehearsal evidence`; `docs/delivery/CODEX_IMPLEMENTATION_PLAN.md > Package 3 — Raw observer and independent verifier` |
| P3-VER-014 | `docs/architecture/DOMAIN_MODEL.md > Idempotency contract`; `` docs/contracts/WEBMCP_TOOL_CONTRACT.md > 4. `verify_focus_contract` ``; `docs/architecture/ARCHITECTURE.md > Read consistency` |
| P3-VER-015 | `docs/architecture/DOMAIN_MODEL.md > Idempotency contract`; `docs/quality/SECURITY_AND_PRIVACY.md > Threat controls`; `docs/quality/TEST_STRATEGY.md > Critical D1 matrix` |
| P3-VER-016 | `` docs/contracts/WEBMCP_TOOL_CONTRACT.md > 4. `verify_focus_contract` ``; `docs/architecture/DOMAIN_MODEL.md > Verification invariant`; `docs/delivery/CODEX_IMPLEMENTATION_PLAN.md > Package 5 — Review, guarded apply, receipts, history, and undo` |
| P3-SEC-001 | `docs/architecture/DOMAIN_MODEL.md > Workspace and ID invariants`; `docs/architecture/ARCHITECTURE.md > Trust boundaries`; `docs/quality/SECURITY_AND_PRIVACY.md > Session and workspace design > Anonymous baseline` |
| P3-SEC-002 | `docs/architecture/DOMAIN_MODEL.md > Workspace and ID invariants`; `docs/quality/SECURITY_AND_PRIVACY.md > Threat controls` |
| P3-SEC-003 | `AGENTS.md > Product invariants`; `docs/architecture/DOMAIN_MODEL.md > Workspace and ID invariants`; `docs/contracts/WEBMCP_TOOL_CONTRACT.md > Public errors`; `docs/quality/SECURITY_AND_PRIVACY.md > Threat controls` |
| P3-SEC-004 | `docs/quality/SECURITY_AND_PRIVACY.md > Threat controls`; `docs/architecture/DOMAIN_MODEL.md > Verification invariant`; `docs/quality/TEST_STRATEGY.md > Test layers` |
| P3-SEC-005 | `docs/architecture/DOMAIN_MODEL.md > Public error envelope`; `docs/contracts/WEBMCP_TOOL_CONTRACT.md > Public errors`; `docs/product/UX_SPEC.md > Error and empty states` |
| P3-SEC-006 | `docs/architecture/ARCHITECTURE.md > Data lifecycle and observability`; `docs/quality/SECURITY_AND_PRIVACY.md > Data inventory and retention`; `docs/delivery/EVIDENCE_REGISTRY.md > File conventions` |
| P3-SEC-007 | `docs/architecture/DOMAIN_MODEL.md > Verification invariant`; `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Verifier v1 rules`; `docs/quality/TEST_STRATEGY.md > Test layers` |
| P3-SEC-008 | `docs/architecture/DOMAIN_MODEL.md > Idempotency contract`; `docs/quality/TEST_STRATEGY.md > Critical D1 matrix`; `docs/quality/SECURITY_AND_PRIVACY.md > Threat controls` |
| P3-SEC-009 | `docs/quality/SECURITY_AND_PRIVACY.md > Request boundary`; `docs/architecture/ARCHITECTURE.md > Trust boundaries`; `docs/contracts/WEBMCP_TOOL_CONTRACT.md > Common constraints`; `docs/quality/TEST_STRATEGY.md > Security/privacy tests` |
| P3-SEC-010 | `AGENTS.md > Product invariants`; `docs/architecture/ARCHITECTURE.md > Core flows > Verify and project precedent`; `docs/architecture/DOMAIN_MODEL.md > Exact guarded mutation invariant`; `docs/quality/SECURITY_AND_PRIVACY.md > Guarded D1 writes` |
| P3-MUT-001 | `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Deliberate mutation tests`; `docs/delivery/CODEX_IMPLEMENTATION_PLAN.md > Package 3 — Raw observer and independent verifier` |
| P3-MUT-002 | `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Deliberate mutation tests`; `docs/quality/TRACEABILITY_MATRIX.md > Independent verification` |
| P3-MUT-003 | `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Deliberate mutation tests`; `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Verifier v1 rules` |
| P3-MUT-004 | `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Deliberate mutation tests`; `docs/quality/TRACEABILITY_MATRIX.md > Independent verification` |
| P3-MUT-005 | `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Deliberate mutation tests`; `docs/quality/TRACEABILITY_MATRIX.md > Independent verification` |
| P3-MUT-006 | `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Deliberate mutation tests`; `docs/quality/TRACEABILITY_MATRIX.md > Independent verification` |
| P3-MUT-007 | `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Deliberate mutation tests`; `docs/quality/TRACEABILITY_MATRIX.md > Independent verification` |
| P3-EVD-001 | `docs/delivery/CODEX_IMPLEMENTATION_PLAN.md > Package 3 — Raw observer and independent verifier`; `docs/hackathon-build/checklist.md > Checklist > 5. Implement raw focus observation and independent verification`; `docs/quality/TEST_STRATEGY.md > Test layers` |
| P3-EVD-002 | `docs/delivery/CODEX_IMPLEMENTATION_PLAN.md > Package 3 — Raw observer and independent verifier`; `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Verifier v1 rules` |
| P3-EVD-003 | `docs/delivery/CODEX_IMPLEMENTATION_PLAN.md > Package 3 — Raw observer and independent verifier`; `docs/quality/TEST_STRATEGY.md > Test layers`; `docs/quality/TEST_STRATEGY.md > Critical D1 matrix` |
| P3-EVD-004 | `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Deliberate mutation tests`; `docs/delivery/CODEX_IMPLEMENTATION_PLAN.md > Package 3 — Raw observer and independent verifier`; `docs/quality/TEST_STRATEGY.md > Retrieval v2` |
| P3-EVD-005 | `docs/quality/SECURITY_AND_PRIVACY.md > Threat controls`; `docs/quality/TEST_STRATEGY.md > Security/privacy tests`; `docs/delivery/EVIDENCE_REGISTRY.md > File conventions` |
| P3-EVD-006 | `docs/hackathon-build/checklist.md > Checklist > 5. Implement raw focus observation and independent verification`; `docs/quality/TEST_STRATEGY.md > Test layers`; `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Complete rehearsal script`; `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Automated accessibility gates`; `docs/product/UX_SPEC.md > Accessibility interaction contract` |
| P3-EVD-007 | `docs/hackathon-build/checklist.md > Checklist > 5. Implement raw focus observation and independent verification`; `docs/product/UX_SPEC.md > Hero interaction > Verify`; `docs/product/UX_SPEC.md > Accessibility interaction contract`; `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md > Automated accessibility gates` |
| P3-EVD-008 | `docs/quality/TEST_STRATEGY.md > Quality thresholds`; `AGENTS.md > Engineering gate` |
| P3-EVD-009 | `docs/delivery/EVIDENCE_REGISTRY.md > Required evidence > E-006`; `docs/delivery/EVIDENCE_REGISTRY.md > Required evidence > E-007`; `docs/delivery/EVIDENCE_REGISTRY.md > Required evidence > E-008`; `docs/delivery/EVIDENCE_REGISTRY.md > Required evidence > E-009`; `docs/delivery/EVIDENCE_REGISTRY.md > Required evidence > E-010`; `docs/delivery/EVIDENCE_REGISTRY.md > Required evidence > E-011`; `docs/delivery/EVIDENCE_REGISTRY.md > Required evidence > E-014`; `docs/quality/TRACEABILITY_MATRIX.md > Raw observation`; `docs/quality/TRACEABILITY_MATRIX.md > Independent verification`; `docs/quality/TRACEABILITY_MATRIX.md > Accessibility` |
| P3-EVD-010 | `docs/delivery/AGENT_BUILD_CONTRACT.md > Review protocol`; `docs/hackathon-build/checklist.md > Checklist > 9. Run adversarial review one and close all high-severity findings`; `AGENTS.md > Completion evidence` |
| P3-EVD-011 | `docs/delivery/EVIDENCE_REGISTRY.md > Result vocabulary`; `docs/quality/TRACEABILITY_MATRIX.md > Independent verification`; `docs/quality/TRACEABILITY_MATRIX.md > Accessibility`; `docs/quality/TEST_STRATEGY.md > Principle`; `docs/authority/AUTHORITY_VALIDATION.md > Meaning of this result` |
| P3-EVD-012 | `docs/quality/SECURITY_AND_PRIVACY.md > Request boundary`; `docs/contracts/WEBMCP_TOOL_CONTRACT.md > Common constraints`; `docs/quality/TEST_STRATEGY.md > Security/privacy tests`; `docs/quality/TEST_STRATEGY.md > WebMCP tests` |
| P3-EVD-013 | `AGENTS.md > Product invariants`; `docs/architecture/ARCHITECTURE.md > Core flows > Verify and project precedent`; `docs/architecture/DOMAIN_MODEL.md > Exact guarded mutation invariant`; `docs/quality/SECURITY_AND_PRIVACY.md > Guarded D1 writes`; `docs/quality/TEST_STRATEGY.md > Critical D1 matrix` |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every authority-defined positive exact trace produces one receipt with 6 of 6 checks passing, one overall `pass`, correct evidence sequence references, and no duplicate on byte-identical replay.
- **SC-002**: All 7 of 7 planted behavioral divergences fail their named check independently; changing expected fixtures alone never changes the frozen observations.
- **SC-003**: 100% of the required invalid/tamper/replay/isolation cases reject or return a truthful fail result as specified, with zero unauthorized receipt replacement and zero implemented-configuration or approval mutation.
- **SC-004**: Each accepted rehearsal remains within 64 events and 30 seconds, and privacy scans find zero typed values, arbitrary text, clipboard content, full DOM snapshots, raw identity/session material, or prohibited sensitive markers across persisted records, logs, errors, and outputs.
- **SC-005**: All stable Package 3 requirement IDs map to at least one exact source path/heading anchor; there are zero duplicate IDs, zero missing baseline files, zero unanchored requirements, and zero authority-hash drift before a Spec Kit command.
- **SC-006**: Verifier safety-core branch coverage is 100%; remaining first-party Package 3 code meets the repository's applicable coverage thresholds with no weakened assertion or flaky retry.
- **SC-007**: One real-browser complete keyboard rehearsal plus bounded manual smoke passes on the exact tested source/environment, while every missing-event case remains a fail.
- **SC-008**: Package 3 review closes with zero unresolved critical/high findings, zero missing controlling requirements, and truthful evidence artifacts tied to exact source/runtime identities.

## Out of Scope

- Product-code implementation during Prompt B, including migrations, routes, observers, verifier code, tests, or UI changes.
- `$speckit-plan`, `$speckit-checklist`, `$speckit-tasks`, `$speckit-analyze`, `$speckit-implement`, `$speckit-converge`, or issue creation.
- Retrieval/RRF behavior, proposal evidence admission, review decisions, apply, undo, reset, verified-precedent projection, or Package 4+ work.
- New WebMCP registrations or changes to the existing four-tool release contract.
- Deployment, hosted D1 mutation, Site access/configuration, credentials, push, merge, publication, GitHub issues, Devpost, or any other external action.
- New framework, service, database, dependency, scope, authorization path, accessibility claim, security claim, or founder decision.

## Assumptions

- Packages 1 and 2 remain the existing product substrate; this specification does not reopen or reinterpret their accepted local/public-source slices.
- The active implemented revision remains the renderer configuration. Revision 1 focuses Delete; applicable D001 says Cancel; Package 3 observes and verifies behavior without turning precedent into authority.
- The existing closed focus targets, implemented-configuration fields, observation grammar, verifier version, public error envelope, and evidence vocabulary are controlling contracts rather than new implementation choices.
- Valid verification can persist a pass or fail receipt. Verified-precedent projection is implemented later under Package 5 authority and is not part of Package 3.
- Broader premium UX and final four-tool hardening remain Package 6 and Package 7 work; Package 3 still preserves the accessibility and human-fallback requirements touching its own result surface.
- No unresolved product decision is assumed. Any apparent ambiguity is resolved from the baseline authority or reported as unresolved; it is never converted into a founder decision by this specification.
