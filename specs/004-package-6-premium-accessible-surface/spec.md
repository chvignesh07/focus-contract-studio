# Feature Specification: Package 6 Premium Accessible Product Surface

**Feature Branch**: `feat/package-6-premium-surface`

**Created**: 2026-09-01

**Status**: Approved for implementation

**Input**: Preserve Package 5 behavior while making the complete governed focus-change workflow immediately understandable, keyboard-operable, responsive, and visually credible for a cold judge.

## Clarifications

### Session 2026-09-01

- No critical ambiguity remains. The authorized prompt fixes scope, two variants, authority boundaries, state coverage, visual constraints, test profiles, evidence attribution, and the local-only stop boundary.

## User Scenarios & Testing

### User Story 1 - Understand current truth and precedent immediately (Priority: P1)

As a cold judge, I land on the working product and can tell what revision is implemented, what the browser observed, what the strongest precedent says, whether the proposal is applied, and where authority lives without scrolling.

**Why this priority**: Comprehension is Package 6's product outcome; no new domain capability is useful if the existing loop is visually ambiguous.

**Independent Test**: Give a fresh evaluator only the built first viewport. Within 15 seconds the evaluator correctly answers all five controlling questions and identifies the first safe action.

**Acceptance Scenarios**:

1. **Given** revision 1 with a decision mismatch and D001 evidence, **when** the page loads, **then** the live dialog, implemented outcome, observed outcome, precise precedent outcome, evidence-only boundary, `NOT APPLIED` status, and first safe action appear in the first viewport.
2. **Given** any committed workflow state, **when** the judge inspects the six-stage rail, **then** Observe, Precedent, Proposal, Review, Apply, and Verify & history expose derived current/completed states and link to inspectable real sections.
3. **Given** a conflict or abstention, **when** precedent resolves, **then** the conflict shows both exact outcomes and disables agent proposal creation, while abstention explains the reason and preserves the reviewer-owned novel path.

---

### User Story 2 - Review and apply one exact proposal safely (Priority: P1)

As a reviewer, I can switch between the two allowlisted variants, inspect the complete exact proposal, explicitly acknowledge it, confirm a review decision, apply only an approved current proposal, and continue from a durable receipt.

**Why this priority**: The human authority boundary must be more obvious without changing Package 5's guarded mutation semantics.

**Independent Test**: With WebMCP unavailable and keyboard only, switch variants through the CAS route, review the exact digest/base revision, apply once, recover one uncertain response with the same key, copy the receipt, and start the revision-2 rehearsal.

**Acceptance Scenarios**:

1. **Given** either Standard or Danger-emphasis, **when** the reviewer selects the other tab, **then** only the allowlisted slug and expected view revision reach a same-origin Origin/CSRF/session-protected route, stale reads are cancelled, review/history refresh, history persists, and tools abort/re-register without gaining variant inputs.
2. **Given** a current proposal, **when** the acknowledgement is unchecked, **then** approve, reject, edit, and revoke cannot enter confirmation; checking “I reviewed this exact proposal and revision” enables only the valid actions for that exact digest/base revision.
3. **Given** a successful guarded apply, **when** the result appears, **then** the permanent copyable receipt names the revision transition and its primary action starts the revision-2 rehearsal.
4. **Given** an uncertain application response, **when** recovery runs, **then** the interface says `OUTCOME UNCERTAIN — RECOVERING RECEIPT`, reuses the identical key, and never guesses whether the implemented revision changed.

---

### User Story 3 - Verify, recover, and inspect durable history (Priority: P2)

As a reviewer, I can distinguish what verification proves, inspect every raw-sequence check and projection source, recover from every material state, and deliberately undo or reset through the visible UI.

**Why this priority**: Trust depends on truthful proof boundaries and durable recovery, not a success-looking screen.

**Independent Test**: Complete revision-2 rehearsal and verify pass/fail paths, inspect the chronological timeline, undo, reset, and exercise every public state panel at desktop, 320 px, 375 px, and true 200% zoom.

**Acceptance Scenarios**:

