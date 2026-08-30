# Focus Contract Studio — Product Requirements Document

Status: **LOCKED FOR IMPLEMENTATION**

## Product summary

Focus Contract Studio gives an accessibility or design-system lead a visible, revision-safe place to decide and verify one dialog family's keyboard-focus behavior with a browser agent. The agent contributes observation, precedent retrieval, and an unapplied proposal. An explicit UI-mediated reviewer decision is the only review authority; the product does not claim biological-human attestation. The application enforces exact state, persistence, revision, and verification.

## Target user

Primary: an accessibility or design-system lead inside one product company.

Judge persona: a first-time anonymous visitor who must understand and complete the seeded workflow without credentials, setup knowledge, or private data.

## Core user journey

1. The visitor opens a fresh isolated judge workspace containing a seeded Delete Account dialog.
2. The dialog opens and the page records the actual initial focus and subsequent keyboard events.
3. The page shows implemented revision 1, applicable synthetic prior decision D001, and one bounded `DECISION MISMATCH`.
4. ChatGPT calls the read tool and receives exact current state plus scoped, untrusted precedent.
5. ChatGPT creates an immutable proposal. The implemented revision and renderer do not change.
6. The reviewer rehearses, edits if needed, and explicitly approves or rejects the exact proposal through the visible UI.
7. ChatGPT or the reviewer UI applies the approved proposal against the expected revision and receives a mutation receipt.
8. The reviewer reopens and keyboard-rehearses the dialog; the verifier evaluates raw observations and writes a receipt.
9. Reload proves durability. A stale/forged call fails. Undo restores behavior through a new revision.

## Epics and user stories

### Epic 1 — Immediate, isolated judge entry

#### PRD-001 — Start without credentials

As a judge, I want a ready-to-use isolated demo so that I can understand the product immediately.

Acceptance criteria:

- A signed-out first visit creates or resumes one anonymous workspace without asking for credentials.
- The seeded hero state is visible within the first viewport and the working product is understandable within 15 seconds.
- Another browser profile receives a different workspace and cannot read or mutate the first workspace.
- A visible Reset demo action restores only the current workspace to the documented seed.
- If workspace creation is rate-limited, the page explains when to retry and does not expose another workspace.

#### PRD-002 — Optional durable identity

As a returning user, I want optional Sign in with ChatGPT so that my private workspace can survive beyond an anonymous demo session.

Acceptance criteria:

- Sign-in is optional for the judge journey.
- Signed-in and anonymous workspaces never merge silently.
- Email and full name are never stored; only an HMAC-derived subject key from the exact validated authenticated-email header bytes is persisted. No lowercasing or provider-specific normalization is allowed.
- Optional sign-in is omitted from the release if hosted anti-spoofing and repeat-sign-in stability probes do not pass.
- Authorization is enforced by the server, not by hidden UI controls.

### Epic 2 — Observe the real dialog

#### PRD-003 — See the exact active subject

As a lead, I want to see the dialog family, variant, revision, and implemented focus configuration so that I know exactly what is being reviewed.

Acceptance criteria:

- The page always shows stable product, component-family, variant, and revision identifiers.
- The implemented configuration visibly lists initial focus, ordered stops, forward/backward wrapping, Escape outcome, and return-focus target.
- Navigation or reload never causes the UI to display one revision while commands target another.

#### PRD-004 — Capture raw behavior

As a lead, I want the page to record actual focus and keyboard events so that verification is based on behavior rather than a generated story.

Acceptance criteria:

- Opening, Tab, Shift+Tab, Escape, closing, and return focus create bounded ordered event records.
- The capture stores element IDs and behavior metadata, never typed field content.
- The product shows `DECISION MISMATCH`, not a compliance verdict, when current observed/implemented behavior differs from applicable precedent.
- The seed is `Implemented/observed: Delete` versus `Prior decision D001: Cancel`; the renderer obeys revision 1.

### Epic 3 — Retrieve decision precedent safely

#### PRD-005 — Retrieve relevant human decisions

As a lead, I want related prior decisions ranked with provenance so that the next proposal can reuse judgment without erasing context.

Acceptance criteria:

- Retrieval filters by workspace, product, eligible status, component applicability, and temporal validity before ranking.
- Results show record ID, outcome, short rationale excerpt, relationship, and rank contributions.
- Unrelated, superseded, wrong-workspace, hostile, or ineligible records never appear in the eligible top results.
- No result is labeled confidence, truth, approval, or permission.
- The read returns a short-lived session/workspace/state/result-bound evidence token and creates no product-state record.

#### PRD-006 — Abstain when precedent is unsafe or irrelevant

As a lead, I want retrieval to abstain when evidence is insufficient so that an agent cannot manufacture precedent.

Acceptance criteria:

- Negative and ambiguous benchmark cases produce explicit abstention.
- Conflicting top evidence is reported as conflict and requires reviewer judgment.
- RRF failure blocks release rather than being hidden or relabeled.

### Epic 4 — Stage, inspect, and decide a proposal

#### PRD-007 — Create without applying

As an agent-assisted lead, I want ChatGPT to stage a proposal so that I can inspect it before the live behavior changes.

Acceptance criteria:

- Proposal creation leaves the active revision and rendered behavior unchanged.
- The proposal has an immutable ID, canonical payload hash, base revision, server-persisted accepted evidence snapshot, cited record IDs, author, timestamp, and `proposed` status.
- The page presents an unmistakable `NOT APPLIED` state and a field-level diff.
- Duplicate retries with the same proposal idempotency key create one proposal.
- Every changed field in an agent-authored proposal is supported by an eligible cited precedent outcome; the identical unsupported proposal fails with `EVIDENCE_REQUIRED_FOR_AGENT_CHANGE`.

