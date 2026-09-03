# Focus Contract Studio

Status: **SOURCE DRAFT COMPLETE; R10 POST-DEPLOY PROOF AND REQUIRED VIDEO PENDING**

## One-line Summary

ChatGPT reads a live accessibility decision, stages a precedent-backed focus change, and verifies the reviewed result—without ever approving itself.

## Problem

Accessibility and design-system teams make decisions in component previews, tickets, chat, and precedent documents. Agents can retrieve and act quickly, but those separate surfaces blur three things that must stay distinct: evidence, a proposed change, and human authorization. A fluent agent suggestion should not silently become product state.

## Solution

Focus Contract Studio gives an accessibility or design-system lead and ChatGPT one shared, page-bound change-control loop for a destructive **Delete Account** dialog.

Implemented revision 1 initially focuses **Delete**. Synthetic applicable precedent says this exact destructive-dialog context should initially focus **Cancel**, so the page reports a bounded `DECISION MISMATCH`. Through WebMCP, ChatGPT reads that live state and stages an immutable Delete → Cancel proposal. The renderer remains revision 1 and the proposal remains visibly `NOT APPLIED`.

The reviewer then inspects the exact diff, proposal digest, and base revision in the visible page. There is intentionally no approval tool. Only after the reviewer approves can ChatGPT apply that exact payload. Guarded database writes advance the renderer to revision 2 and create a durable receipt.

Finally, the person completes a keyboard rehearsal in the real dialog. A second read returns the exact committed browser rehearsal for the current workspace, variant, and revision; ChatGPT calls the verifier against that target. Six independent checks cover initial focus, focus order, forward wrap, backward wrap, Escape, and returned focus.

## Why This Matters

Before this, a team could combine chat, tickets, component previews, precedent documents, and browser testing, but the live state and authority boundaries remained scattered. Focus Contract Studio makes them one legible human-agent protocol:

- The agent retrieves and cites applicable precedent.
- The agent can create a durable proposal without changing the product.
- The person sees the exact payload and retains the only approval authority.
- The agent can apply only the currently approved payload.
- The browser supplies fresh behavioral evidence, and the agent returns an immutable verification receipt.
- The complete keyboard-accessible workflow still works without WebMCP.

This is a strong fit for WebMCP because each tool's meaning depends on the current page: its rendered variant, implemented revision, observation, evidence token, proposal digest, review state, and committed rehearsal. A detached chatbot would lose the precise context that makes the actions useful and safe.

## How We Used AI

ChatGPT is the runtime reasoning client. It discovers four typed capabilities exposed by the live page, interprets bounded synthetic precedent, creates the proposed configuration, applies it only after visible approval, and verifies the resulting browser behavior. The Site calls no hidden model API; deterministic application code owns validation, persistence, authorization checks, ranking, application, and verification.

## How We Used Codex

Codex supported current official-source research, product and architecture work, implementation, test-driven repairs, local browser testing, documentation, security review, and adversarial release audits. Claude supplied an earlier advisory plan review. The entrant directed the product choices and retained control over public release and submission. This source snapshot does not claim R10 hosted qualification; immutable post-deploy receipts belong on the matching GitHub release.

## Key Features

- Exactly four top-level WebMCP tools: `read_active_focus_review`, `create_focus_contract_proposal`, `apply_approved_focus_contract`, and `verify_focus_contract`.
- No approval, review, rehearsal-capture, undo, reset, workspace-selection, URL, or selector tool.
- Bounded, server-resolved live state and deterministic synthetic precedent retrieval.
- Immutable proposals with field-level evidence support and a visible `NOT APPLIED` state.
- Exact UI-mediated approval bound to proposal digest and implemented revision.
- Guarded, idempotent apply with stale, forged, revoked, rejected, cross-workspace, and duplicate requests rejected without partial mutation.
- Page-bound `verificationTarget` that excludes foreign, stale, uncommitted, expired, and test-only rehearsals.
- Six-check raw browser-event verification, durable history, reload recovery, revisioned undo, and anonymous workspace reset.
- Keyboard-accessible human fallback when WebMCP is unavailable.

## Architecture

The project is a full-stack ChatGPT Site written in strict TypeScript with React and Next.js-compatible Vinext output. Sites-managed D1 stores isolated anonymous workspaces, focus revisions, synthetic precedent, immutable proposals, visible review decisions, allowlisted raw rehearsal events, and receipts.

