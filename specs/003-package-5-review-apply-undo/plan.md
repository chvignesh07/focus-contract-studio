# Implementation Plan: Package 5 Review, Apply, Verify, Undo, and Reset

**Branch**: `feat/package-5-review-apply-undo` | **Date**: 2026-08-31 | **Spec**: `specs/003-package-5-review-apply-undo/spec.md`

**Input**: Complete Package 5 from exact Package 4 checkpoint `0f85ad66ef6aa190abdfa9f003b1bd96a8a84a7f` without beginning Package 6 or 7.

**Planning status**: Ready for checklist, tasks, analysis, and test-first implementation.

## Summary

Package 5 closes the existing product spine rather than introducing a new one. It reuses immutable proposals, request security, session/workspace resolution, Package 1 review/application/idempotency tables and finalizers, Package 3 raw verification, the existing reset command, and the current React review surface. New code supplies visible review/edit decisions, guarded exact-once apply, safe history, pass-only precedent projection, revisioned undo, and deliberate reset UX. A migration `0004` is added only after a focused real-D1 red test proves an enforcement gap that cannot be closed by existing constraints/finalizers.

Exactly two WebMCP tools remain registered. Package 5 completes the visible human path and shared domain operations only; Package 7 owns apply/verify tool registration.

## Technical Context

**Language/Version**: Existing strict TypeScript 5.9.3 on Node.js 22.13+

**Primary Dependencies**: Existing React/Vinext, Zod 4, Drizzle declarations, Cloudflare Workers/D1, Node test runner, Vitest/Workerd, Playwright, and axe; no new dependency

**Storage**: Existing D1 migrations `0001`–`0003`; conditional additive `0004` only after a failing real-D1 enforcement test

**Testing**: Node test runner for pure contracts/bindings; Vitest Workers pool for real D1 and DOM; built Playwright for the complete journey; npm audit; deterministic source/evidence binders; disposable no-local clone

**Target Platform**: Existing full-stack ChatGPT Site and local Worker-like D1; no hosted execution

**Project Type**: Full-stack web application with React UI → same-origin route → server command → guarded D1/pure verifier layering

**Performance Goals**: Bounded current-workspace history; exact 100-pair same-base concurrency proof; no unbounded scan or later-package performance system

**Constraints**: One writing agent; UI-only review/undo/reset authority; existing two tools only; zero-row is failure; all-or-nothing guarded writes; foreign/nonexistent parity; no secret/path leakage; no Package 4 evidence weakening; no external action

**Scale/Scope**: One current anonymous workspace, two seeded variants, one primary reviewed proposal, append-only history, bounded synthetic precedent, and 100 paired concurrent apply attempts

**Unresolved technical context**: None. Whether migration `0004` is required is an empirical red-test result, not a planning choice.

## Constitution Check

### Pre-design gate

| Principle | Result | Design consequence |
|---|---|---|
| Evidence is not authorization | PASS | Retrieval/citations remain proposal evidence; only protected visible UI can record review. |
| Observation is privacy-bounded | PASS | Package 3 manifest/event grammar remains unchanged and no history DTO includes raw content. |
| Verification is independent | PASS | Projection consumes a committed verifier receipt; retrieval or proposal targets cannot manufacture pass. |
| Writes are guarded and non-oracle | PASS | Every mutation resolves workspace server-side, uses exact predicates/idempotency, inspects all counts, and preserves not-found parity. |
| Evidence completes the package | PASS | Tests, reviewers, convergence, source/evidence binding, exact clone, and clean custody are package work. |
| External actions remain gated | PASS | No push, merge, deploy, hosted D1, holdout, publication, account, or submission action. |

### Post-design gate

PASS. The design reuses the current architecture, keeps review/undo/reset out of WebMCP, preserves the independent verifier, adds no dependency or service, and makes a new migration conditional on real storage evidence.

## Architecture and Flow