1. **Given** a finalized fresh rehearsal, **when** verification resolves, **then** all six checks show exact raw-sequence references, named implemented revision, overall pass/fail, and safe projection provenance.
2. **Given** the verification boundary, **when** it is read, **then** it says comparison is between a fresh raw rehearsal and rendered revision and does not prove approval, biological-human action, WCAG conformance, or general safety.
3. **Given** durable records or safe failures, **when** history loads, **then** rehearsal, proposal, decision, application, revision, verification, projection, safe failure, undo, and reset appear chronologically with only allowlisted timestamps/details.
4. **Given** undo or reset, **when** the reviewer confirms, **then** Package 5's UI-only mutation, idempotent recovery, and append-only revision behavior remain unchanged.

### Edge Cases

- Variant input is unknown, expected view revision is stale, the session is expired, Origin/CSRF is invalid, or a response arrives after a newer variant selection.
- Retrieval returns conflict, abstention, no records, validation failure, rate limit, or an uncertain network response.
- `document.modelContext` is absent or becomes unavailable while a tool operation is active.
- A proposal changes after acknowledgement, review, confirmation, reload, or variant switch.
- An apply response is lost before or after commit and the same idempotency key is retried.
- Verification fails, passes without projection, passes with projection, or refers to a stale rendered revision.
- Content grows at 320 px, 375 px, or 200% zoom without horizontal page overflow, hidden actions, or obscured focus.

## Requirements

### Functional Requirements

- **FR-001**: The first viewport MUST expose implemented revision/outcome, observed outcome, D001 precedent outcome, evidence-only status, `NOT APPLIED` status when applicable, and one first safe action around the live dialog and Decision Mismatch anchor.
- **FR-002**: A six-stage rail MUST derive current/completed state from committed review, proposal, application, verification, and history data and MUST link to the corresponding inspectable sections.
- **FR-003**: The interface MUST use product-story language and MUST NOT expose package numbering as judge-facing positioning.
- **FR-004**: Standard and Danger-emphasis tabs MUST call one protected same-origin UI route accepting only either server-owned slug and an expected view revision.
- **FR-005**: The variant route MUST resolve workspace and variant IDs server-side, invoke the existing CAS operation, reject stale state, and preserve Origin, CSRF, session, content, size, and unknown-field validation.
- **FR-006**: Variant switching MUST cancel stale review/history reads, refresh both views, preserve committed history, and abort/re-register existing tools as needed; WebMCP tool inputs MUST remain variant/workspace-free.
- **FR-007**: Precedent DTOs MUST expose only allowlisted record ID, outcome, safe source kind, validity date, scope, individually labelled lexical/structured/relationship ranks, RRF contribution, and bounded rationale.
- **FR-008**: Conflict MUST show implemented and precedent outcomes side-by-side and disable agent proposal creation; abstention MUST show its reason and the reviewer-owned novel proposal path.
- **FR-009**: Every proposal field MUST show implemented value, proposed value, and supporting record/outcome; the exact digest, base revision, author, time, and application status MUST remain visible.
- **FR-010**: Approve, reject, edit, and revoke MUST remain disabled until the reviewer checks “I reviewed this exact proposal and revision”; acknowledgement MUST reset when the exact proposal, base revision, digest, session, or variant changes.
- **FR-011**: Review and apply MUST retain visible confirmation, same-origin authority, exact digest/base binding, and Package 5 guarded/idempotent behavior; retrieval, verification, and WebMCP MUST NOT authorize review.
- **FR-012**: A successful application receipt MUST remain visible after its dialog closes, be copyable, expose the safe revision transition, and make starting the revision-2 rehearsal its primary next action.
- **FR-013**: Uncertain application recovery MUST use the original idempotency key and the exact truthful phrase `OUTCOME UNCERTAIN — RECOVERING RECEIPT` until a committed receipt or explicit failure resolves.
- **FR-014**: Verification MUST show all six rows, exact raw-sequence references, named rendered/implemented revision, overall result, and allowlisted projection provenance.
- **FR-015**: Verification copy MUST state its exact comparison and explicitly exclude proof of approval, biological-human action, WCAG conformance, and general safety.
- **FR-016**: History MUST render a safe chronological timeline for rehearsal, proposal, decision, application, revision, verification, projection, safe failure, undo, and reset.
- **FR-017**: Undo and reset MUST remain deliberate visible-interface-only actions with confirmation, idempotent recovery, and no new agent-visible capability.
- **FR-018**: Loading, empty, abstention, conflict, validation failure, stale state, rate limit, expired session, unsupported WebMCP, uncertain network, recovery, success, verified failure, and verified pass MUST each expose what happened, whether implemented revision changed, a stable public code, a safe correlation ID, and exactly one safe next action.
- **FR-019**: The complete human workflow MUST work when `document.modelContext` is unavailable.
- **FR-020**: The visual system MUST use a warm neutral canvas, near-black type, indigo interaction, semantic amber/green/red, design tokens, an 8 px spacing rhythm, restrained radii/shadows, tabular numerals, and monospace only for identifiers/digests.
- **FR-021**: The surface MUST NOT use decorative purple/violet gradients, glassmorphism, meaningless blobs, ornamental motion, marketing detours, or an undifferentiated dashboard card stack.
- **FR-022**: Native named/described modal dialogs and inert background behavior MUST remain intact; all controls MUST have persistent labels, visible focus, keyboard operation, non-color state, and at least 44×44 px targets.
- **FR-023**: Desktop, 320 px, 375 px, and true 200% zoom MUST avoid page-level/two-dimensional horizontal scrolling and keep every enabled focused action visible and unobscured.
- **FR-024**: Reduced motion MUST be honored and live announcements MUST be restrained to material state changes.
- **FR-025**: Package 5 domain behavior, schema, two-tool contract, frozen proof, and external boundaries MUST remain unchanged; no dependency, migration, or component framework may be added.

