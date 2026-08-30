# Focus Contract Studio — Devpost Submission Draft

Status: **DRAFTING — DO NOT SUBMIT UNTIL EVERY PLACEHOLDER AND CLAIM GATE IS RESOLVED**  
Controlling plan: `docs/delivery/SUBMISSION_PLAN.md`  
Evidence authority: `docs/delivery/EVIDENCE_REGISTRY.md`

## Project title

Focus Contract Studio

## Tagline

Human precedent guides the next repair. Exact review controls permission.

## Inspiration

Accessibility and design-system teams repeatedly decide how a component should behave, but the rationale for an earlier decision is often disconnected from the next live review. Agents can retrieve and propose quickly, yet retrieved text or the agent's own language must never become permission to mutate the product. Focus Contract Studio keeps the useful part of memory—applicable human precedent—while making observation, proposal, review, application, and verification visibly different states.

## What it does

Focus Contract Studio gives an accessibility or design-system lead and ChatGPT one shared live review surface for a Delete Account dialog's keyboard-focus behavior.

The seeded renderer follows implemented revision 1 and focuses Delete. A synthetic prior applicable reviewer decision, D001, says this dialog context should focus Cancel, so the page reports a bounded `DECISION MISMATCH` rather than inventing a standards verdict. ChatGPT reads the exact live variant, revision, observation, and eligible precedent through WebMCP, then stages an immutable `Delete → Cancel` proposal marked `NOT APPLIED`.

Every changed field in an agent-authored proposal must be supported by a cited eligible precedent outcome. With D001 available, the proposal can be staged; with the same state and change but no eligible evidence, the command returns `EVIDENCE_REQUIRED_FOR_AGENT_CHANGE`. Neither result creates approval.

A reviewer inspects the exact diff and digest in the visible interface and approves, rejects, edits-as-child, or revokes it. Only an exact current UI approval can be applied. The server rechecks workspace, evidence, proposal digest, latest review, base/current revision, and idempotency inside guarded D1 writes before creating revision 2 and one receipt. The renderer then focuses Cancel. A new keyboard rehearsal is verified from finalized raw focus/key events. Reload, stale/forged zero-mutation, same-key recovery, history, and revisioned undo close the loop.

## Why WebMCP is essential

This is not a detached chatbot or a wrapper around a generic API. The useful operation depends on the current page's rendered dialog, implemented revision, raw observation session, evidence query, immutable proposal, and review state. WebMCP lets ChatGPT call typed capabilities from that exact page context instead of guessing through pixels or losing the state boundary.

The release registers exactly four top-level imperative tools:

1. `read_active_focus_review`
2. `create_focus_contract_proposal`
3. `apply_approved_focus_contract`
4. `verify_focus_contract`

The visible UI and WebMCP adapters call the same protected application services. WebMCP exposes no approval operation. Retrieval, rationale text, tool annotations, and model language are evidence—not authority.

## How it creates a better human-agent experience

- The reviewer and ChatGPT inspect the same live state and bounded evidence packet.
- The agent can create a real durable proposal without changing the renderer.
- Applicable decisions preserve rationale and affect proposal eligibility without becoming permission.
- Review binds to the exact immutable payload digest and base revision the reviewer saw.
- Stale, forged, rejected, revoked, superseded, unavailable, or cross-workspace requests fail without mutation.
- Independent raw-event verification can catch a wrong renderer even when the stored configuration looks correct.
- The complete keyboard-accessible human workflow remains available when WebMCP is unsupported.

## How we built it

The project is one full-stack ChatGPT Site written in strict TypeScript. Sites-managed D1 stores isolated anonymous workspaces, dialog variants, implemented focus revisions, synthetic precedent, immutable proposals, UI review decisions, raw rehearsal events, and application/verification/undo receipts.

Zod produces strict route and WebMCP schemas. One indexed D1 query performs workspace/product/component/behavior/status/temporal eligibility before any ranker sees a record. Deterministic TypeScript BM25 scores only those eligible rows; structured applicability and explicit subject-edge ranking supply two independent lists. A clean-room implementation of Reciprocal Rank Fusion combines the three lists with fixed `k=60`, stable full-precision ordering, conflict handling, and abstention. Retrieval has no dependency path into approval.

Application uses canonical SHA-256 proposal digests, expected revisions, scoped idempotency, repeated conditional guards, a transaction finalizer, D1 constraints, and explicit inspection of zero-row results. A separate deterministic verifier evaluates six named focus behaviors from immutable finalized events. The Site calls no model API: ChatGPT supplies reasoning through WebMCP, while deterministic code owns validation, persistence, review enforcement, application, and verification.

## Challenges we solved

- Preserving useful agent context without letting page text, precedent, or the agent invent approval.
- Keeping the implemented revision and renderer coherent while comparing them with a separate prior decision.
- Making proposal creation and live application provably different transitions.
- Handling zero-row conditional writes, lost responses, retries, stale revisions, and concurrent applies without partial or duplicate mutation.
- Verifying real focus behavior without synthesizing events from the configuration under test.
- Keeping a public anonymous judge flow isolated and abuse-bounded without retaining raw identity data.
- Designing a feasible sealed RRF benchmark, preserving an invalid v1 preregistration, and preventing product code from seeing v2 holdout judgments.

## Accomplishments

Regenerate this section from the exact release evidence. Delete any row that is not `PASS`:

