# Implementation Plan: Package 3 Raw Observer and Independent Verifier

**Branch**: `001-package-3-raw-observer-verifier` | **Date**: 2026-08-31 | **Spec**: `specs/001-package-3-raw-observer-verifier/spec.md`

**Input**: The immutable Prompt B specification and its Package 3 authority baseline.

**Planning status**: Gate 4 design only. Every source and test path below is a future implementation target; no product behavior or evidence status changes in Prompt C.

## Summary

Package 3 will extend the existing Next.js/React/Cloudflare D1 application with one privacy-bounded browser rehearsal lifecycle and one pure six-rule verifier. The browser records only allowlisted DOM facts and keyboard/focus events; the server binds them to its workspace, active variant, and named implemented revision, assigns order, freezes canonical digests, and rejects incomplete or altered sessions. Verification reads only the immutable session, manifest, events, and implemented configuration. A D1 guard/finalizer batch stores exactly one receipt, six checks, and one safe audit or rolls everything back.

The design reuses the current dialog, session resolver, request-security boundary, canonical configuration, crypto, D1 batch, safe-error, Vitest, jsdom, Playwright, and axe patterns. It adds no framework, dependency, database, identity path, deployment, tool registration, retrieval dependency, precedent projection, or background service. The existing Package 2 two-event opening report remains distinct from a complete Package 3 rehearsal.

## Technical Context

**Language/Version**: TypeScript 5.9.3 in strict mode; additive SQLite SQL through the existing Drizzle journal format; standard-library Python 3 only for the Prompt C planning validator

**Primary Dependencies**: Existing Next.js 16.3.3, React 19.2.8, Zod 4.5.4, Drizzle ORM 0.45.2, Cloudflare Workers/D1 bindings, Vitest 4.1, Testing Library, Playwright 1.62.1, and axe; no new dependency

**Storage**: Existing Cloudflare D1 SQLite database through prepared statements and additive migration `drizzle/0003_package3_raw_observer_verifier.sql`

**Testing**: Existing Node test runner/Vitest, Workers D1 pool, jsdom Testing Library, Playwright real browser, axe, static import scans, source manifests, and evidence binders

**Target Platform**: Existing Cloudflare Sites/Workers browser application; local and hosted release proof remain separate

**Project Type**: Full-stack web application with same-origin route adapters, server domain operations, D1 persistence, and a React client

**Performance Goals**: Enforce at most 64 observation events and 30 seconds per session as fail-safe ceilings; treat them as hosted-unconfirmed candidates until later load proof. Foreign/nonexistent identifiers share one response-size class and timing budget. No latency or scale claim is created by this plan.

**Constraints**: Server-resolved workspace/active subject; strict JSON and bounded bodies; UI CSRF and same Origin; no state-changing GET; no-store responses; actual allowlisted DOM facts only; no typed/arbitrary content; immutable finalization; pure verifier; natural-key replay; guarded atomic persistence; no projection or implemented-configuration mutation

**Scale/Scope**: One dialog family, one active variant/revision per workspace, six verifier behaviors, seven deliberate mutations, and evidence paths `E-006` through `E-011` plus `E-014`

**Unresolved technical context**: None. Runtime limits still requiring hosted proof are explicitly evidence tasks, not assumptions or founder decisions.

## Constitution Check

### Pre-design gate

| Principle | Result | Design consequence |
|---|---|---|
| Authority before derived artifacts | PASS | All 62 IDs remain mapped to the immutable Prompt B spec and source anchors; drift stops each Spec Kit stage. |
| Test-first execution | PASS | Every future behavior-changing task has an earlier failing test task and an explicit evidence destination. |
| Privacy and least authority | PASS | Closed IDs/enums, bounded metadata, server-owned workspace, no retrieval/review/apply/projection authority, and safe errors/logs are mandatory. |
| Real evidence before claims | PASS | Browser, D1, accessibility, privacy, coverage, and manual artifacts remain `NOT_RUN` until executed against identified bytes/runtime. |
| Simple existing architecture | PASS | Existing stack and helpers are reused; no new dependency, service, database, queue, worker, or tool registration is planned. |
| One-writer custody and bounded phase | PASS | Prompt C writes only planning/evidence artifacts and stops before implementation. |

### Post-design gate