#### PRD-008 — Reviewer edit creates a new immutable proposal

As a lead, I want to refine a proposal without mutating the original evidence trail.

Acceptance criteria:

- Saving an edit creates a child proposal and supersedes the earlier proposal.
- Approval can bind only to the exact child proposal and hash visible to the reviewer.
- The original proposal remains in history.

#### PRD-009 — Approve, reject, or revoke visibly

As a lead, I want explicit review controls so that agent text can never impersonate my decision.

Acceptance criteria:

- Reviewer UI can approve, reject with rationale, or revoke an un-applied approval.
- Approval records exact proposal ID, hash, base revision, reviewer subject, and time.
- Natural-language words such as “approved,” retrieved records, or tool annotations cannot create approval state.
- Every state change is announced accessibly and remains visible in history.

### Epic 5 — Apply exactly once and fail closed

#### PRD-010 — Apply the exact approved proposal

As a lead, I want an approved proposal applied atomically so that the live state cannot partially or incorrectly change.

Acceptance criteria:

- Apply rechecks workspace ownership, proposal status/hash, current approval/hash, expected revision, and idempotency at execution.
- A successful apply creates exactly one new implemented revision and one receipt.
- Same-key retry returns the same receipt without a second revision.
- Concurrent same-base applies result in one success and one stale failure.
- Stale, forged, rejected, revoked, superseded, cross-workspace, or changed proposals cause no mutation.

### Epic 6 — Verify and undo independently

#### PRD-011 — Verify raw rehearsal evidence

As a lead, I want raw observation separated from the implemented revision being checked so that a wrong renderer cannot mark itself correct.

Acceptance criteria:

- Verification consumes a completed raw rehearsal session for the exact applied revision.
- It evaluates initial focus, ordered focus traversal, forward wrap, backward wrap, Escape, and return focus independently.
- A deliberately divergent implementation fails.
- A receipt records environment, verifier version, evidence IDs, and each behavior result.
- Verification never changes the implemented focus configuration.

#### PRD-012 — Undo through history

As a lead, I want undo to create a new revision so that recovery preserves a complete audit trail.

Acceptance criteria:

- Undo is available in the reviewer UI after apply.
- Undo restores the prior implemented configuration through a new revision; it never deletes history.
- Old approvals cannot silently reapply after undo.
- Reload preserves proposals, decisions, revisions, receipts, and undo lineage.

### Epic 7 — Human/WebMCP parity

#### PRD-013 — Use the same protected operations

As a human supervisor, I want agent and visible UI paths to share business logic so that WebMCP is not a less-protected back door.

Acceptance criteria:

- UI and WebMCP call the same domain query/command functions.
- Every agent-visible capability has a keyboard-accessible human equivalent.
- Only four top-level imperative tools are registered on the relevant route.
- Unsupported WebMCP leaves the complete human workflow usable and shows an honest compatibility notice.
- Tool lifecycle does not leak duplicate or stale registrations after navigation or HMR.

### Epic 8 — Judge proof and truthful claims

#### PRD-014 — Prove the product in 170 seconds

As a judge, I want a concise, truthful demonstration so that I can score WebMCP leverage, execution, impact, and creativity even if I do not run the app.

Acceptance criteria:

- The live product appears within 10–15 seconds.
- The video is public, English, under 180 seconds, and includes narration explaining WebMCP.
- An immutable release attestation maps the repository source commit `C`, saved/deployed Sites version, public URL, screenshots, video, and evidence without pretending post-deploy evidence was committed into `C`.
- Claims remain bounded to the named focus behaviors, two variants, and documented tested clients/environment.

## Edge cases

- No active dialog or no completed observation session.
- WebMCP unavailable, late, duplicated, aborted, or invoked after navigation.
- Proposal targets a revision that changes before review or apply.
- Evidence token expires, is tampered with, crosses a session/workspace/state boundary, or its cited precedent becomes superseded.
- Two tabs edit/apply the same workspace concurrently.
- Apply response is lost and retried.
- Verification session belongs to another revision or workspace.
- Reset requested while a proposal or rehearsal is active.
- Anonymous cookie missing, expired, forged, or rotated.
- Signed-in identity headers missing or changed.
- D1 write fails mid-operation.
- Hostile instructions appear in rationale, dialog copy, proposal summary, or WebMCP output.
- Long text, unknown JSON fields, invalid target IDs, and oversized arrays.
- 200% zoom, 320 px and 375 px viewports, reduced motion, keyboard-only use, and VoiceOver.

## What we would add later

Only after the contest release: more component families, real design-system import, multi-reviewer collaboration, production SSO/roles, customer research, and broader longitudinal benchmarks. These are not hidden MVP commitments.

## Submission proof points

- Exact live-page WebMCP state, not detached API wrapping.
- Visible proposal/approval/application separation.
- Decision memory changes whether the evidence-supported agent proposal is admitted while remaining non-authoritative.
- The deterministic memory-on/memory-off counterfactual passes, and any claim that ChatGPT itself changed behavior is backed by the separate paired real-client protocol.
- Raw-behavior independent verification catches a planted divergence.
- Human and agent capability parity through one protected domain spine.
- Sealed RRF evidence, clean anonymous judge path, durable history, stale failure, and undo.
