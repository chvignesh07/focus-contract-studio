# Focus Contract Studio — Scope

Status: **LOCKED FOR BUILD**  
Research refreshed: 2026-08-29 EDT

## Challenge contract

**[Empirical]** The WebMCP Challenge requires a working live app, meaningful WebMCP use, a public licensed repository, and a public YouTube demo under three minutes with audio. Stage 2 weights WebMCP Leverage, Execution, Potential Impact, and Creativity & Ambition equally, with that order controlling tie-breaks; no numeric five-point scale is published in the formal rules. The deadline is September 3, 2026 at 1:00 p.m. PT. Sources: [official rules](https://webmcp.devpost.com/rules), [challenge resources](https://webmcp.devpost.com/resources).

## Product

**Focus Contract Studio** is a human-governed studio for one dialog family's keyboard-focus contract.

The product turns a repeated accessibility decision into a durable, revision-bound record. A browser agent can inspect the exact live dialog, retrieve relevant prior decisions, and stage a proposal. The reviewer can rehearse, edit, approve, reject, apply, verify, and undo through the visible accessible interface.

## Primary user

An accessibility or design-system lead inside one product company who repeatedly reviews related dialog variants and has authority to decide the intended keyboard behavior.

## Problem

**[Empirical]** Current practitioner reports describe scanner disagreement, false positives, manual keyboard/screen-reader review, late accessibility rework, and agent-generated UI drifting from design-system rules. These reports are pain evidence, not market-size or willingness-to-pay proof.

**[High-Conviction]** The specific gap is not issue detection. It is preserving why a human made a bounded focus decision, attaching it to stable component identity and revision, reusing it as precedent without turning it into permission, and verifying that the new live behavior matches the newly approved contract.

## Hero proof

The live Delete Account dialog opens with:

- `Implemented revision 1: Delete`
- `Applicable prior decision D001: Cancel`
- a visible `DECISION MISMATCH` label
- an agent-created proposal labeled `NOT APPLIED` and `AWAITING UI REVIEW`
- one synthetic prior reviewer rationale that changes proposal eligibility while unrelated, superseded, and hostile records stay excluded

The reviewer approves the exact proposal through the visible UI, the app applies a new revision, raw focus events verify the fix, reload proves persistence, a stale or forged attempt fails, and undo creates another revision. The same agent-authored change is rejected when D001 is removed, proving memory affected proposal eligibility without granting permission.

## What we are building

### Product surface

- One premium, responsive, keyboard-complete Site.
- One controlled product workspace and one dialog component family.
- Two deterministic Delete Account variants: seeded mismatch and corrected/revised state.
- Anonymous isolated judge workspaces plus optional Sign in with ChatGPT.
- Visible implemented configuration, raw observation summary, precedent evidence, proposal diff, review controls, receipts, revision history, verification, and undo.

### WebMCP

- Top-level imperative `document.modelContext.registerTool` only.
- Four tools: read active review, create proposal, apply approved proposal, verify observed rehearsal.
- Human UI and WebMCP call the same query/command services.
- No model API; ChatGPT supplies reasoning.

### Persistent state

- Sites-managed D1 only.
- Revisioned focus configurations, immutable proposals, exact UI review decisions, application receipts, verification receipts, undo lineage, audit events, and decision precedents.
- Strict workspace isolation, optimistic revision checks, atomic writes, and idempotency.

### Retrieval

- Three eligible-only ranked signals: deterministic TypeScript BM25, structured applicability, and explicit subject-edge rank.
- Clean-room Reciprocal Rank Fusion with fixed `k = 60`, full-precision score sorting, fixed eight-decimal display, and stable ID tie-breaking.
- 36 synthetic records, 12 development queries, 18 frozen holdout queries.
- Retrieval is evidence only and can never satisfy approval.

### Verification

- Actual `keydown` and `focusin` observations from the rendered dialog.
- Independent verifier compares finalized raw events with the named implemented revision being checked.
- Automated domain, D1, UI, WebMCP-shim, accessibility, security, and retrieval tests.
- Manual acceptance in a current supported ChatGPT client. Chrome 149+ is reported only if the current enabled WebMCP path passes the named hosted probe.
- Bounded VoiceOver checklist in the named environment.

## Explicit non-goals

- No generalized scanner, WCAG score, certification, overlay, or universal accessibility claim.
- No source-code generation, patching, deployment, arbitrary website repair, or external design-tool integration.
- No agency multi-tenancy, multiple products, collaborative teams, billing, analytics platform, or admin console.
- No Figma, Storybook, generalized component library, or broad accessibility platform.
- No external backend, model API, vector database, embeddings, graph database, Kuzu, LanceDB, Ollama, Clivus daemon/server, or private Clivus corpus.
- No declarative WebMCP, iframe tools, cross-origin tools, server MCP, or hidden agent.
- No alternate production host unless ChatGPT Sites becomes a verified hard blocker and the founder explicitly changes D-005.

## Time and execution boundary

- Founder budget: 45–60 focused hours.
- Build mode: autonomous with continuous tests and two independent adversarial reviews.
- Scope rule: preserve the complete vertical slice and proof gates; remove polish before removing correctness, accessibility, security, benchmark, judge access, or submission evidence.
- Submission rule: finish and freeze the exact repository, deployed version, video, and Devpost text before the deadline.

## Definition of done

The product is done only when every requirement in `docs/quality/TRACEABILITY_MATRIX.md` is PASS, the release gates in `docs/quality/TEST_STRATEGY.md` are PASS, the live judge journey succeeds from a clean signed-out browser, and an immutable release attestation maps the deployed Site version, public repository source commit `C`, video, evidence, and Devpost entry to one release lineage.
