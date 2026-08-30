# Focus Contract Studio — Agent Build Contract

Status: **INSTRUCTIONS FOR CODEX IMPLEMENTATION**

## Mission

Build, verify, deploy, and package Focus Contract Studio exactly as authorized by this pack. Product decisions are closed. Resolve generated-runtime facts through probes and evidence; do not restart founder discovery or broaden scope.

## Required read order

Read `START_HERE.md`, then every file it lists before changing product source. The newest founder decision ledger and current official rules/docs outrank this file if a real conflict exists.

## Sites ownership

One root agent owns creation and all mutations of the ChatGPT Site checkout for the entire build. This satisfies the Sites skill's single-agent ownership rule and prevents shared-checkout corruption.

Subagents may perform bounded, read-only reviews or work on isolated evidence/research artifacts only when assigned non-overlapping paths. They may not initialize another Site, run a second Site build/deploy, or edit Site source/configuration. Maximum three active subagents in one bounded wave.

## Autonomous execution

Proceed through the implementation plan and checklist without asking preference questions already answered by the authority pack. Ask the founder only when:

- current official rules prohibit a locked requirement;
- a required external action needs credentials/account authority the agent cannot obtain;
- a probe proves no official implementation can satisfy a release-blocking product invariant;
- two controlling founder decisions conflict materially;
- a destructive or externally visible action is outside the authorized build/deploy/submission scope.

A failing test, unfamiliar generated framework, hard bug, or long task is not itself a reason to stop. Diagnose, implement the permanent in-scope fix, test it, document it, and continue.

## Change discipline

- Create the new project in isolated `focus-contract-studio/`; never scaffold over the planning workspace.
- Confirm cwd, repository status, branch, HEAD, and unrelated changes before every major package.
- Commit untouched generated scaffold first; then copy the authority pack and fixtures with hashes.
- Use `apply_patch` for deliberate file edits and generated tools only for their intended generated outputs.
- Do not overwrite user changes or clean/delete ambiguous files.
- Keep commits cohesive and passing; do not rewrite shared history.
- No placeholder, fake integration, mocked production path, hard-coded success, unimplemented button, hidden TODO, skipped release test, or fabricated evidence may reach the release candidate.

## Decision discipline

- Implement the top-one technology choice. Do not add alternate frameworks/services “just in case.”
- A runtime probe may change an adapter detail, package version, or generated path, not the product authority/safety boundary.
- Record every probe with source/date/environment/result as PASS/FAIL/INCONCLUSIVE.
- If an official API differs, update architecture/contracts/tests/docs in the same change.
- Retrieval supplies evidence only. Any dependency from retrieval/ChatGPT into review authority is a release-blocking defect.
- The active implemented revision is the renderer configuration. Never introduce a second hidden “desired contract.”
- Every agent-authored changed field requires eligible cited precedent support; support permits proposal creation only, never approval or apply.
- `read_active_focus_review` must remain genuinely read-only, including no session/access/cleanup/audit writes. Proposal creation verifies its short-lived evidence token and atomically persists the accepted retrieval snapshot with the immutable proposal.
- Do not use FTS5 scores. Implement the frozen eligible-only TypeScript BM25 and v2 rank/fusion contract exactly.
- Treat every Sites deployment URL as production. Never assume a saved version, access restriction, or new code version provides isolated D1 state.

## Engineering loop

For each work package:

1. Restate acceptance criteria and named invariants in the local plan.
2. Write or update failing contract/domain/integration tests where feasible.
3. Implement the smallest complete vertical change.
4. Run focused tests, typecheck, lint, and affected integration/browser tests.
5. Inspect visible behavior when UI changes.
6. Update traceability, decisions/probe notes, and evidence.
7. Run an adversarial self-review for stale state, isolation, replay, injection, accessibility, and error states.
8. Commit only when the package's exit gate passes.

Do not defer documentation or tests to an unnamed later phase; they are part of each package.

## Evidence language

Use these labels in reports:

- `[Empirical]` only for current official material or exact observed/tested evidence.
- `[High-Conviction]` for architecture inference.
- `[Hypothesis]` for unvalidated market/product claims plus the exact validation test.
- `INCONCLUSIVE` for interrupted, unavailable, wrong-SHA, or incomplete checks.

Never promote local build success to deployed/public/real-client success.

## Review protocol

- Review 1 occurs after the complete local vertical slice and deterministic suite pass, before live candidate freeze.
- Review 2 occurs on the exact deployed release with fresh eyes.
- Reviewers report severity, evidence, exploit/user path, and smallest permanent fix.
- Root agent cross-checks every finding, fixes valid blockers, reruns affected gates, and records dispositions.
- All subagent threads are completed/closed before final handoff.

## Stop/ship conditions

Ship only when every release blocker in `START_HERE.md`, every checklist exit gate, the sealed benchmark, real-client matrix, public judge journey, accessibility/security gates, clean-clone build, release lineage/attestation, and submission consistency pass with no known high-severity issue.

If an external dependency remains genuinely impossible before the deadline, preserve the complete human flow, mark the exact feature/client `INCONCLUSIVE` or unsupported, remove the unsupported submission claim, and escalate only if that loss violates the core WebMCP eligibility requirement.
