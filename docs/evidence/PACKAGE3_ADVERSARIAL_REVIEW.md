# Package 3 Adversarial Review

<!-- package3-source-binding file_count=39 sha256=4a1dd4a98666eb0f0a7bb1d93fed2333eaf27c21612d0bff3bafefb4c202b154 -->

Status: **PASS**

Review wave: two bounded independent read-only reviewers; the repository root remained the only writer. The first reviewer covered both contract/state-machine and security/privacy. The second covered testing/accessibility.

- contract/state-machine — disposition: PASS
- security/privacy — disposition: PASS
- testing/accessibility — disposition: PASS

## Reconciled findings

| Severity | Finding | Permanent disposition | Verification |
|---|---|---|---|
| High | A receipt for revision N stopped replaying after N+1 became active. | Replay now resolves the frozen verified session and exact immutable result before rejecting a stale first-time request. | Real-D1 regression replays the exact receipt with no additional guard, receipt, checks, audit, commit, or session write; a new stale request still rejects. |
| High | Package 1 and Package 2 gates admitted every later numbered migration. | Their configurations now select exactly 0001 and 0002; Package 3 selects exactly 0001 through 0003. | Exact-list guards fail if a future migration enters either frozen earlier-package gate; Package 1 D1 remains 59/59. |
| High | The completion control became unfocusable while starting, obscuring status and focus continuity. | It remains focusable with `aria-disabled`; the shared guard suppresses pointer, Enter, and Space re-entry while the associated status remains available. | DOM regression proves one start call, focus continuity, accessible description/status, and suppression of every activation path. |
| High | Native dialog focus restoration could precede the close handler and strand completion. | One idempotent focus-return finalizer now checks closed state, recorded close, expected active element, and clears capture before callback. | Built-browser rehearsal completes from real keyboard input and returns focus without a duplicate finalizer. |
| High | Candidate publication proof was blocked by unrelated local-only refs containing machine paths. | The publication gate now scans the candidate HEAD, every reachable ancestor, and its tracked tree, with no exception for forbidden paths. | Package 0 publication passes on the sanitized lineage; planted forbidden-path revisions still fail. |
| High | Source-bound evidence still described the superseded 34-path overlay and left T044 incomplete. | Every authorized repair path is in the exact 39-file source union; all seven artifacts and both Markdown records were rebound after the authoritative runs. | Source and evidence binders require 46/46 tasks, exact paths, exact hashes, and the clean-clone row. |
| High | An incomplete lifecycle could finalize. | Shared schema and D1 finalizer completeness checks reject it. | Real-D1 invalid-lifecycle cases persist no finalizer. |
| High | Duplicate focus visits or a destructive close after Escape could satisfy a claimed behavior. | The pure verifier rejects both sequences. | Independent verifier regressions return fail from the observed sequence only. |
| High | First verification after expiry could persist a receipt. | Expiry is checked before evaluation and repeated in the atomic guard. | Expired first verification creates no Package 3 verification rows. |
| Medium | Per-check linkage was implicit. | One verifier-output hash binds guard, receipt, six checks, audit, and commit. | Twenty injected failure positions and zero-row writes roll back the whole batch. |
| Medium | Browser privacy proof lacked end-to-end marker coverage. | Browser input, request, response, result, storage, reports, and bound evidence are scanned. | The synthetic marker is absent from every controlled surface. |

The contract reviewer initially flagged the new publication and frozen-migration scopes, then withdrew the finding after checking the explicit founder authorization and the planted negatives. The testing/accessibility reviewer flagged only the intentionally stale pre-finalization evidence; this row records its permanent resolution.

Accepted bounded limitations: browser-origin observations are not hardware-attested, local response-parity checks are not hosted timing proof, and automated scale emulation is not founder-operated browser zoom. Hosted and manual claims remain separate.

controlling requirements: 62/62

unresolved critical/high: 0

missing controlling requirements: 0
