# Validation Quickstart: Package 3 Raw Observer and Independent Verifier

This is the post-implementation validation protocol generated at planning time. Every product/evidence check below is currently `NOT_RUN`. A command becomes evidence only when its later artifact records exact source/runtime identity and completes without interruption.

## Prerequisites

- Start from the exact future implementation commit in a clean, credential-free clone.
- Use the repository-pinned Node/npm toolchain and existing generated lockfile; add no dependency for Package 3.
- Create a fresh local D1 database from migrations `0001` through `0003` with synthetic data only.
- Keep hosted credentials, personal browser profiles, raw cookies, CSRF tokens, identity headers, typed content, and private account data out of artifacts.
- Confirm Prompt A/B authority and Package 3 traceability validators pass before executing product evidence.

## Planned command gate

Implementation tasks will add package-scoped scripts that compose existing tools:

```text
npm run test:package3:node
npm run test:package3:d1
npm run test:package3:dom
npm run test:package3:browser
npm run test:package3:coverage
npm run verify:package3
```

The canonical `verify:package3` gate must run typecheck/lint/build as applicable, the five Package 3 layers, static dependency/privacy/secret/symlink scans, source/evidence binding, and prior-package frozen-source proof. An interrupted command is `INCONCLUSIVE`.

## Scenario 1: Positive exact traces

1. Start from both supported strict implemented configurations in isolated workspaces.
2. Feed the pure verifier literal raw positive traces that were not generated from expected-event production logic.
3. Assert exactly six `pass` checks in canonical order, valid raw sequence references, and overall `pass`.
4. In real D1, finalize matching sessions and verify each; assert one immutable receipt, six checks, one safe audit, and no configuration/review/proposal/precedent mutation.

Expected evidence: `E-006`, `E-007`, and `E-011` record `PASS` only with exact commit, commands, runtime versions, counts, hashes, and raw-output references.

## Scenario 2: Missing evidence

Remove each required evidence boundary independently: opening/first focus, complete forward traversal, forward wrap, backward wrap, escape close, and return focus. The named check must be `not_observed`, overall must be `fail`, and no configuration mutation may occur. Missing facts cannot be filled from configuration or fixtures.

## Scenario 3: Integrity, isolation, and replay

On real D1, test nonexistent, foreign, stale, wrong-variant, wrong-revision, unfinished, expired, overflow, tampered digest, reordered rows, post-finalize update/delete, byte-identical replay, conflicting replay, and concurrent natural-key attempts. Compare foreign/nonexistent public code/status/size/timing classes. Force guard, receipt, each check, audit, and finalizer zero/error outcomes.

Expected: invalid evidence leaves no receipt; a valid mismatch leaves one truthful fail receipt; same replay returns one original; conflict preserves it; concurrency leaves exactly one complete receipt; every injected partial failure rolls back.

## Scenario 4: Privacy marker

Enter a unique synthetic sensitive marker in the optional reason field and inject it into rejected request fields. Complete the rehearsal and scan D1 Package 3 tables, application logs, public errors, URLs, UI/tool outputs, test reports, screenshots/traces, and evidence artifacts.

Expected: the marker and raw session/identity/CSRF materials are absent everywhere. Persisted observation contains only allowlisted identifiers/enums/Booleans/small integers/digests/timestamps.

## Scenario 5: Real browser and manual keyboard

With Playwright against local D1, use browser keyboard actions to focus the trigger, open the dialog, observe first focus, traverse the complete configured order, forward wrap, backward wrap, Escape close before destructive action, and focus return. Assert actual accessible name/description/modal state and blocked background pointer/keyboard focus. Do not inject or manufacture events.

Repeat observable layout/focus assertions at desktop, 320 px, 375 px, and 200% zoom; assert no two-dimensional scrolling, occlusion, or out-of-viewport actionable focus. Exercise reduced motion and axe with zero critical/serious violations. Confirm the result surface is textual, keyboard accessible, restrained in live announcements, and shows six checks/`not_observed`/overall/sequences.

A later bounded founder keyboard smoke and exact-release Safari/Chrome/VoiceOver protocol remain manual evidence; automation cannot mark those checks complete.

## Scenario 6: Coverage

Run branch coverage over `lib/domain/focus-event-verifier.ts` and every deliberate/missing/tamper path. The verifier safety core must report 100% branches. Remaining first-party Package 3 code must meet repository thresholds without exclusions or weakened assertions. Bind the raw coverage summary to the exact source manifest.

## Seven deliberate mutations

Run `P3-MUT-001` through `P3-MUT-007` independently. Each literal raw trace changes only its named behavior and must fail the named check. A fixture/configuration-only change cannot create observed evidence or turn a missing trace into pass.

## Route attack matrix

For every Package 3 route, execute wrong method/GET, wrong or absent content type, malformed/oversized JSON, unknown fields, malformed ID, absent/invalid session, cross-origin request, missing/invalid CSRF, foreign/nonexistent IDs, and internal failure. Assert safe envelope, no-store, no oracle, zero success rows, and unchanged product authority state.

## Evidence destinations

| ID | Required later output | Package 3 proof |
|---|---|---|
| E-006 | `.artifacts/test/unit.json` | Closed schemas, canonicalization, six rules, missing evidence, mutations. |
| E-007 | `.artifacts/test/d1.json` | Migrations, isolation, immutability, guard/finalizer, rollback, replay, concurrency. |
| E-008 | `.artifacts/test/component.json` | Result states, semantic dialog/result text, error/live-region behavior. |
| E-009 | `.artifacts/browser/playwright.json` | Real-browser complete rehearsal, background inertness, focus/layout assertions. |
| E-010 | `.artifacts/accessibility/axe.json` | Zero critical/serious automated findings on key states. |
| E-011 | `.artifacts/test/verifier-independence.json` | Privacy/import boundary, six checks, seven mutations, no manufactured evidence. |
| E-014 | `.artifacts/test/coverage-summary.json` | 100% verifier branches and repository thresholds. |

Traceability and independent review summaries must bind these outputs to the same source/runtime identity without embedding secret or local absolute paths.

## Evidence language

Use only `PASS`, `FAIL`, `INCONCLUSIVE`, `NOT_RUN`, or `NOT_APPLICABLE` with the authority-defined meanings. A plan, mock, generated trace, local HTTP success, screenshot, interrupted process, or unbound JSON cannot establish implementation/browser/accessibility/privacy/security/verifier success. Hosted/manual evidence remains separate and cannot be inferred from local execution.