```text
[Visible React review UI]
        |
        v
[Existing same-origin request security + workspace session]
        |
        +--> [review/edit command] --> [proposal + review + idempotency + audit]
        |
        +--> [apply command] -------> [application guard/finalizer + revision + receipt]
        |
        +--> [existing verifier] ---> [receipt + pass-only runtime precedent projection]
        |
        +--> [history query] -------> [safe chronological DTO]
        |
        +--> [undo/reset command] --> [later revision / new workspace generation]

[Existing two WebMCP adapters] --> read + create proposal only (unchanged)
```

### Review and child edit

The UI posts one strict action to a proposal-scoped review route. Approve/reject/revoke insert one append-only decision and update only the proposal status projection; edit creates one reviewer-authored child with parent lineage but no inherited supporting evidence, then supersedes the parent. All actions bind current workspace, visible page session, proposal ID/hash/base, idempotency request hash, and active revision. The route does not exist as a WebMCP registration.

### Guarded apply

The command accepts only proposal ID, expected revision, and idempotency key. Diagnostic reads improve errors but authorize nothing. One D1 batch conditionally creates the application guard from authoritative joins, creates revision `N+1`, advances the active pointer, records receipt/idempotency/audit, applies the proposal, stales open same-base siblings, and inserts the existing application finalizer. Every result and exact `meta.changes` is interpreted. Replay is resolved before a new guard; conflicting request hash fails. All failures map from post-failure authoritative state without revealing foreign existence.

### Verify and project

The existing Package 3 verifier remains the only source of verification truth. Its persistence batch is extended so a passing receipt for a revision sourced from an applied exact UI-reviewed proposal can create one runtime precedent record plus typed subject edges and audit/projection proof. A natural uniqueness key/guard prevents duplicate projection. Failing, revision-1, unreviewed, or replayed receipts create none. Seed records remain unchanged.

### History, undo, reset

The history query merges committed proposal/decision/application/revision/verification/precedent/audit facts into a bounded safe chronological DTO with stable kinds. Undo verifies the active revision and source lineage, then creates the next implemented revision with the prior configuration, advances one pointer, commits idempotency/audit, stales old open authority, and records a receipt-safe revision result. Existing reset persistence is reused; Package 5 adds deliberate confirmation, uncertain-response recovery, history display, and regression proof.

## Project Structure

### Feature documentation

```text
specs/003-package-5-review-apply-undo/
├── spec.md
├── ceo-plan.md
├── plan.md
├── eng-plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
├── checklists/
└── tasks.md
```

### Planned implementation targets

```text
lib/domain/package5.ts                         # strict inputs, canonical requests, state/result reducers
lib/server/package5-review.ts                  # child proposal and UI-only decisions
lib/server/package5-apply-history-undo.ts      # guarded apply, bounded history, revisioned undo
lib/server/verify-focus-contract.ts            # pass-only exact-once projection extension
lib/server/workspaces.ts                       # reuse/reset result exposure only if red test requires
lib/server/errors.ts                           # stable Package 5 error mappings
app/api/focus-proposals/[proposalId]/review/route.ts
app/api/focus-proposals/[proposalId]/apply/route.ts
app/api/focus-history/route.ts
app/api/focus-revisions/[revision]/undo/route.ts
app/focus-contract-studio.tsx                  # accessible functional Package 5 states
app/globals.css                                # only minimum responsive/state styles required by Package 5
drizzle/0004_package5_review_apply_undo.sql     # conditional; only with red real-D1 proof
db/schema.ts                                   # mirror 0004 only if migration exists
tests/package5-node/
tests/package5/
tests/package5-dom/
tests/package5-browser/
scripts/package5-source-manifest.mjs
scripts/package5-evidence-binding.mjs
docs/evidence/PACKAGE5_EXECUTION.md
docs/evidence/PACKAGE5_VERIFICATION.md
docs/evidence/PACKAGE5_ADVERSARIAL_REVIEW.md
docs/evidence/EXECUTION_STATE.{md,json}
package.json
vitest.package5.config.ts
vitest.package5-dom.config.ts
wrangler.package5.jsonc
```