PASS. `research.md`, `data-model.md`, `contracts/`, and `quickstart.md` preserve the same boundaries. The proposed route/service/table split is an implementation decomposition inside the selected stack, not a new product or founder decision. The 64-event/30-second ceilings are enforceable safety bounds but not hosted-confirmed performance evidence. Precedent projection is explicitly deferred.

## Architecture and Flow

1. The UI calls `POST /api/rehearsals/start`; the route resolves session/workspace, active variant, and revision, then creates one expiring recording session with a generated nonce digest.
2. The dialog observer captures the actual allowlisted manifest and raw events during the authority-defined keyboard journey. It never reads proposals, precedent, retrieval results, or expected traces and never decides pass/fail.
3. The UI calls `POST /api/rehearsals/{rehearsalSessionId}/finalize` once with the manifest and ordered raw event array. The server validates closed schemas and bounds, assigns authoritative sequences from accepted array order, canonicalizes bytes, and atomically freezes the manifest/events/digests behind a finalizer.
4. The UI calls `POST /api/verifications` with the opaque session ID and expected implemented revision. The service reloads the immutable rows under workspace/variant/revision predicates, recomputes both digests, then invokes `focus-event-verifier-v1` without retrieval/proposal/benchmark imports.
5. A guarded D1 batch rechecks all bindings and writes one receipt, six check rows, one safe audit, and one commit finalizer. Same-natural-key byte-identical replay returns the original; conflict returns no new row. Package 3 never projects precedent or changes configuration/review state.
6. The UI renders manifest semantics, overall outcome, all six textual results including `not_observed`, and raw sequence references with non-color meaning and restrained announcements.

## Project Structure

### Documentation generated for this feature

```text
specs/001-package-3-raw-observer-verifier/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── persistence.md
│   ├── rehearsal-api.md
│   ├── result-surface.md
│   └── verifier.md
├── checklists/
│   ├── requirements.md
│   └── gate4.md
├── tasks.md
└── traceability.json
```

### Future implementation targets

```text
app/
├── api/rehearsals/start/route.ts
├── api/rehearsals/[rehearsalSessionId]/finalize/route.ts
├── api/verifications/route.ts
├── delete-account-dialog.tsx
├── focus-contract-studio.tsx
└── globals.css
db/
├── package3-schema.ts
└── schema.ts
drizzle/
├── 0003_package3_raw_observer_verifier.sql
└── meta/_journal.json
lib/
├── domain/focus-rehearsal.ts
├── domain/focus-event-verifier.ts
├── server/focus-rehearsal.ts
└── server/verify-focus-contract.ts
scripts/
├── package3-evidence-binding.mjs
└── package3-source-manifest.mjs
docs/evidence/
├── PACKAGE3_ADVERSARIAL_REVIEW.md
└── PACKAGE3_VERIFICATION.md
tests/
├── package3-node/
│   ├── contracts.test.ts
│   ├── focus-event-verifier.test.ts
│   ├── privacy-scan.test.ts
│   ├── reference-boundary.test.ts
│   └── source-evidence.test.ts
├── package3/
│   ├── d1-vitest-setup.ts
│   ├── focus-rehearsal.test.ts
│   ├── routes.test.ts
│   └── verification-persistence.test.ts
├── package3-dom/focus-contract-studio.test.tsx
└── package3-browser/rehearsal.spec.ts
vitest.package3.config.ts
vitest.package3-node.config.ts
vitest.package3-dom.config.ts
wrangler.package3.jsonc
package.json
playwright.config.ts
.artifacts/test/unit.json
.artifacts/test/d1.json
.artifacts/test/component.json
.artifacts/test/verifier-independence.json
.artifacts/test/coverage-summary.json
.artifacts/browser/playwright.json
.artifacts/accessibility/axe.json
```

**Structure decision**: Keep the existing route → server operation → pure domain → D1 layering. A separate pure verifier prevents forbidden imports and makes 100% branch proof direct. One rehearsal server module owns start/finalize; one verification server module owns immutable reads, replay, and guarded receipt persistence. Package-scoped tests/config preserve prior-package evidence while reusing installed tooling.

## Requirement Design Map

Exactly one row maps each stable requirement to its primary design contract and future implementation boundary. Full authority, task, failing-test, and evidence links are in `traceability.json`.

