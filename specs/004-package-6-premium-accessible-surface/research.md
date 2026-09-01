# Phase 0 Research: Package 6 Premium Accessible Product Surface

This artifact records repository-backed implementation decisions. It does not amend product authority or authorize an external action.

## Decision 1: Preserve the Package 5 state machine

**Decision**: Keep every review, apply, recovery, verification, projection, history, undo, reset, and two-tool behavior in its existing module. Package 6 changes presentation and adds only the missing protected active-variant route.

**Rationale**: Package 5 passed its full frozen gate and already owns the durable authority model. A duplicate client workflow or new persistence layer creates risk without product value.

**Rejected**: New workflow engine, schema migration, query cache, component framework, or Package 7 tool expansion.

## Decision 2: Reuse the server-owned variant CAS seam

**Decision**: A strict route accepts `variant` as one of two public slugs plus `expectedViewRevision`, resolves the current workspace and private variant ID server-side, and calls existing `setActiveVariant`.

**Rationale**: This retains the established compare-and-swap guard and prevents caller selection of workspace/variant identifiers.

**Rejected**: Client-provided IDs, query-string switching, local-only tab state, or a second CAS implementation.

## Decision 3: Abort stale reads with native AbortController

**Decision**: One request generation owns parallel focus-review/history reads. A variant selection aborts the previous generation before CAS and again before the fresh read; unmount aborts it. Tool registration cleanup runs on active variant/review changes.

**Rationale**: Native fetch cancellation solves the exact race with no dependency or cache abstraction.

**Rejected**: React-query/SWR, polling, global event bus, or accepting out-of-order results.

## Decision 4: Add only a pure presentation-policy module

**Decision**: Pure functions derive six stages, public state-panel data, safe correlation fallback, and precedent display fields. The React coordinator consumes those outputs.

**Rationale**: Stage and state invariants are non-trivial and explicitly require unit coverage; one pure module is the smallest reusable seam.

**Rejected**: A design-system package, reducer framework, class hierarchy, or duplicating the Package 5 domain state machine.

## Decision 5: Expand the human DTO without changing WebMCP

**Decision**: Human precedent records add safe source kind, valid date, and labelled rank fields selected from existing committed precedent/provenance data. The WebMCP bounded mapper continues to project exactly its frozen allowlist.

**Rationale**: The human UI needs evidence comprehension, while the controlling two-tool contract must not change.

**Rejected**: Raw database rows, source content, private provenance IDs, or changing tool schemas.

## Decision 6: Keep native dialogs and platform clipboard

**Decision**: Preserve `<dialog>` naming, description, modal/inert behavior, and focus return. Use the browser clipboard API with a hidden-textarea fallback for the existing receipt string. Trigger the existing complete rehearsal through one explicit request prop.

**Rationale**: Native behavior already passes Package 5 semantics; a modal or clipboard library adds code and accessibility risk.

**Rejected**: Custom overlay/focus trap, toast library, imperative DOM click, or new receipt persistence.

## Decision 7: Derive visual hierarchy from committed truth

**Decision**: The first viewport uses the live dialog/rehearsal and Decision Mismatch as the unique anchor. The rail is a labelled navigation list whose state comes from active review/proposal/application/verification/history records.

**Rationale**: This answers the five cold questions without inventing decorative progress.

**Rejected**: Marketing hero, fabricated completion, manually toggled wizard, or removing required functional panels.

## Decision 8: One state-panel contract

**Decision**: Every named state maps to a stable public code, revision-change truth, safe correlation ID, explanatory sentence, and exactly one safe next action. Material server errors retain public codes/correlation IDs; client-only states use deterministic safe local IDs.

**Rationale**: A data contract is smaller and more testable than fourteen bespoke error components.

**Rejected**: Generic toast-only errors, multiple recovery CTAs per state, or exposing raw server detail.

## Decision 9: Test observable journeys, not screenshots alone

**Decision**: Built Playwright covers keyboard flow, four viewport/zoom profiles, native modal semantics/inertness, enabled-control visibility, page overflow, axe serious/critical results, reduced motion, WebMCP absence, and deterministic screenshot hashes.

**Rationale**: Package authority explicitly defines browser acceptance as behavior.

**Rejected**: HTTP 200, static CSS inspection only, screenshot-only approval, or hosted claims.

## Decision 10: Compose frozen proof and candidate-only evidence

**Decision**: `verify:package6` first proves the exact Package 5 checkpoint with the existing disposable-checkpoint method, then Package 6 gates and bindings. Cold evaluation is local-candidate evidence; hosted, real-client, founder-manual, and deployed-cold rows remain `NOT_RUN`.

**Rationale**: Inherited proof must remain exact and evidence attribution must remain truthful.

**Rejected**: Rewriting Package 5 evidence, opening holdout data, or treating local evaluation as deployed evidence.
