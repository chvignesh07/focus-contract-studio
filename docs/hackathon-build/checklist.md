# Focus Contract Studio — Autonomous Build Checklist

## Build preferences

- **Build mode:** Autonomous
- **Comprehension checks:** N/A
- **Git:** Commit after every passed work package; tag the final release candidate
- **Verification:** Continuous; first meaningful preview after Package 2, founder-visible final judge check after Package 10
- **Check-in cadence:** Risk gates first, then evidence-backed completion
- **Reviews:** Two independent read-only adversarial reviews after Packages 8 and 10
- **Rule:** A failed release blocker stops the build until the underlying implementation legitimately passes

## Checklist

- [ ] **1. Bootstrap the isolated Site and run capability probes**
  Spec ref: `spec.md > Top-one stack` and `spec.md > Risks and mandatory probes`
  What to build: Initialize `focus-contract-studio/` through the current official Sites creation workflow with D1 and optional auth capability; record the actual generator/version/options rather than assuming names. Inspect generated instructions, framework, package manager, scripts, Worker output, bindings, auth helpers, migration flow, and test compatibility. Copy the complete authority pack, add Apache-2.0, initialize Git, commit the untouched scaffold plus docs, and record probe evidence.
  Acceptance: No framework or runtime fact is guessed; local build succeeds; D1/auth bindings are declared; no unrelated parent files enter the app repository.
  Verify: Generated build command, typecheck, local non-browser request, configuration inspection, and `docs/evidence/BOOTSTRAP_PROBES.md` with PASS/FAIL for every mandatory probe that can run locally.

- [ ] **2. Deliver the first meaningful product slice**
  Spec ref: `prd.md > Epic 2 — Observe the real dialog` and `docs/product/UX_SPEC.md > First 15 seconds`
  What to build: Implement the recognizable first viewport with product-specific copy, one real anonymous D1 workspace, the seeded Delete Account dialog, active implemented revision/configuration, raw initial-focus observation, visible mismatch, durable immutable proposal, and the first two live WebMCP tools (`read_active_focus_review` and `create_focus_contract_proposal`). The read is write-free and returns a short-lived session/workspace/state/result-bound evidence token; create reruns token-time retrieval and atomically persists the accepted evidence snapshot plus proposal. Use real semantic controls and native dialog behavior; no static success state or mock production persistence.
  Acceptance: A reasonable viewer recognizes the product and hero mismatch; ChatGPT can read the exact live state and create a durable `NOT APPLIED` proposal; the read leaves D1 unchanged; tampered/stale/cross-boundary evidence creates nothing; active implemented revision/configuration remain unchanged; starter placeholder content/metadata is gone.
  Verify: Contract/domain/D1/component tests, read-no-write and complete token negative matrix, evidence+proposal failure injection, one Playwright vertical journey, build, local preview, and an owner-limited production deployment in a real supported ChatGPT client. Record exact commit/Sites-version/client evidence before broadening the implementation; do not assume a saved version has isolated D1 state.

- [ ] **3. Implement D1 schema, migrations, workspace isolation, and deterministic seed**
  Spec ref: `docs/architecture/DOMAIN_MODEL.md` and `docs/quality/SECURITY_AND_PRIVACY.md > Session and workspace design`
  What to build: Create inspected additive migrations, D1 repository helpers, anonymous secure session, optional signed-in subject derivation only after hosted probes, workspace ownership, CSRF/origin guards, issuance limits, request-driven TTL cleanup, seed/reset, and indexes. Never persist raw email/name/token/IP; HMAC the exact validated email header bytes without case normalization.
  Acceptance: Fresh database migrates and seeds; two sessions remain isolated; reload persists; reset affects only current demo; malformed/forged/expired sessions fail closed.
  Verify: Unit and real D1 integration tests, migration inspection, `EXPLAIN QUERY PLAN` for declared indexed queries, and no raw identity data in seeded/test database.