| Requirement | Primary design reference | Future implementation boundary |
|---|---|---|
| P3-AUT-001 | `research.md#decision-1-authority-and-phase-custody` | Prompt C/implementation evidence validators |
| P3-AUT-002 | `research.md#decision-2-minimum-package-boundary` | Package 3 paths only |
| P3-AUT-003 | `contracts/verifier.md#authority-and-side-effect-boundary` | `lib/server/verify-focus-contract.ts` |
| P3-AUT-004 | `contracts/verifier.md#independence-boundary` | `lib/domain/focus-event-verifier.ts` |
| P3-AUT-005 | `contracts/persistence.md#failure-and-rollback-contract` | Package 3 routes and D1 finalizers |
| P3-OBS-001 | `contracts/rehearsal-api.md#start-rehearsal` | `app/api/rehearsals/start/route.ts`, `lib/server/focus-rehearsal.ts` |
| P3-OBS-002 | `data-model.md#rendered-manifest` | `app/delete-account-dialog.tsx`, `lib/domain/focus-rehearsal.ts` |
| P3-OBS-003 | `data-model.md#observation-event` | `lib/domain/focus-rehearsal.ts` |
| P3-OBS-004 | `contracts/rehearsal-api.md#server-ordering` | `lib/server/focus-rehearsal.ts` |
| P3-OBS-005 | `contracts/rehearsal-api.md#complete-rehearsal` | `app/delete-account-dialog.tsx` |
| P3-OBS-006 | `contracts/rehearsal-api.md#bounds-and-invalid-finalization` | `lib/domain/focus-rehearsal.ts`, `lib/server/focus-rehearsal.ts` |
| P3-OBS-007 | `data-model.md#privacy-inventory` | Observer/domain schemas and privacy scans |
| P3-OBS-008 | `contracts/verifier.md#independence-boundary` | Observer/verifier static import boundary |
| P3-OBS-009 | `contracts/persistence.md#rehearsal-finalization-batch` | `drizzle/0003_package3_raw_observer_verifier.sql` |
| P3-OBS-010 | `data-model.md#observation-session-state` | `lib/server/focus-rehearsal.ts`, `lib/server/verify-focus-contract.ts` |
| P3-OBS-011 | `contracts/persistence.md#immutability-and-lifecycle` | Package 3 migration triggers/foreign keys |
| P3-VER-001 | `contracts/verifier.md#input-contract` | `lib/domain/focus-event-verifier.ts` |
| P3-VER-002 | `contracts/verifier.md#pre-evaluation-rejection` | `lib/server/verify-focus-contract.ts` |
| P3-VER-003 | `contracts/verifier.md#independence-boundary` | Static dependency test |
| P3-VER-004 | `contracts/verifier.md#initialfocus` | Pure verifier |
| P3-VER-005 | `contracts/verifier.md#focusorder` | Pure verifier |
| P3-VER-006 | `contracts/verifier.md#traptab` | Pure verifier |
| P3-VER-007 | `contracts/verifier.md#trapshifttab` | Pure verifier |
| P3-VER-008 | `contracts/verifier.md#escapeaction` | Pure verifier |
| P3-VER-009 | `contracts/verifier.md#returnfocus` | Pure verifier |
| P3-VER-010 | `contracts/verifier.md#missing-evidence` | Pure verifier |
| P3-VER-011 | `contracts/verifier.md#overall-result` | Pure verifier |
| P3-VER-012 | `contracts/verifier.md#sequence-evidence` | Pure verifier/result schema |
| P3-VER-013 | `data-model.md#verification-receipt-and-check` | Verification persistence/result UI |
| P3-VER-014 | `contracts/persistence.md#natural-key-replay` | `lib/server/verify-focus-contract.ts` |
| P3-VER-015 | `contracts/persistence.md#natural-key-replay` | `lib/server/verify-focus-contract.ts` |
| P3-VER-016 | `contracts/verifier.md#authority-and-side-effect-boundary` | No projection/review/configuration target |
| P3-SEC-001 | `contracts/rehearsal-api.md#request-boundary` | Existing session/workspace resolver |
| P3-SEC-002 | `contracts/persistence.md#workspace-binding` | Every Package 3 SQL statement |
| P3-SEC-003 | `contracts/rehearsal-api.md#public-errors-and-id-oracle` | Package 3 routes/error mapping |
| P3-SEC-004 | `contracts/persistence.md#digest-recheck` | Finalize/verify repositories |
| P3-SEC-005 | `contracts/rehearsal-api.md#public-errors-and-id-oracle` | Existing `FcsError` envelope |
| P3-SEC-006 | `data-model.md#privacy-inventory` | Safe audit/log/evidence adapters |
| P3-SEC-007 | `contracts/persistence.md#truthful-fail-versus-invalid-input` | Verification repository |
| P3-SEC-008 | `contracts/persistence.md#natural-key-replay` | Unique key, concurrency recovery |
| P3-SEC-009 | `contracts/rehearsal-api.md#request-boundary` | All three route adapters |
| P3-SEC-010 | `contracts/persistence.md#verification-guard-and-finalizer-batch` | Package 3 migration/repository |
| P3-MUT-001 | `contracts/verifier.md#deliberate-mutation-matrix` | Pure verifier mutation test |
| P3-MUT-002 | `contracts/verifier.md#deliberate-mutation-matrix` | Pure verifier mutation test |
| P3-MUT-003 | `contracts/verifier.md#deliberate-mutation-matrix` | Pure verifier mutation test |
| P3-MUT-004 | `contracts/verifier.md#deliberate-mutation-matrix` | Pure verifier mutation test |
| P3-MUT-005 | `contracts/verifier.md#deliberate-mutation-matrix` | Pure verifier mutation test |
| P3-MUT-006 | `contracts/verifier.md#deliberate-mutation-matrix` | Pure verifier mutation test |
| P3-MUT-007 | `contracts/verifier.md#deliberate-mutation-matrix` | Pure verifier mutation test |
| P3-EVD-001 | `quickstart.md#scenario-1-positive-exact-traces` | Unit/contract evidence `E-006`, verifier `E-011` |
| P3-EVD-002 | `quickstart.md#scenario-2-missing-evidence` | Unit/contract evidence `E-006`, verifier `E-011` |
| P3-EVD-003 | `quickstart.md#scenario-3-integrity-isolation-and-replay` | D1 evidence `E-007` |
| P3-EVD-004 | `contracts/verifier.md#independence-boundary` | Static verifier-independence evidence `E-011` |
| P3-EVD-005 | `quickstart.md#scenario-4-privacy-marker` | Privacy scan bound into `E-011` |
| P3-EVD-006 | `quickstart.md#scenario-5-real-browser-and-manual-keyboard` | Browser evidence `E-009`, accessibility `E-010` |
| P3-EVD-007 | `contracts/result-surface.md#accessible-result-contract` | React result surface and DOM/browser tests |
| P3-EVD-008 | `quickstart.md#scenario-6-coverage` | Coverage evidence `E-014` |
| P3-EVD-009 | `quickstart.md#evidence-destinations` | `E-006`–`E-011`, `E-014`, traceability/review |
| P3-EVD-010 | `checklists/gate4.md` | Independent contract/security/accessibility reviews |
| P3-EVD-011 | `quickstart.md#evidence-language` | Evidence binder and summaries |
| P3-EVD-012 | `contracts/rehearsal-api.md#route-negative-matrix` | `tests/package3/routes.test.ts` |
| P3-EVD-013 | `contracts/persistence.md#failure-injection-matrix` | `tests/package3/verification-persistence.test.ts` |

## Implementation Sequence

1. Add failing schema/contract/import-boundary tests, then the closed domain schemas and pure verifier.
2. Add failing migration and real-D1 finalization tests, then the additive schema, rehearsal finalizer, verification guard/commit finalizer, and repositories.
3. Add failing route attack-matrix tests, then the three same-origin adapters using existing request/session/error helpers.
4. Add failing DOM/browser/privacy tests, then full actual-event capture and accessible result presentation.
5. Generate source-bound `E-006`–`E-011`/`E-014` outputs, run independent review, and update only evidence status actually proved by exact commands.

## Complexity Tracking

No constitution violation or new architectural layer is introduced. The guard and commit-finalizer tables are required enforcement rows for atomic D1 correctness, not a generic repository abstraction. Separate pure verifier and server persistence modules are the minimum split that makes forbidden dependencies and side effects mechanically testable.
