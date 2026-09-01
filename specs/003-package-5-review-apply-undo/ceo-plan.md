# CEO Plan: Package 5 Review, Apply, Verify, Undo, and Reset

**Mode**: HOLD

**10-Star Version**: One judge-visible, keyboard-complete local loop in which immutable evidence-backed proposal state, exact visible review authority, one guarded revision-2 application, fresh raw verification, provenance projection, durable history, revisioned undo, and workspace reset are all observable and recoverable without expanding WebMCP authority.

**Ambition Gap**: None inside Package 5. Package 6 presentation polish and Package 7 four-tool expansion are explicitly later authority and would weaken this checkpoint if pulled forward.

## Acceptance Criteria

- [ ] Every invalid or raced mutation produces zero product change.
- [ ] One valid reviewed apply creates one revision and one recoverable receipt.
- [ ] Only a reviewed, applied, independently passing revision projects precedent.
- [ ] History, reload, undo, old-approval invalidation, and reset are visible and durable.
- [ ] The exact committed gate passes in the worktree and a no-local clone.

## 11 Review Sections

1. **Architecture**: Extend the existing proposal, session, request-security, verification, and Package 1 persistence spine; add no service, dependency, generalized workflow engine, or later-package tool surface.
2. **Error and rescue**: Stable rejection for missing/foreign/stale/rejected/revoked/superseded/applied state; same-key recovery for uncertain outcomes; no guessed result.
3. **Security**: Visible same-origin review only; session/workspace/Origin/CSRF boundaries; exact digest/revision authority; foreign/nonexistent parity; guarded all-or-nothing mutation.
4. **Data flow**: Proposal review flows to one guarded apply; fresh raw rehearsal flows to independent verification; pass-only projection; undo/reset create append-only recovery lineage.
5. **Code quality**: Reuse shared parsers, error envelopes, canonicalization, D1 result interpretation, and React state patterns; keep orchestration explicit and boring.
6. **Tests**: Unit and DOM prove state; real D1 proves guards, rollback, row counts, idempotency, concurrency, projection, undo, and reset; Playwright proves the complete user journey and accessibility states.
7. **Performance**: Bounded current-workspace reads and the mandated 100-pair concurrency proof; no scale system beyond the contest slice.
8. **Observability**: Safe chronological history and correlation IDs; no raw session, CSRF, rationale payload, path, SQL, or private identity leakage.
9. **Deploy and rollout**: Local checkpoint only. No deploy, push, merge, hosted mutation, holdout, or public release action.
10. **Long-term trajectory**: The append-only authority spine supports Package 6 surface refinement and Package 7 tool completion without changing review authority.
11. **Design and UX**: Functional accessible states only—exact diff/digest/base, deliberate decisions, Cancel focus after apply, recovery announcements, history, undo, and reset; premium polish remains Package 6.

## Verdict

APPROVE — scope HOLD. Proceed to the repository-local implementation plan, then apply the engineering review lens once before code.
