# Engineering Plan: Package 5 Review, Apply, Verify, Undo, and Reset

## Scope Challenge

Cross-domain work is required because the accepted outcome spans visible review authority, same-origin request protection, D1 atomicity, independent raw verification, history, revisioned recovery, browser accessibility, and evidence binding. The production change is deliberately constrained to one domain file, two operation modules, four thin routes, and small extensions to existing verification/UI code. No new dependency, service, generalized abstraction, or WebMCP registration is justified.

## Dependency Graph

```text
                         [FocusContractStudio UI]
                         /    |       |       \
                        v     v       v        v
             [review route] [apply] [history] [undo/reset]
                        \      |       |        /
                         v     v       v       v
                    [existing request security/session]
                                  |
                    +-------------+-------------+
                    |             |             |
                    v             v             v
          [package5-review] [apply/history/undo] [existing verifier]
                    \             |             /
                     +------------+------------+
                                  |
                                  v
                     [existing D1 tables/triggers]
                                  |
                                  v
               [receipts/history/runtime precedent/revisions]

[existing WebMCP registry] ---> read + create only; no edge to review authority
```

No cycle is permitted from retrieval, WebMCP, verifier output, or history back into review authority.

## Error and Rescue Table

| Failure | Raised/detected at | Caught/mapped at | Recovery |
|---|---|---|---|
| Malformed/oversized/wrong-content-type body | `readStrictJsonMutation` | thin route | Stable non-retryable public error; zero command call. |
| Wrong Origin or CSRF | request security | thin route | Stable 403-class public error; zero product write. |
| Missing/expired/rotated session | workspace resolver | thin route | Explain expired demo; bootstrap a new isolated workspace only through the existing explicit path. |
| Foreign/nonexistent proposal or revision | workspace-scoped query | command/error mapper | Identical not-found envelope/status/size class; no existence detail. |
| Invalid review transition | review command guard | command/error mapper | Show current state and safe next action; no decision/audit residue. |
| Idempotency key with different request | replay resolver | command/error mapper | `IDEMPOTENCY_CONFLICT`; require a deliberate new action/key. |
| Same-key committed replay | replay resolver | command | Return original decision/child/application/revision/reset result with replay flag. |
| Apply guard affects zero rows | first batch result | guarded-result interpreter | Treat as failure, inspect authoritative state after rollback, map stable state error. |
| Required downstream write affects zero rows | exact result check/finalizer | command | Force/observe batch abort; no success residue; safe internal/state error. |
| D1 constraint/statement/finalizer error | D1 batch | command | Transaction rollback; same key may recover if commit status is uncertain. |
| Response lost before commit | browser fetch | UI recovery reducer | Retry same key; remain `OUTCOME UNCERTAIN` until authoritative result. |
| Response lost after commit | browser fetch | UI recovery reducer | Same-key retry returns original receipt; never submit a new key automatically. |
| Concurrent same-base loser | unique guard/active pointer | command mapper | Return stale/already-applied state; winner receipt remains authoritative. |
| Verification session incomplete/foreign/stale | existing verifier command | verification route/UI | Request a fresh rehearsal; no receipt/projection. |
| Passing receipt lacks reviewed applied lineage | projection guard | verification command | Store verification only; `precedentProjected=false`. |
| Projection duplicate/replay | natural key/guard | verification command | Return original verification receipt and existing projection flag. |
| Undo source/current revision mismatch | undo guard | undo route/UI | `STALE_REVISION`; refresh history; no pointer change. |
| Reset response uncertain | existing reset command/fetch | UI recovery reducer | Retry same key; rotate cookie/state only from committed reset response. |
| Unexpected programming error | command boundary | `errorResponse` | Safe `INTERNAL_ERROR` with correlation ID; no stack/SQL/path leakage. |

## Four-Path Data Flow

### Happy

Open immutable proposal → visible exact approval → guarded apply creates revision 2 and receipt → fresh raw rehearsal → independent six-check pass → exactly one runtime precedent → reload history → undo creates later revision → deliberate reset creates new workspace generation.

### Nil

No proposal, no decision, no application, or no finalized rehearsal yields a closed empty state with one safe next action. No placeholder success, hidden desired state, or inferred authority is created.

### Empty

An empty history/projection collection is valid for a fresh workspace. Retrieval abstention disables agent-authored changed proposals but does not remove the reviewer-authored visible path. Zero-row mutations are failures, not empty successes.

### Error

Request-boundary errors stop before commands. Guard/state errors produce zero mutation. Statement/finalizer errors roll back. Uncertain network outcomes retain the same key and recover committed truth. Public output remains non-oracular and redacted.

## Test Coverage Diagram

- `lib/domain/package5.ts`: ★★★ — canonical vectors, every state transition, nil/empty/error, guarded-result branch coverage.
- `lib/server/package5-review.ts`: ★★★ — real-D1 happy path, full invalid matrix, idempotency, injected zero/error, foreign parity.
- `lib/server/package5-apply-history-undo.ts`: ★★★ — apply/undo/history, every batch statement, 100-pair race, lost response, old-approval invalidation.
- `lib/server/verify-focus-contract.ts` projection extension: ★★★ — pass/fail/unreviewed/revision-1/replay/provenance/seed immutability.
- Package 5 routes: ★★★ — strict body/method/content type/Origin/CSRF/session/unknown keys and safe errors.
- `FocusContractStudio`: ★★★ — DOM state/recovery/live region plus full built Playwright journey and accessibility automation.
- Existing reset: ★★★ regression — deliberate confirmation, replay, current-workspace isolation, reload.
- Source/evidence binders: ★★★ — strict inventories, tamper negatives, reviewer/convergence/evidence truth.

**E2E**: Required. One built Playwright journey proves the complete Package 5 visible loop, reloads, uncertainty recovery, keyboard flow, native dialog semantics, and responsive/zoom states.

**LLM evaluation**: Not required for Package 5. The local checkpoint proves deterministic product behavior; real ChatGPT is a later external gate.

## Decisions Locked

- Reuse existing dependencies and D1 entities first; `0004` is red-test-gated.
- Preserve exactly two WebMCP registrations.
- Review/undo/reset stay UI-only.
- Keep diagnostic reads non-authoritative; authorize inside guarded writes.
- Inspect every D1 result and exact affected count.
- Project only inside the committed verification boundary.
- Model history as a derived bounded DTO, not a duplicate event store.
- Use same-key recovery for every uncertain mutation.
- Stop after the clean local checkpoint.

## Ready for Implementation

YES — after the reviewer-owned requirements checklist is generated and the Spec Kit task/analyze stages show no critical coverage gap.
