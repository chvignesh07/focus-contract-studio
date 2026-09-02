# Package 6 Red-to-Green Evidence

Date: 2026-09-01

Scope: local Package 6 candidate only. This artifact records observable focused test outcomes and does not claim hosted, real-client, founder-manual, or deployed evidence.

## Red gate — before production edits

| Suite | Result | Expected failing evidence |
|---|---:|---|
| `npm run test:package6:node` | RED · 0 pass / 1 fail | `ERR_MODULE_NOT_FOUND` for the intentionally absent `lib/domain/package6.ts` presentation policy. |
| `npm run test:package6:d1` | RED · 0 tests / 1 failed suite | After one sandboxed loopback `EPERM` was correctly treated as `INCONCLUSIVE`, the authorized loopback rerun failed on the intentionally absent `app/api/active-variant/route.ts`. |
| `npm run test:package6:dom` | RED · 0 pass / 2 fail | The Package 5 surface lacked the product-story heading/six-stage rail, and Approve was enabled without exact acknowledgement. |

The red failures reproduce missing Package 6 behavior rather than a frozen Package 5 regression. Production implementation began only after this gate.

## Green gate

Status: `PASS`

| Suite | Result |
|---|---:|
| Package 6 Node core | `7/7` |
| Package 6 real D1 | `3/3` |
| Package 6 DOM | `4/4` |
| Package 6 coverage replay | `4/4`; `100%` lines, branches, and functions for `lib/domain/package6.ts` |
| Package 6 built browser | `4/4` desktop, 320 px, 375 px, and 640 CSS px at DPR 2 responsive emulation; browser UI 200% zoom `NOT_RUN` |

The browser journeys run the complete human workflow with WebMCP unavailable and assert native-dialog modality, keyboard focus/order/wrap/return, exact acknowledgement and confirmation, lost-response recovery, durable receipt/copy/rehearsal, six verification checks, chronological history, undo/reset/reload, reduced motion, 44 px targets, page reflow, and zero axe critical or serious findings.

## Attribution boundary

- Local candidate: in scope
- Hosted runtime: `NOT_RUN`
- Real WebMCP client: `NOT_RUN`
- Founder manual accessibility session: `NOT_RUN`
- Deployed cold evaluator: `NOT_RUN`