Zod defines strict route and WebMCP schemas. An indexed D1 query filters precedent by workspace, product, component, behavior, status, and valid time before deterministic TypeScript BM25, structured applicability, relationship ranking, and Reciprocal Rank Fusion combine the eligible lists. Proposal payloads use canonical SHA-256 digests. Apply uses expected revisions, scoped idempotency, repeated conditional guards, database constraints, and explicit zero-row handling. Verification consumes immutable finalized events rather than generating expected events from the configuration under test.

## Testing Instructions

No credentials are required.

1. Open the [public app](https://focus-contract-studio-package-0.newmailforyouvignesh.chatgpt.site/) in ChatGPT's desktop in-app browser. Choose **Reset demo** if the page is not at implemented revision 1.
2. Ask ChatGPT: “Read the active focus review and create the evidence-backed Cancel-first proposal.”
3. Confirm the page still shows revision 1 and `NOT APPLIED`. Check the exact-review acknowledgement, choose **Approve**, and confirm in the visible page.
4. Ask ChatGPT: “Apply the exact approved proposal.”
5. Run the complete keyboard rehearsal shown on the page.
6. Ask ChatGPT: “Read the current review again and verify the exact returned verification target.”
7. Confirm revision 2 and six passing checks.

The final release target is ChatGPT's desktop in-app browser plus Chrome 152.0.7977.66 with `chrome://flags/#enable-webmcp-testing` enabled and the browser restarted. Treat those clients as qualified only when the matching GitHub release carries the exact-version post-deploy traces. No database console, developer tools, copied cookie, CSRF value, workspace ID, or manually supplied rehearsal ID belongs in the judge flow.

## Public Demo Link

https://focus-contract-studio-package-0.newmailforyouvignesh.chatgpt.site/

## Public Repository Link

https://github.com/chvignesh07/focus-contract-studio

Planned judge release target: `webmcp-challenge-2026-r10`; treat it as released only when the tag and matching GitHub release resolve publicly.

## Demo Video

**REQUIRED REMAINING ITEM:** Add a public YouTube URL for a clear demo with audio, under three minutes.

Recommended final cut:

- 0:00–0:12 — Show the live mismatch and state the problem.
- 0:12–0:40 — ChatGPT reads the page and creates the still-unapplied proposal.
- 0:40–1:05 — Show exact visible approval and the rejected self-approval boundary.
- 1:05–1:30 — ChatGPT applies the approved payload; revision 2 visibly focuses Cancel.
- 1:30–2:10 — Complete the keyboard rehearsal; ChatGPT reads the page-bound target and returns six passing checks.
- 2:10–2:35 — Show history/undo and explain why WebMCP is essential.
- 2:35–2:50 — Close on the human-agent authority boundary.

## Screenshot Shot List

1. Hero plus revision-1 Delete-versus-Cancel mismatch.
2. Exact proposal diff with `NOT APPLIED` and the visible approval controls.
3. Revision-2 dialog focused on Cancel.
4. Six-check verification receipt.
5. History with apply/verification receipts and undo.

## Submission Readiness Notes

- Public live URL: R9 is live; exact R10 deployment mapping is pending post-deploy evidence.
- Public source repository and Apache-2.0 license: ready at R9; R10 tag/push is pending.
- Exact four-tool WebMCP implementation and judge instructions: locally ready; hosted R10 qualification is pending.
- Text description covering WebMCP fit, user experience, new human-agent capability, and implementation: ready.
- Required demo video: missing.
- Final Devpost update/submit action: wait for the video URL and a fresh live-status check.

## Known Limitations

- The contest release deliberately proves one dialog family and two visual variants using synthetic precedent; it does not claim production customer validation or a standards verdict.
- The public demo is anonymous and uses synthetic data only.
- Automated keyboard and Axe checks do not constitute a WCAG conformance claim or replace manual assistive-technology testing.

## TODO Official Form Fields

Live requirements checked 2026-09-03:

- `28254` Live URL: `https://focus-contract-studio-package-0.newmailforyouvignesh.chatgpt.site/`
- `28255` Testing instructions: use the copy-ready sequence above.
- `28256` Public repository: `https://github.com/chvignesh07/focus-contract-studio`
- `28257` Tested clients: populate from the immutable R10 post-deploy traces attached to the matching GitHub release; do not promote the earlier R9 qualification as R10 proof.
- `28258` AI tools: `ChatGPT, Codex, and Claude (advisory review). ChatGPT is the runtime reasoning client through WebMCP; the Site calls no hidden model API.`
- `28259` Learning: `Significant`
- `28260` Career AI value: `Yes`
- Retain the truthful submitter-type and country-of-residence answers already stored in the live Devpost entry; do not reconstruct or overwrite identity fields from repository data.
- Add the public YouTube URL, then run the final Devpost submission/update flow before the extended 2026-09-04 01:00 PT deadline.