**Structure decision**: Keep one shared domain/state file and two operation-oriented server modules; reuse all existing security/session/rehearsal/retrieval modules. Routes remain thin. Test/evidence files are separate because they exercise independent trust boundaries. No new generalized repository, transaction, history, workflow, or component framework is introduced.

## Requirement Design Map

| Requirements | Primary boundary | Proof |
|---|---|---|
| FR-001–FR-005 | Package 5 domain/review command + visible UI | reducer/hash/decision/child tests, DOM, route inventory |
| FR-006–FR-012 | guarded apply server path + Package 1 finalizer | real D1 negative/zero-row/failure/replay/100-pair tests, dialog focus |
| FR-013, FR-021 | bounded history query + UI | D1 ordering/reload/DTO safety and browser reload states |
| FR-014–FR-017 | existing verifier + projection extension | pass/fail/unreviewed/replay/provenance real-D1 tests |
| FR-018–FR-020 | undo command + existing reset command | new-revision/old-approval/reset isolation/recovery tests |
| FR-022–FR-025 | existing request security + routes + UI | malformed/body/origin/CSRF/session parity, DOM/browser/a11y |
| FR-026 | real D1 enforcement test | no migration unless red; exact additive 0004 proof if needed |
| FR-027–FR-028 | package scripts, gate, evidence docs | canonical verify, bindings, reviewer/convergence evidence |

## Test-First Implementation Sequence

1. Write pure failing state/canonicalization tests for review actions, child lineage, apply request, history DTO, and guarded-result interpretation; implement the minimum domain file.
2. Write real-D1 review transition/idempotency/zero-row/failure tests; implement review/edit command. Add migration `0004` only if the existing schema cannot enforce complete rollback/recovery.
3. Write the complete apply negative matrix, every-statement zero/failure injection, lost-response recovery, and 100-pair concurrency test against real D1; implement guarded apply using existing application tables/finalizer.
4. Write pass-only/revision-1/unreviewed/replay projection tests; minimally extend verification persistence and add only proven enforcement.
5. Write history ordering/safety, undo new-revision/old-approval, and reset recovery/isolation tests; implement history/undo and reuse reset.
6. Write route boundary tests before thin route adapters; cover content type/body size/Origin/CSRF/session/unknown keys/foreign parity.
7. Write DOM tests before wiring accessible review/apply/history/undo/reset UI; preserve current observer/dialog behavior and exactly two registrations.
8. Write built Playwright journey and responsive/accessibility/uncertain-network checks before completing functional CSS/state handling.
9. Add coverage, Package 5 source/evidence binding, execution truth, and composed `verify:package5`; run the complete gate.
10. Run the two authorized read-only reviewers, reproduce/fix material findings, rerun affected/full tests, then invoke convergence exactly once.

## Failure Recovery

- **Rejected review/apply/undo**: no product mutation; return a stable code and current safe next action.
- **Uncertain response**: retain the original key, show recovering, and retry/read the committed result; never create a replacement key automatically.
- **Zero-row guard**: interpret authoritative state after rollback; never infer success from `success:true`.
- **Downstream zero row or statement error**: finalizer/forced error rolls back the batch; tests assert no success-like residue.
- **Concurrent apply**: unique contender/guard authority serializes one winner; loser maps to stale/already-applied without leakage.
- **Projection conflict/replay**: preserve distinct proven provenance, return original verification receipt, and never duplicate the same projection.
- **Interrupted test/evidence**: mark `INCONCLUSIVE`; do not fabricate totals or PASS.

## Engineering Lens Disposition

Applied once after Phase 1 design on 2026-08-31. The dependency graph, complete error/rescue map, happy/nil/empty/error flows, test coverage diagram, E2E decision, and locked architecture live in `eng-plan.md`. Disposition: **PASS — ready for test-first implementation after checklist/tasks/analyze**.

## Complexity Tracking

The feature necessarily crosses UI, routes, server commands, D1, verifier, browser tests, and evidence because the accepted Package 5 outcome is an end-to-end governed mutation. The design limits new production logic to one domain file, two server modules, four thin routes, and small extensions to existing verification/UI files. No new dependency, service, generalized abstraction, or later-package surface is planned.