### Key Entities

- **Variant View State**: The server-owned active variant slug and monotonically checked view revision; workspace and variant IDs remain private.
- **Stage View**: A six-entry presentation derived only from committed data, with current/completed/available state and a real section target.
- **Public Precedent Detail**: The allowlisted, bounded evidence fields permitted in the human UI; private source content and identifiers are excluded.
- **Operation State**: A public state code, safe correlation ID, revision-change truth, explanatory copy, and exactly one recovery/next action.
- **Application Receipt View**: The existing committed Package 5 receipt rendered permanently and copyably without becoming new authority.

## Success Criteria

### Measurable Outcomes

- **SC-001**: One fresh read-only evaluator answers all five controlling questions correctly from only the final page/screenshot in 15 seconds or less.
- **SC-002**: Package 6 tests prove variant CAS/security/cancellation, six-stage derivation, DTO privacy, exact acknowledgement, all state panels, receipts, timeline, undo/reset, and unsupported-WebMCP behavior.
- **SC-003**: Built Playwright completes the full keyboard workflow at desktop, 320 px, 375 px, and true 200% zoom with zero critical/serious axe findings and no page-level horizontal overflow or obscured enabled controls.
- **SC-004**: Every relevant state has exactly one next action and truthfully reports revision change, public code, and correlation ID.
- **SC-005**: `verify:package6` passes locally and from one clean disposable `--no-local --single-branch` clone of the exact checkpoint commit while exact Package 5 frozen verification remains green.
- **SC-006**: Source/evidence binding and tamper tests pass; hosted, real-client, founder-manual, deployed-cold-evaluator, Package 7, push, merge, deploy, hosted D1, publication, and account changes remain `NOT_RUN` or not performed.

## Assumptions

- Package 5's domain state machine, active-variant CAS operation, migrations, error envelope, history, verification, and two WebMCP registrations are authoritative and reused.
- The two allowlisted public variant slugs are `delete-account-standard` and `delete-account-danger-emphasis`.
- This is a local candidate/checkpoint. No hosted or public claim is authorized.
- Product authority overrides generic landing-page advice: Observe and Decision Mismatch are working-product surfaces, not removable marketing cards.