- [ ] **4. Implement the domain state machine and atomic commands**
  Spec ref: `docs/architecture/DOMAIN_MODEL.md > State machines`
  What to build: Pure typed invariants and server commands for immutable proposal/versioning, UI-mediated approve/reject/revoke, apply, receipts, verification receipt, history, and undo. Implement canonical hash, execution-time checks, unique idempotency, CAS revision, and guarded D1 batches. Every write repeats the application guard; a transaction finalizer aborts incomplete batches; every result's `meta.changes` is inspected.
  Acceptance: Illegal transitions, unavailable/foreign opaque IDs, changed hash, stale revision, rejection, revocation, replay, zero-row conditional writes, injected failure, and concurrent applies cause zero mutation; retry returns one receipt.
  Verify: Full transition table tests, unavailable-ID response parity, every statement-position failure, zero-row guard failure, two-writer race test, canonical-hash vectors, and read-after-write/reload tests.

- [ ] **5. Implement raw focus observation and independent verification**
  Spec ref: `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md`
  What to build: Native dialog behavior driven by current revision, bounded `keydown`/`focusin` capture, rehearsal lifecycle, independent six-behavior evaluator, planted divergence fixture, accessible result presentation, and verification receipts.
  Acceptance: Revision 1 renders and observes Delete while D001 says Cancel; revision 2 renders and observes Cancel after exact review/apply; every deliberate behavior divergence fails; changing fixture expectations or a proposal cannot manufacture observed events; event capture stores no typed values.
  Verify: Unit event-trace vectors, Playwright keyboard journeys, deliberate divergence, evidence binding, and manual keyboard smoke.

- [ ] **6. Verify the v2 seal, implement three eligible-only rankings and clean-room RRF, pass development gates**
  Spec ref: `docs/retrieval/RETRIEVAL_AND_RRF_SPEC.md` and `docs/retrieval/RRF_BENCHMARK.md`
  What to build: Verify the pre-sealed 36-record v2 materialization and 12 development/18 procedural-holdout fixtures, schemas, evaluator, calibration, and hashes. Implement indexed eligibility capped at 36, eligible-only TypeScript BM25, structured rank, subject-edge rank, RRF `k=60`, stable full-precision ties, explanations, conflict, and abstention. Product code may use development cases only and may not import expected judgments, the reference evaluator, or holdout.
  Acceptance: All 12 development dispositions, safety/isolation cases, frozen golden ranks, and 100-repeat determinism pass. V1 remains visibly invalid; v2 fixture/evaluator bytes remain unchanged.
  Verify: `SHA256SUMS-v2`, schema/count/query-neutrality checks, reference calibration reproduction before implementation, product dev report, dependency-boundary scan, query-plan evidence, and 100-run determinism. The one-time release holdout occurs only after source commit `C` and public deployment are frozen.

- [ ] **7. Complete the accessible human workflow and premium responsive UX**
  Spec ref: `docs/product/UX_SPEC.md` and `prd.md > Epics and user stories`
  What to build: Wire persistent state into the complete read, rehearse, propose, revise, approve/reject/revoke, apply, verify, history, reload, stale failure, reset, and undo experience. Implement all loading, empty, success, error, conflict, and rate-limit states.
  Acceptance: Entire journey works by keyboard at 320 px and 375 px and at 200% zoom, uses non-color status labels and live announcements, preserves entered values on validation, and exposes no machine-only action. The open dialog exposes its name, description, and modal semantics; background controls reject pointer activation and keyboard focus until close; every focused actionable control remains inside the visible, unobscured viewport at desktop, 320 px, 375 px, and 200% zoom.
  Verify: Testing Library behavior tests, Playwright full journey with dialog/background and focused-element bounds/occlusion assertions in all four viewport/zoom conditions, axe checks, reduced-motion/reflow checks, and an exact-release manual keyboard review of the same behaviors.