- `[E-021 PASS REQUIRED]` A supported ChatGPT client discovers and calls the exact four tools on the public deployed Site.
- `[E-012 PASS REQUIRED]` The same agent-authored change is accepted with applicable D001 and rejected without evidence, while neither path approves or applies it.
- `[E-007 PASS REQUIRED]` The complete negative apply matrix, statement-position failure injection, zero-row guard, same-key retry, and 100-pair concurrency test produce zero unauthorized or duplicate revision.
- `[E-011 PASS REQUIRED]` Each of six planted keyboard-behavior divergences fails independent raw-event verification.
- `[E-022 PASS REQUIRED]` On the synthetic 36-record procedural-holdout benchmark, RRF reproduces the sealed release gates with 18/18 dispositions, zero forbidden results, deterministic ordering, and at least 0.05 mean nDCG@3 lift over every eligible single ranker.
- `[E-020/E-023 PASS REQUIRED]` The complete signed-out keyboard journey, two-profile isolation, reload, stale failure, undo, and named manual accessibility checks pass on the public exact release.

## What we learned

WebMCP is strongest when a tool's meaning depends on state that only the live page can make precise. Exposing a mutation-shaped function is the easy part. The hard part is preserving ordinary authorization, exact review intent, revision safety, accessible fallback, bounded untrusted output, and truthful recovery semantics around it.

We also learned that retrieval quality and mutation permission must be separate systems. Relevant precedent can improve which proposal is admissible, but it cannot answer whether the current reviewer approved the exact payload. Finally, an independent observer is essential: a system cannot prove its renderer by regenerating expected events from the same configuration it is trying to verify.

## What's next

The contest release deliberately proves one dialog family and two variants. The next validation is moderated work with accessibility and design-system practitioners: measure task time, correction count, trust calibration, and unsupported-proposal rejection against their existing workflow. Only after that evidence would we preregister a second component-family benchmark and evaluate real design-system import, organizational roles, and multi-reviewer workflows.

## Built With

Replace with exact source-commit dependencies after release. Planned core: ChatGPT Sites, WebMCP, Sites D1, strict TypeScript, the generated UI/runtime, Zod, reviewed SQL migrations, the probe-selected Vitest/Cloudflare test harness, Testing Library, Playwright, axe-core, and native Web Crypto. Do not list Drizzle unless the generated scaffold actually uses it; do not list Chrome unless its release client row passes.

## Required links

- Live Site: `[EXACT PUBLIC SITES URL U]`
- Public source repository/tag: `[EXACT PUBLIC REPOSITORY URL AT C]`
- Demo video: `[PUBLIC YOUTUBE URL, AUDIO, <180 SECONDS; RELEASE GATE ≤170]`
- Source commit: `[FULL C SHA]`
- Release evidence page: `[STABLE PUBLIC GITHUB RELEASE PAGE; FINAL RECEIPT-BEARING ATTESTATION ADDED BEFORE FREEZE]`

## Testing instructions — field 28255

No credentials are required. Open the public Site in `[EXACT PASSING CHATGPT CLIENT/BUILD]` and choose `Reset demo` if needed. Open the Delete Account dialog and ask ChatGPT to read the active focus review and create a focus-contract proposal. Confirm the page still says `NOT APPLIED`; use the visible review controls to approve the exact proposal, then ask ChatGPT to apply it. Reopen the dialog, complete the on-screen keyboard rehearsal, and ask ChatGPT to verify it. History, reload, stale failure, and undo remain available in the visible interface.

`[IF AND ONLY IF CHROME RELEASE ROW PASSES: add exact Chrome version, flag/settings path, and tested limitations.]`

## Custom-field answers

- `28249` Submitter Type: `Individual`
- `28250` Country of residence: `[FOUNDER TRUTHFUL CURRENT RESIDENCE — DO NOT INFER]`
- `28251` Organization: blank unless live form truthfully requires it.
- `28252` App Status: `New`
- `28253` Existing-project changes: blank/not applicable for the new clean-room project; adapt only if live form requires text.
- `28254` Live URL: `[EXACT PUBLIC U]`
- `28255` Testing instructions: final exact-client paragraph above.
- `28256` Public repository: `[EXACT PUBLIC SOURCE URL/TAG FOR C]`
- `28257` Tested agents/clients: `[EXACT E-021 ROWS ONLY]`
- `28258` AI tools: `ChatGPT/Codex supported current official research, product and architecture work, implementation, tests, documentation, and adversarial review. Claude supplied an advisory plan review. ChatGPT is the runtime reasoning client through WebMCP. The Site calls no hidden model API.`
- `28259` Learning: `Significant` after the release evidence supports it.
- `28260` Career AI value: `Yes` only after founder confirms truthfully at submission.

## Claim boundary

Do not claim WCAG compliance, accessibility certification, biological-human attestation, autonomous approval, enterprise authorization, customer adoption, willingness to pay, scientific proof, general retrieval superiority, production-scale search, or compatibility outside exact tested clients/behaviors. Do not call v1 passed. Do not publish the v2 benchmark claim until the exact-source release holdout is `PASS`.

## Final-use rule

Before pasting this draft into Devpost, remove every bracketed instruction, regenerate accomplishments/Built With/testing instructions from `EVIDENCE_INDEX.json`, validate all public links while signed out, obtain the founder's legal/final-content approval, and submit only with explicit external authorization.
