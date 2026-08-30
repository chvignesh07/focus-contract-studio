# Focus Contract Studio — UX Specification

Status: **CONTROLLING PRODUCT EXPERIENCE v2**

## First 15 seconds

A fresh public session lands directly on a working review, not a marketing page.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Focus Contract Studio                    Demo · Anonymous · Reset    │
│ Human precedent guides the next repair. Exact review controls permission. │
├───────────────────────────────┬──────────────────────────────────────┤
│ LIVE DELETE ACCOUNT DIALOG    │ DECISION MISMATCH                    │
│ Revision 1 · Standard         │ Implemented / observed: Delete       │
│                               │ Applicable precedent D001: Cancel    │
│ [Reason input]                │ “For this destructive dialog…”       │
│ [Cancel] [Delete account]     │ Evidence only — not approval         │
│                               │ [Ask ChatGPT] [Create proposal]      │
└───────────────────────────────┴──────────────────────────────────────┘
```

Opening the dialog visibly places focus on Delete because implemented revision 1 says Delete. The observation strip updates from real events. D001 separately says Cancel. No setup, fake completed card, or hidden desired contract.

## Information architecture

One page, six numbered stages:

1. **Observe** — live dialog, active variant/revision, rehearsal controls, raw bounded summary.
2. **Precedent** — eligibility/disposition, D001 rationale, provenance, three-rank explanation, evidence-only warning.
3. **Proposal** — exact field diff, citations/support mapping, `NOT APPLIED` banner.
4. **Review** — UI-mediated approve/reject/edit-as-child/revoke; exact digest and base revision.
5. **Apply** — receipt, from/to implemented revisions, stale/replay status, next action.
6. **Verify & history** — six checks, raw sequence references, precedent projection, reload, stale failure, undo lineage.

The top rail shows current stage and state, not decorative progress. Completed stages remain inspectable.

## Active variant and view state

- Two allowlisted tabs: Standard and Danger emphasis.
- Selection updates `workspace_view_state` through a UI-only CAS command and starts no mutation to implemented configuration.
- WebMCP always reads the server-selected active variant; tool inputs never select one.
- Switching variants cancels in-flight read requests, aborts/re-registers route tools as needed, and leaves history intact.

## State language

Use these exact labels:

- `IMPLEMENTED REVISION 1`
- `OBSERVED: DELETE`
- `PRECEDENT: CANCEL`
- `DECISION MISMATCH`
- `EVIDENCE ONLY — NOT APPROVAL`
- `NOT APPLIED`
- `AWAITING UI REVIEW`
- `APPROVED FOR THIS EXACT PROPOSAL`
- `APPLIED · REVISION 1 → 2`
- `VERIFIED PASS` / `VERIFIED FAIL`
- `STALE — READ CURRENT STATE`
- `OUTCOME UNCERTAIN — RECOVERING RECEIPT`

Never use “AI approved,” “human verified” (unless a named manual operator did so), “WCAG compliant,” “safe,” or “fixed” as a substitute for a specific receipt/check.

## Hero interaction

### Observe

The “Run opening rehearsal” action closes/reset safely, places focus on trigger, opens the dialog, captures actual manifest/events, and finalizes. UI shows target IDs rather than selectors or user text.

### Precedent

Each card shows outcome, scope, source kind, valid date, rank contributions, ≤240-character UI rationale, and evidence warning. Conflict shows both records side-by-side and disables agent proposal creation. Abstention says why and offers a reviewer-authored novel proposal through the visible UI.

### Proposal

Canonical diff uses a two-column field table:

| Field | Implemented revision 1 | Proposed |
|---|---|---|
| `initialFocus` | Delete button | Cancel button |

Every changed field displays the supporting record/outcome. The `NOT APPLIED` banner stays visible above the fold. Reopening the dialog before apply must still focus Delete.

### Review

Approval is a deliberate visible sequence:

1. expand complete diff and citations;
2. check “I reviewed this exact proposal and revision”;
3. select Approve, Reject, or Edit as new proposal;
4. confirm the explicit browser/UI action.

This is UI-mediated reviewer intent, not biological-human attestation. No tool/API endpoint exposes it.

### Apply and recovery

Apply shows a concise consequence and uses the approved proposal ID/base revision. A success receipt is permanent and copyable. During a lost response, disable duplicate new-key submission, retry with the same idempotency key, and show `RECOVERING`; never claim failure/success until receipt/state resolves.

### Verify

After apply, the page requires a new complete rehearsal. Verification shows all six behavior rows and raw sequence numbers. `not_observed` is fail. Passing projection says “Reviewed + applied + verified decision added as future precedent,” with provenance link.

### History, undo, reset

- Timeline contains observations, proposals, review decisions, applications, verifications, projections, undo, and safe failures.
- Undo is UI-only, creates a new revision, and has its own confirmation/idempotency receipt.
- Reset creates a new isolated seeded workspace; prior workspace becomes inaccessible immediately and enters request-driven lifecycle purge. It does not rewrite history.

## Error and empty states

Every state provides: what happened, whether implemented revision changed, stable code, correlation ID, and one safe next action.

- Foreign/nonexistent IDs look identical.
- Unsupported WebMCP: “Site tools are unavailable here. The complete review still works on this page.”
- Retrieval unavailable: no invented precedent; agent changed proposal disabled; reviewer novel proposal remains visible.
- Expired session: new isolated demo with explanation; never silently attach client-selected prior workspace.
- Rate limit: retry time, no scary security language.

## Visual system

- Warm neutral canvas, near-black type, indigo interactive accent, amber mismatch/evidence, green pass, red destructive/fail.
- One variable/system sans stack; tabular numerals for revisions/scores; monospace only for IDs/digests.
- 8px spacing grid, 12–16px radii, thin borders, minimal soft shadow, no glassmorphism.
- Motion 120–180ms opacity/transform only; completely disabled/reduced under `prefers-reduced-motion`.
- Desktop two-column becomes one logical column under 800px without horizontal scrolling at 320 CSS px.
- Color never carries state alone; icons have text labels.

## Accessibility interaction contract

- Semantic landmarks and ordered headings.
- Native `<dialog>` with accessible name/description, `aria-modal`, inert background, no positive `tabindex`.
- Release acceptance proves the open dialog exposes its name, description, and modal semantics while background controls reject pointer activation and keyboard focus until the dialog closes.
- Visible 3:1+ focus indicator; target contrast ≥4.5:1 text and ≥3:1 essential UI.
- At desktop, 320 px, 375 px, and 200% zoom, every focused actionable control remains inside the visible viewport and unobscured by rails, overlays, dialog edges, or clipped scroll containers.
- All actions keyboard accessible; destructive/apply/undo confirmations never rely on hover.
- Live status uses a restrained `aria-live=polite` region; raw event stream is not announced on every event.
- At 200% zoom and narrow viewport, proposal diff and review sequence remain complete.

## Cold comprehension gate

A fresh internal evaluator with no project history receives only a deployed screenshot/live page and answers within 15 seconds:

1. What is currently implemented/observed?
2. What did prior precedent say?
3. Has the proposal already changed the page?
4. Who/what can authorize apply?
5. What does verification prove?

Pass requires all five correct. For question 5, the evaluator must explain that verification compares a new finalized raw keyboard/focus rehearsal from the rendered revision with that named implemented revision; it does not prove approval or general standards conformance and does not manufacture observed events. Record as internal cold evaluation, not user research.