- [ ] **8. Register and prove the four WebMCP tools**
  Spec ref: `docs/contracts/WEBMCP_TOOL_CONTRACT.md`
  What to build: One top-level singleton registry with strict Zod/Draft-07 schemas, accurate annotations, bounded outputs, common errors, route lifecycle cleanup, cancellation handling, and the four thin adapters calling the same services as UI.
  Acceptance: Only expected tools appear; read/propose/apply/verify behave exactly as contracted; create never applies; apply cannot bypass approval; unsupported WebMCP preserves the human UI.
  Verify: Schema snapshots, adapter unit tests, read-only annotation versus actual D1-write inventory, token format/expiry/tamper/boundary tests, Playwright pre-script API shim, navigation/HMR/cancellation tests, prompt-injection cases, output-size assertions, and local tool trace evidence.

- [ ] **9. Run adversarial review one and close all high-severity findings**
  Spec ref: `docs/delivery/AGENT_BUILD_CONTRACT.md > Review protocol`
  What to build: A separate read-only reviewer audits domain authority, D1 concurrency, workspace isolation, WebMCP/UI parity, untrusted precedent, and verifier independence. Root agent reproduces and fixes valid findings.
  Acceptance: No open high-severity correctness/security issue; every finding has evidence, disposition, fix commit, and regression test.
  Verify: `docs/evidence/ADVERSARIAL_REVIEW_1.md` and rerun affected suites plus the full verification command.

- [ ] **10. Perform browser, accessibility, security, and deployment acceptance**
  Spec ref: `docs/quality/TEST_STRATEGY.md` and `docs/delivery/DEPLOYMENT_AND_OPERATIONS.md`
  What to build: Finish metadata/social preview, security headers, dependency/secret/license checks, production build, save/deploy exact Sites version, public anonymous access, live D1 migration/seed, and clean-client smoke paths.
  Acceptance: Live signed-out journey works; a supported ChatGPT client discovers/calls tools; Chrome is claimed only if its current conditional path passes; named VoiceOver checks pass; no critical dependency/secret/license issue; Site availability is checked through judging.
  Verify: Source commit `C`, Sites saved-version/deployment mapping, clean-profile/two-profile smoke, real ChatGPT trace, conditional Chrome trace, VoiceOver checklist, security report, and live persistence/undo.

- [ ] **11. Run adversarial review two and freeze the release candidate**
  Spec ref: `docs/delivery/AGENT_BUILD_CONTRACT.md > Review protocol`
  What to build: A fresh reviewer evaluates cold judge comprehension, claim truth, first-run reliability, tool leverage, evidence consistency, benchmark integrity, submission completeness, and deadline risk. Close valid findings without weakening gates.
  Acceptance: A blind viewer identifies mismatch, unapplied proposal, UI-mediated review authority, and verification within 15 seconds and explains that verification compares a new raw rehearsal with the named implemented revision rather than proving approval or general conformance; repository/live evidence agree; no known high-severity issue remains.
  Verify: `docs/evidence/ADVERSARIAL_REVIEW_2.md`, blind-test notes, complete release matrix, one-time v2 holdout report, and final full test run from clean checkout.

- [ ] **12. Prepare and freeze the Devpost handoff**
  Spec ref: `docs/delivery/SUBMISSION_PLAN.md`
  What to build: Public repository README/provenance/license, test evidence, screenshots, at-most-170-second narrated demo, Devpost draft for every live form field, tested-client disclosure, learning/Codex narrative, committed `release/BUILD_INPUTS.json`, and receipt-bearing post-submission release attestation. Recheck live Devpost requirements immediately before submission.
  Acceptance: Live URL, repo, video, description, screenshots, and evidence name the same release; video is public with audio and under three minutes; every required field is complete and truthful; post-deadline freeze procedure is documented.
  Verify: Clean judge rehearsal, URL/access checks, video duration/audio/public-playback check, required-field audit, secret scan, license detection, `docs/delivery/EVIDENCE_REGISTRY.md`, and `.artifacts/release/RELEASE_ATTESTATION.json` published as a release asset.
