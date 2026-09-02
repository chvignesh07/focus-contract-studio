<!-- package5-source-binding file_count=61 sha256=5ddb4b6d47c7b7097cdae8390a036496dc4d11e4538907c7fcb7b41d13d7fe15 -->
# Package 5 Execution Evidence

Status date: **2026-09-01 EDT**

Foundational red proof: `PASS`

- Migrations 0001–0003 failed the focused review, undo, and runtime-projection completeness tests while inherited application/reset enforcement remained green. Additive migration 0004 supplied only the proven missing finalizers.
- The first strengthened application-finalizer test failed because the inherited trigger did not prove stale-sibling completeness. Migration 0004 replaced that trigger and the negative matrix passed.
- The first compound history implementation exceeded D1's compound-select limit. Eight individually bounded, allowlisted queries now return proposal, decision, application, revision, verification, projection, rehearsal, and safe reset/failure history.
- The first lost-response browser run exposed raw `Failed to fetch`; the shared mutation boundary now retains the original idempotency key and reports an uncertain outcome.
- The first projection journey exposed stale visible history after verification; verification now refreshes the bounded read model.
- Initial adversarial review exposed unsupported evidence on reviewer children/novel proposals, missing history classes, non-production coverage evidence, incomplete reload/focus proof, and device-scale emulation rather than CSS zoom 2×. Each finding was reproduced, fixed at the shared boundary, and retained as regression coverage.
- The first corrected full core gate exposed a double focus-restoration race after the native dialog closed. A trace showed two observation requests: `closeDialog` and `onClose` each queued return focus. `onClose` is now the single owner; the CSS zoom 2× journey passed three repeated focused runs before the full matrix passed.
- Two later exact-clone Package 6 gates exposed a remaining Package 5 test race: the browser returned focus immediately, but the intentional next-animation-frame restoration could still steal focus from the next action. An immediate `#delete-trigger` assertion alone produced `39/40`; retaining that assertion, crossing exactly one animation frame inline, and asserting the trigger again produced `40/40` with zero retries and no production change.

Focused green evidence:

| Gate | Result |
|---|---|
| Package 5 Node, including source/evidence tamper tests | `15/15` |
| Package 5 real D1 | `24/24` across 7 files |
| Package 5 DOM | `6/6` |
| Package 5 built browser | `4/4` desktop, 320 px, 375 px, CSS zoom 2×; browser UI 200% zoom `NOT_RUN` |
| Package 5 focus-return stress | `40/40` across the four profiles with `--repeat-each=10` and zero retries |
| Safety-core coverage | `100% lines / 100% branches / 100% functions` |
| Server-operation production-source coverage | `100% lines / 100% branches / 100% functions`; thresholds `90/85/90` |
| Coverage threshold negative control | `PASS`: planted incomplete fixture is rejected |
| Same-base concurrency | `100 winners / 100 losers / 0 partial graphs` across 100 pairs |
| Frozen inherited Package 4 gate | `303/303` from exact commit `0f85ad66ef6aa190abdfa9f003b1bd96a8a84a7f` |
| Package 5 post-core local gate | `355/355` including inherited Package 4 |
| Full composed Package 5 verification | `360/360` including five source/evidence tests |

Complete local gate: `PASS`

Package 9 truth correction: Package 5 automation set CSS
`document.documentElement.style.zoom = "2"`; it did not change the browser UI zoom
control. The historical counts remain unchanged, and actual browser UI 200% zoom
remains `NOT_RUN`. The historical Package 5 source-binding marker is preserved for
provenance; the Package 9 candidate source binder covers this correction.

External deployment, hosted D1, real ChatGPT/client, billing, publication, and Package 6 work were not run.
