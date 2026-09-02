# Focus Contract Studio — Accessibility and Independent Verification

Status: **RELEASE-BLOCKING v2**

## Scope

The product demonstrates six keyboard-focus behaviors for one dialog family. It does not certify WCAG conformance or general accessibility. Automated checks and one named founder-operated manual session are both required.

## Renderer contract

- Renderer consumes only the active `implemented_focus_revisions` configuration.
- Seed revision 1 focuses Delete; revision 2 focuses Cancel after apply. No hidden mismatch toggle.
- Native `<dialog>` is named/described, modal, and restores inert background behavior.
- `focusOrder` matches actual rendered tabbable controls; no positive `tabindex`.
- Stable target IDs are data enums, not selectors accepted from callers.

## Observer independence

At observation start, browser code captures actual allowlisted DOM facts:

- present focus target IDs;
- actual tabbable DOM order;
- dialog role/open/modal/name/description flags;
- variant and implemented revision returned by the server.

It then records only allowlisted focus/key/open/close/return events. It does not read the proposed/precedent outcome to generate events, dispatch fake focus movements in production, record typed values, or decide pass/fail. Manifest/events are canonicalized, hashed, and frozen before verification.

## Complete rehearsal script

One complete verification session performs in this order:

1. Focus `delete-trigger`; open dialog.
2. Record first `focusin`.
3. From the first tabbable target, press Tab through the entire configured order once.
4. On the final target, press Tab and observe wrap to first.
5. On the first target, press Shift+Tab and observe wrap to final.
6. Press Escape before destructive dispatch; observe close reason.
7. Observe focus return to `delete-trigger`.

Session has ≤64 events and ≤30 seconds; interrupted/extra/unknown sequences fail validation.

## Verifier v1 rules

Verifier input: immutable rendered manifest, raw events, named implemented configuration. Output references exact event sequence numbers.

| Check | Exact pass rule |
|---|---|
| `initialFocus` | First `focusin` after `dialog_open` equals configured `initialFocus`; target exists in manifest. |
| `focusOrder` | The first forward traversal from configured first tabbable target visits each configured target once in exact order before wrap; manifest tabbable set equals configured set. |
| `trapTab` | `keydown(Tab, shift=false)` on configured final target is followed by `focusin` on configured first target with no outside target. |
| `trapShiftTab` | `keydown(Tab, shift=true)` on configured first target is followed by `focusin` on configured final target. |
| `escapeAction` | `keydown(Escape)` while open is followed by `dialog_close(reason=escape)` and no `dialog_close(reason=delete)`. |
| `returnFocus` | First focus-return fact after close equals configured `delete-trigger`. |

Missing evidence is `not_observed`; overall passes only when all six pass. A receipt records event/manifest digests, verifier version, revision, active-at-verification, results, and sequences.

## Deliberate mutation tests

Each must fail its named check without relying on expected fixture generation:

1. initial focus Delete vs configured Cancel;
2. swap Cancel/Delete traversal order;
3. omit one rendered tabbable target;
4. Tab escapes to trigger/background;
5. Shift+Tab escapes;
6. Escape stays open or dispatches Delete;
7. close returns focus to body/title.

Static dependency test forbids verifier imports from retrieval, benchmark expected judgments, proposal field-support logic, or any test-only event generator.

## Automated accessibility gates

- semantic landmark/heading/name/description tests;
- real-browser assertions that the open dialog exposes its accessible name, description, and modal semantics and that background controls reject pointer activation and keyboard focus until close;
- keyboard-only E2E for complete anonymous hero, review, apply, verify, history, undo;
- axe scan with zero critical/serious violations on key states;
- 320 px, 375 px, and 640 CSS px at DPR 2 responsive emulation without lost controls/two-dimensional scrolling;
- visible focus and measured color contrast;
- focused-element bounds and occlusion assertions for every actionable control at desktop, 320 px, 375 px, and 640 CSS px at DPR 2 responsive emulation. Actual browser UI 200% zoom remains a founder-manual release requirement, `NOT_RUN` until completed against the exact deployed version.
- reduced-motion behavior;
- live-region restraint and error association.

## Founder-operated manual session

The founder must operate and record against the exact public Sites version:

| Environment | Checks |
|---|---|
| macOS + current Safari | Complete human UI keyboard path, zoom, narrow viewport, reduced motion. |
| macOS + current supported Chrome | Human UI path; WebMCP separately only if Chrome probes passed. |
| macOS VoiceOver + Safari | Dialog announcement, names/roles/states, reading/focus order, proposal/review/verification comprehension. |
| macOS VoiceOver + supported Chrome | Bounded smoke and documented differences if available. |

The exact-release manual checklist separately dispositions (1) exposed dialog name/description/modal semantics and blocked background pointer/keyboard interaction while open, and (2) every focused actionable control remaining visible, inside the viewport, and unobscured at desktop, 320 px, 375 px, and 200% zoom. Automated bounds or semantics checks support but do not replace these manual observations.

Evidence includes operator, date, source commit `C`, Sites version/deployment URL, browser/OS/AT versions, exact checklist, PASS/FAIL/INCONCLUSIVE, and screenshots/video where safe. If VoiceOver is unavailable or comprehension fails, the submission cannot claim it passed.

## Cold evaluator

A fresh internal evaluator with no history answers all five questions in `UX_SPEC > Cold comprehension gate` from the deployed release, including what verification proves and does not prove. Label this “internal cold evaluation,” never “user research.”
