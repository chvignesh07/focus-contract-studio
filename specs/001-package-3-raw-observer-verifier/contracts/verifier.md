# `focus-event-verifier-v1` Contract

## Authority and side-effect boundary

Verification is an evidence operation. It cannot change the implemented configuration, active pointer, proposal, review/approval, undo/reset state, or precedent. Package 3 stores only a verification guard, receipt, six checks, safe audit, and commit finalizer for valid frozen evidence. Precedent projection and tool registration are deferred.

## Input contract

The server constructs one immutable input from workspace-scoped D1 reads:

- finalized full-rehearsal session and bounded environment;
- frozen actual-DOM manifest and recomputed/stored digest;
- frozen server-sequenced raw events and recomputed/stored digest;
- strict canonical implemented configuration for the session's named variant/revision.

The pure verifier receives no D1 handle, request/session object, callback, clock, random source, or mutable object.

## Pre-evaluation rejection

The server rejects before behavior evaluation when the session is nonexistent/foreign, recording/incomplete/expired, missing its full-rehearsal finalizer, stale or bound to another variant/revision, missing/duplicating child rows, outside bounds, post-finalize altered, or inconsistent with recomputed manifest/event digests. Rejection produces no verification receipt.

## Independence boundary

Production observer/verifier modules may import only closed domain schemas, canonical configuration types, and side-effect-free standard helpers. Static tests forbid direct or transitive imports/references to retrieval, proposal-target construction, field-evidence support, model logic, benchmark/holdout/reference-evaluator judgments, test fixtures, or expected-event generators. Neither module may synthesize user/browser events or decide an observation by comparing it with precedent/proposal data.

## Canonical output

Checks appear exactly once in this order:

1. `initialFocus`
2. `focusOrder`
3. `trapTab`
4. `trapShiftTab`
5. `escapeAction`
6. `returnFocus`

Each result is `pass | fail | not_observed` with ascending, unique raw event sequence references. References must exist in input. No generated expected-event reference is legal.

## initialFocus

Pass only when the first `focusin` after `dialog_open` equals configured `initialFocus` and exists in the frozen manifest. A different observed target fails. Missing open/focus evidence is `not_observed`.

## focusOrder

Pass only when the frozen manifest tabbable set equals the configured set and the first forward traversal beginning at the configured first tabbable target visits each configured target once in exact order before wrap. A changed order or manifest omission fails. Missing a complete traversal is `not_observed`.

## trapTab

Pass only when `keydown(Tab, shift=false)` on the configured final target is followed by `focusin` on the configured first target with no outside target between them. An observed escape fails; missing boundary evidence is `not_observed`.

## trapShiftTab

Pass only when `keydown(Tab, shift=true)` on the configured first target is followed by `focusin` on the configured final target. An observed escape fails; missing boundary evidence is `not_observed`.

## escapeAction

Pass only when `keydown(Escape)` while open is followed by `dialog_close(reason=escape)` and the trace contains no destructive close/dispatch. Staying open or closing with `delete` fails. Missing close evidence is `not_observed`.

## returnFocus

Pass only when the first focus-return fact after close targets `delete-trigger`. Another target fails; missing return evidence is `not_observed`.

## Missing evidence

The verifier distinguishes observed contradiction (`fail`) from absent/insufficient proof (`not_observed`). Both make overall result fail. It never fills a gap from configuration, a fixture, or expected trace.

## Overall result

Overall is `pass` only when every canonical check is `pass`; otherwise it is `fail`. The reduction has no other state and cannot be overridden by caller input.

## Sequence evidence

Each check cites the minimal raw sequence numbers used to establish its result, including contradictory sequences for `fail` and the available partial boundary for `not_observed`. Sequence references are informational evidence bindings, not generated events.

## Deliberate mutation matrix

| Mutation | Required isolated result |
|---|---|
| P3-MUT-001 — Delete first when Cancel configured | `initialFocus=fail` |
| P3-MUT-002 — swap Cancel/Delete forward traversal | `focusOrder=fail` |
| P3-MUT-003 — omit one configured tabbable manifest target | `focusOrder=fail` |
| P3-MUT-004 — forward Tab escapes to trigger/background | `trapTab=fail` |
| P3-MUT-005 — backward Shift+Tab escapes | `trapShiftTab=fail` |
| P3-MUT-006 — Escape stays open or dispatches Delete | `escapeAction=fail` |
| P3-MUT-007 — close returns to body/title/other target | `returnFocus=fail` |

Each test changes one raw fact from a literal positive trace, keeps unrelated evidence valid, asserts the named check fails, and proves fixture/configuration edits cannot create observed rows.
