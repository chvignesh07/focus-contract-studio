# Implementation Plan: Package 6 Premium Accessible Product Surface

**Branch**: `feat/package-6-premium-surface` | **Date**: 2026-09-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-package-6-premium-accessible-surface/spec.md`

## Summary

Keep Package 5's complete state machine and two WebMCP tools intact. Add one protected active-variant CAS route, a small pure presentation-policy module for stage/state/allowlist truth, safe precedent presentation fields, and a focused redesign of the existing React surface. Prove the result with Package 6 route/domain/DOM/built-browser tests, deterministic visual manifests, one context-free cold evaluation, two read-only reviews, source/evidence binding, and inherited frozen Package 5 verification.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 22.22.3

**Primary Dependencies**: React 19.2.8, Next 16.3.3 via Vinext, Zod 4.5.4, Drizzle ORM 0.45.2, Cloudflare Workers/D1; no additions

**Storage**: Existing local Cloudflare D1 schema through migrations 0001–0004; no Package 6 migration

**Testing**: Node test runner, Vitest, Cloudflare workers pool, Testing Library/jsdom, Playwright 1.62.1, axe-core

**Target Platform**: Same-origin browser UI backed by a local Cloudflare Worker; desktop, 320 px, 375 px, and 200% page zoom

**Project Type**: Full-stack web application

**Performance Goals**: One CAS mutation then one parallel review/history refresh; stale reads aborted; no polling or new runtime dependency

**Constraints**: Preserve Package 5 behavior, exact two-tool input/output contract, native dialogs, private identifier boundary, 44 px targets, no page horizontal overflow, zero serious/critical axe findings, no external action

**Scale/Scope**: One working-product page, two allowlisted variants, six derived stages, fourteen named state classes, one local checkpoint

## Constitution Check

*GATE: Passed before Phase 0 and rechecked after Phase 1.*

- **Bridge, not brain**: PASS. Presentation derives from existing committed truth; no new authority or knowledge store.
- **Retrieval is evidence**: PASS. New evidence fields are safe display metadata; review authority remains explicit visible UI state.
- **Bounded observation**: PASS. DTO remains allowlisted/bounded, visual evidence stores hashes/manifests, and WebMCP outputs remain unchanged.
- **Independent verification**: PASS. Verification wording and six raw-sequence rows preserve the independent rendered-revision comparison.
- **Guarded writes**: PASS. The only new write is an allowlisted same-origin CAS route reusing `setActiveVariant`; reviewer acknowledgement adds no authority by itself.
- **Evidence completes the package**: PASS. Local gate, design resolution, cold evaluator, reviewers, binding, and exact-clone proof are required; external rows remain `NOT_RUN`.
- **Ponytail/YAGNI**: PASS. No migration, dependency, component framework, duplicate workflow, telemetry, polling, or Package 7 capability.

## Project Structure

### Documentation (this feature)

```text
specs/004-package-6-premium-accessible-surface/
├── ceo-plan.md
├── design-review.json
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── active-variant-api.md
│   └── presentation-contract.md
├── checklists/
│   ├── requirements.md
│   └── package6.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── api/active-variant/route.ts
├── delete-account-dialog.tsx
├── focus-contract-studio.tsx
└── globals.css
lib/
├── domain/package6.ts
├── server/active-focus-review.ts
├── server/precedent-repository.ts
└── server/workspaces.ts
tests/
├── package6/
├── package6-node/
├── package6-dom/
└── package6-browser/
scripts/
├── package6-verify-package5-frozen.mjs
├── package6-source-manifest.mjs
├── package6-evidence-binding.mjs
└── package6-local-gate.mjs
docs/evidence/
├── PACKAGE_6_*.md
└── EXECUTION_STATE.{md,json}
```

**Structure Decision**: Extend the existing single-page/server-route vertical spine. `lib/domain/package6.ts` contains only pure, independently testable presentation policy. Existing Package 5 operations remain the sole mutation and durable-history implementation.

## Red-to-Green Sequence

1. Write pure state/stage/DTO tests and route/DOM contract tests; retain the failing output.
2. Implement the smallest domain policy, allowlisted route, safe DTO mapping, acknowledgement/cancellation, receipt continuation, and real-state markup.
3. Redesign the existing stylesheet with tokens and responsive rules; do not introduce a component framework.
4. Add built-browser journeys for four profiles, native dialog/inertness, axe, visible focus/actions, no horizontal overflow, full no-WebMCP flow, screenshots, and receipt/timeline behavior.
5. Bind design resolution, cold answers, reviewers, source manifest, and local-gate evidence; converge exactly once.

## Complexity Tracking

No constitution violation requires an exception.
