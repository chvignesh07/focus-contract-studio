# Phase 0 Research: Package 3 Raw Observer and Independent Verifier

This artifact records repository-backed design decisions. It does not amend product authority, authorize implementation, or report runtime evidence.

## Decision 1: Authority and phase custody

**Decision**: Bind planning to the immutable Prompt B checkpoint, its 31-source baseline, all 62 stable requirements, and explicit repository/planning-workspace aliases. Recompute the baseline and Prompt B artifact identities before each permitted Spec Kit skill. Keep Prompt C writes inside the authorized planning/evidence surface.

**Rationale**: The adoption workflow makes source drift a stop condition and Gate 4 requires a complete, mechanically checked chain for every stable ID. Existing Prompt B evidence already supplies the strict portable authority manifest.

**Alternatives considered**:

- Trust the current branch name or working tree without rehashing: rejected because neither proves source-byte identity.
- Copy authority text into planning documents: rejected because duplicated prose can drift and cannot supersede controlling sources.
- Add a Spec Kit extension/hook: rejected because no extension is required or authorized and manual preflights are already testable.

## Decision 2: Minimum Package boundary

**Decision**: Plan only full raw rehearsal capture, immutable finalization, pure six-rule verification, immutable receipt/check persistence, accessible result presentation, and their tests/evidence. Do not add tool registration, retrieval, proposal support, review/apply/undo/reset, precedent projection, deployment, or hosted claims.

**Rationale**: `P3-AUT-002` is narrower than the eventual product architecture. The existing Package 2 opening report and two WebMCP tools remain intact; Package 3 creates no new authority path.

**Alternatives considered**:

- Add `verify_focus_contract` registration now: rejected because tool registration is expressly outside Package 3.
- Project passing receipts into precedent now: rejected because projection is deferred and also depends on later review/apply provenance.
- Expand the Package 2 two-event report into claimed full verification: rejected because it lacks the complete raw sequence and verifier proof.

## Decision 3: Existing stack and layers

**Decision**: Reuse the current route → server operation → pure domain → prepared D1 layering. Use the installed TypeScript/Zod/React/Next/Cloudflare/Vitest/Testing Library/Playwright/axe stack and Web Crypto helpers. Add no dependency, service, database, worker, queue, or analytics component.

**Rationale**: Repository code already proves session resolution, request security, canonical configuration, SHA-256, safe public errors, no-store responses, D1 guarded batches, dialog DOM inspection, and all required test environments.

**Alternatives considered**:

- Add a telemetry or event-stream service: rejected; bounded in-request D1 persistence is sufficient and hidden infrastructure is forbidden.
- Add an accessibility or state-machine library: rejected; current platform and test tooling cover the fixed contract.
- Store observation evidence outside D1: rejected; the selected architecture has one database and workspace lifecycle.

## Decision 4: Rehearsal lifecycle

**Decision**: Use three same-origin UI operations: start, finalize, and verify. Start resolves workspace/active variant/revision and creates an expiring recording session. The browser captures one actual allowlisted manifest and ordered raw events. Finalize validates a strict closed payload, assigns authoritative sequence from accepted array order, canonicalizes and freezes rows/digests in one D1 batch, and inserts a finalizer record.

**Rationale**: Start/finalize are explicitly required, the browser is the only source of actual DOM/focus facts, and server sequencing/digest finalization must remain authoritative. Sending the bounded event array once minimizes routes and partial-write states.

**Alternatives considered**:

- One request that starts and finalizes: rejected because it cannot bind the browser capture to a server-created session before observation.
- One network request per event: rejected because it creates extra partial states and ordering/retry complexity without a requirement.
- Client-supplied authoritative sequence numbers: rejected because the server must assign authoritative order.

## Decision 5: Preserve the Package 2 opening report

**Decision**: Keep the existing initial-focus operation semantically distinct. The Package 3 migration replaces the broad finalized-session uniqueness rule with enforcement specific to Package 2 commit rows and introduces a separate full-rehearsal finalizer. Existing Package 2 behavior receives regression tests before the migration change.

**Rationale**: The current partial unique index applies to every finalized observation session and would otherwise block a new complete rehearsal for the same revision. Reusing the partial two-event session as full evidence would misstate what was observed.

**Alternatives considered**:

- Delete or rewrite the Package 2 report: rejected because it is working historical behavior and not necessary.
- Create a second database or unrelated event tables: rejected because the authority defines the existing observation entities and one D1 database.

## Decision 6: Pure verifier

**Decision**: Implement `focus-event-verifier-v1` as a pure module receiving only immutable manifest/events and canonical implemented configuration. It emits exactly six ordered check results with raw sequence references; missing evidence is `not_observed`; overall passes only when all six pass.

**Rationale**: A pure module is the smallest boundary that makes independence, deterministic mutation behavior, and 100% branch coverage directly enforceable.

**Alternatives considered**:

- Verify inside the route or repository: rejected because it mixes authority/storage with behavior evaluation and weakens the import boundary.
- Generate expected event fixtures from the configuration in production: rejected because expected data cannot manufacture observed evidence.
- Use retrieval or model judgment: rejected because verifier independence is release-blocking.

## Decision 7: Guarded verification persistence

**Decision**: Use a natural key of rehearsal session plus fixed verifier version. A conditional guard rechecks workspace, variant, revision, state, digests, active revision, and natural-key availability inside the write batch. Receipt, six checks, safe audit, and commit finalizer all select through the guard/created receipt. Exact affected-row assertions and a finalizer trigger make every incomplete outcome roll back.

**Rationale**: D1 batch rollback requires a statement error; zero changed rows alone cannot prove rollback. The existing guarded mutation pattern and authority both require an explicit finalizer.

**Alternatives considered**:

- Rely on a preliminary read: rejected because it can race and is diagnostic only.
- Insert receipt then read it later: rejected because a lost response could become ambiguous and partial checks/audit could survive.
- Treat all mismatches as invalid: rejected because a valid frozen behavioral mismatch must create a truthful immutable fail receipt.

## Decision 8: Evidence and accessibility truth

**Decision**: Prove pure rules/mutations, real D1 rollback/replay/concurrency, route boundaries, sensitive-marker absence, DOM result semantics, and a real-browser rehearsal separately. Bind outputs to exact source/runtime identities at registered paths `E-006`–`E-011` and `E-014`. Leave hosted and founder-manual proof `NOT_RUN` until performed later.

**Rationale**: Each claim must be proved where it can fail. Automation cannot replace actual-browser focus behavior or founder-operated assistive-technology evidence.

**Alternatives considered**:

- Treat generated traces or screenshots as passing behavior evidence: rejected by the evidence contract.
- Announce every raw event: rejected because it would create noisy live regions and unnecessary privacy exposure.
- Claim 64 events/30 seconds as hosted-confirmed capacity: rejected until deployed load evidence exists.

## Resolution status

All technical context needed for planning is resolved from controlling authority and current repository evidence. No founder decision, framework choice, hosted fact, or implementation result was inferred.
