# Focus Contract Studio — Devpost Submission and Demo Plan

Status: **CURRENT SUBMISSION AUTHORITY**  
Verified: **2026-09-03 EDT**
Hackathon: **The WebMCP Challenge — Devpost ID 31011 / slug `webmcp`**

## Current official facts

**[Empirical]** The organizer's September 3 outage announcement extended submissions to **2026-09-04 08:00 UTC / 04:00 EDT / 01:00 PT**. Devpost reported `submissions_open` when rechecked at 2026-09-03 21:36 UTC. Judging is listed from **2026-09-04 17:00 UTC through 2026-09-22 00:00 UTC**, with winners announced **2026-09-23 21:00 UTC**. Recheck immediately before submission.

**[Empirical]** The published criteria are equally weighted and use this order for tie-breaks:

1. WebMCP Leverage
2. Execution
3. Potential Impact
4. Creativity & Ambition

The formal rules do not publish a five-point numeric scale, so this pack does not invent one.

**[Empirical]** There are no tracks and ten submissions are listed to win. The release therefore optimizes one coherent proof across all four criteria rather than chasing a category-specific gimmick.

**[Empirical]** The required package includes a working public live URL, a project description explaining WebMCP fit and the human-agent experience, a public YouTube demo under three minutes with audio, and a public source repository with complete code/instructions and a visible open-source license. The required custom live-URL field controls over any generic optional website flag.

**[Empirical]** The August 28 organizer update says to show the working product in the first 10–15 seconds and warns entrants not to change the description, video, repository, or live Site after the deadline.

Controlling sources: [official rules](https://webmcp.devpost.com/rules), [challenge page](https://webmcp.devpost.com/), and [organizer updates](https://webmcp.devpost.com/updates).

## Canonical positioning

- **Title:** `Focus Contract Studio`
- **Tagline:** `Human precedent guides the next repair. Exact review controls permission.`
- **Primary user:** accessibility or design-system lead inside one product company.
- **Short pitch:** Focus Contract Studio lets a reviewer and ChatGPT inspect the same live Delete Account dialog, retrieve applicable prior decisions, stage an unapplied implemented-focus change, bind review to its exact digest and base revision, apply it once through guarded D1 writes, and verify the rendered keyboard behavior from raw events.

### Why WebMCP is essential

The useful operation depends on state that exists only on the current page: rendered dialog variant, implemented revision, raw observation, eligible evidence query, immutable proposal, and UI review state. WebMCP lets ChatGPT call typed page-bound capabilities against that exact state. The Site exposes read, propose, apply-an-already-approved-proposal, and verify. It deliberately exposes no approval tool.

### Better human-agent experience

- Human and agent inspect one live state and the same bounded evidence packet.
- The agent's proposal is durable but unmistakably `NOT APPLIED`.
- Prior reviewer decisions can support changed proposal fields without becoming authority.
- Exact digest/revision checks, guarded writes, and idempotency make stale/forged/retried application observable and safe.
- Independent raw-event verification can contradict a proposed/implemented configuration.
- The complete keyboard-accessible human journey remains available when WebMCP is unsupported.

### Brief implementation

One full-stack strict-TypeScript ChatGPT Site registers four top-level imperative WebMCP tools. The visible UI and tool adapters use the same protected application services. Sites D1 stores isolated workspaces, implemented focus revisions, synthetic precedent, immutable proposals, UI review decisions, raw rehearsals, and apply/verification/undo receipts. One indexed query performs eligibility before ranking; deterministic eligible-only TypeScript BM25, structured applicability, and subject-edge ranks are fused with clean-room RRF `k=60`. Retrieval cannot create review state. Guarded D1 writes repeat execution predicates, abort incomplete batches, inspect zero-row results, and create exactly one revision/receipt. The Site calls no model API.

## Criterion proof map

| Criterion | Show in product/video | Evidence required |
|---|---|---|
| WebMCP Leverage | ChatGPT reads exact page state, creates a durable unapplied proposal, requests application only after visible review, and verifies a new raw rehearsal. | Exact four tool traces on `C/V/U`, schema/adapter tests, no approval tool. |
| Execution | Signed-out first run, premium state hierarchy, D1 reload, isolation, stale/forged zero-mutation, idempotent replay, undo, accessibility, public repository/Site. | Public journey, D1 matrix, supported-client matrix, security/manual evidence. |
| Potential Impact | Name the repeated design-system decision/rationale problem and the narrow lead persona; do not claim demand or adoption. | Concrete full workflow; any market-value statement labeled hypothesis with practitioner validation plan. |
| Creativity & Ambition | Memory changes proposal eligibility without granting permission; independent observation prevents self-confirming automation. | Memory-on/off counterfactual, sealed v2 retrieval report, deliberate verifier divergences. |

## 170-second demo storyboard

Target final duration: **165–170 seconds**. Public YouTube, English narration, clear audio, captions if feasible.

| Time | Exact screen action | Proof conveyed |
|---:|---|---|
| 0–12 s | Public Site already open. Trigger Delete Account; focus lands on Delete. Show `Revision 1: Delete`, `Prior decision D001: Cancel`, and `DECISION MISMATCH`. | Working product immediately; coherent current-versus-precedent problem, not a fake standards verdict. |
| 12–29 s | ChatGPT invokes `read_active_focus_review`; show page state and bounded evidence cards/rank contributions. | WebMCP reads the exact live page; evidence is scoped and labeled non-authoritative. |
| 29–47 s | ChatGPT invokes `create_focus_contract_proposal`; show `Delete → Cancel` diff and large `NOT APPLIED`. Reopen dialog and show it still focuses Delete. | Proposal is real/durable but cannot mutate. |
| 47–65 s | Brief paired memory proof: same change with D001 is accepted; prepared no-evidence variant returns `EVIDENCE_REQUIRED_FOR_AGENT_CHANGE`. Return to accepted proposal. | Precedent materially affects agent proposal eligibility without creating approval. |
| 65–82 s | Reviewer inspects digest/base revision and uses keyboard to click `Approve exact proposal` in the visible UI. | Exact UI-mediated authority; no agent approval claim. |
| 82–99 s | ChatGPT invokes `apply_approved_focus_contract`; show revision `1 → 2` receipt and same-key recovery badge. | Guarded, idempotent execution against current state. |
| 99–121 s | Reopen dialog; focus now lands on Cancel. Complete Tab, Shift+Tab, Escape, return focus; invoke `verify_focus_contract`; show six-check receipt. | Renderer follows revision 2 and independent raw events verify it. |
| 121–137 s | Run a prepared stale/forged attempt; show safe error and unchanged revision. | Safety is visible, not only documented. |
| 137–151 s | Reload history; undo creates revision 3 and preserves lineage. | D1 durability and reversible append-only history. |
| 151–162 s | Show exact four-tool/client matrix and synthetic v2 benchmark card only if both release reports pass. | Non-trivial WebMCP plus bounded tested evidence. |
| 162–170 s | Return to hero summary. | “The agent contributes evidence and proposals. Exact review controls permission. Real behavior proves the result.” |

Do not show login, terminal/code scrolling, architecture slides, generic AI claims, a fake success state, private account data, or any metric whose exact release artifact is not `PASS`.

## Capture protocol

1. Use the public exact `C/V/U` release and a clean anonymous profile.
2. Reset and rehearse the complete script three times without changing code/data schemas.
3. Capture at 1440×900 or 1920×1080 with product text legible at normal playback.
4. Hide bookmarks, notifications, account email, private tabs, secrets, local paths, and debug panels.
5. Record original narration; normalize both audio channels; add accurate captions when time permits.
6. Edit pauses/errors only. Never splice states from different commits, Site versions, workspaces, or benchmark runs.
7. Verify exported duration ≤170 seconds, public YouTube playback while signed out, audio, captions, and all on-screen claims.
8. Record source file hash, duration, upload time, public URL, `C/V/U`, and storyboard checklist in `E-027`.

## Screenshot set

1. Revision 1/D001 `DECISION MISMATCH` hero.
2. WebMCP-created evidence-supported proposal with `NOT APPLIED`.
3. Exact UI approval and revision 1→2 application receipt.
4. Six-rule verification receipt plus durable history/undo lineage.

Every screenshot manifest stores `C/V/U`, UTC capture time, dimensions, SHA-256, caption, and redaction review.

## Public repository package

- Root Apache-2.0 `LICENSE` visible to judges and repository metadata.
- Complete source, lockfile, additive migrations, sealed fixtures, tests, controlling docs, and non-sensitive evidence summaries.
- README sections: problem; 60-second judge path; hero truth; architecture; exact four tools; install/run/test/deploy; authority/security/privacy; accessibility; v1/v2 benchmark honesty; client matrix; AI use; provenance; limitations.
- Clean-clone locked install and production build pass on source `C`.
- Challenge-period history clearly identifies new work and untouched generated scaffold provenance.
- No secret, raw identity, private data, Clivus artifact, local-only absolute path, placeholder, or unresolved high finding.
- Release page publishes the post-deploy attestation and selected evidence assets without claiming those assets were deployed source.

## Devpost standard fields

Complete and validate at minimum:

| Field | Required content |
|---|---|
| Project title | Canonical title above. |
| Tagline | Canonical tagline above. |
| Description | Inspiration, what it does, why WebMCP, better human-agent experience, how built, challenges, accomplishments, learning, next validation, limitations. |
| Built With | Only actual release stack and tested technologies. |
| Live application | Exact public `U`, signed-out verified. |
| Source repository | Exact public repository at/tagging source `C`, visible license. |
| Demo video | Public YouTube, audio, <180 seconds; internal release gate ≤170 seconds. |
| Images | Four exact-release screenshots with concise truthful captions. |

## Devpost custom fields

Current fields from the Devpost Hackathons capability:

| ID | Required | Release answer contract |
|---:|---|---|
| `28249` Submitter Type | Yes | `Individual` — founder decision. |
| `28250` Country of residence | Yes | Founder supplies truthful current residence; never infer it from citizenship, timezone, education, or location history. |
| `28251` Organization name | Conditional | Blank for individual unless the live form requires a truthful value. |
| `28252` App Status | Yes | `New`. |
| `28253` Existing-project changes | Conditional | Blank/not applicable for the new clean-room project; if live form requires text, state exactly what was built during the challenge. |
| `28254` Live URL | Yes | Exact public `U`. |
| `28255` Testing instructions/credentials | Optional | No credentials. Name the exact `PASS` ChatGPT client journey; mention Chrome only if its release row passed. |
| `28256` Public repository | Yes | Exact public source URL/tag for `C`. |
| `28257` Tested agents/clients | Yes | Only exact release matrix rows with version/build and `PASS`/`FAIL`/`INCONCLUSIVE`; do not infer compatibility. |
| `28258` AI tools used | Yes | ChatGPT/Codex for research/build/tests/docs/review; Claude for advisory review; ChatGPT as runtime WebMCP client. Site has no hidden model API. |
| `28259` Learning | Yes | `Significant`, supported by the actual WebMCP/D1/accessibility/governed-mutation work completed. |
| `28260` Career AI value | Yes | `Yes` only if founder still truthfully affirms at submission. |

Do not submit externally without founder authorization. The founder must also confirm age, residence, account, conflicts, sanctions/eligibility, entrant representation, and any other live legal field.

## Claim gates

- “Works in ChatGPT” requires `E-021 PASS` for the exact release.
- Any Chrome statement requires its `E-004` bootstrap and `E-021` release rows; otherwise omit it.
- “RRF beat each ranker by ≥0.05” requires `E-022 PASS` and must say the 36-record corpus is synthetic and holdout procedural/public.
- “Memory changed ChatGPT's proposal” requires the separate paired real-client trace. The deterministic memory-on/off test supports only proposal eligibility.
- Accessibility claims name exact behavior/environment; never claim WCAG compliance or certification.
- Security claims name exact guards/tests; never claim enterprise-grade, production-proven, or biologically human approval.
- Impact/adoption/willingness-to-pay remain hypotheses until real practitioner evidence exists.

## Final submission sequence

1. Recheck official rules, updates, deadline, form fields, eligibility, and public-video requirements.
2. Confirm pre-submission rows `E-001` through `E-028` are present and valid; conditional rows are explained. `E-029` cannot exist until submission succeeds.
3. Validate source `C`, Sites `V/U`, repository/license, video, screenshots, client matrix, benchmark, and claims.
4. Publish the stable public GitHub Release page for the release tag pointing to `C` and all non-receipt evidence assets; that page URL may be included in the description.
5. Paste regenerated copy from `devpost-submission.md`; remove every placeholder and every unpassed claim.
6. Preview on desktop/mobile; verify images, markdown, video embed/playback, and external links while signed out.
7. Founder reads legal/custom answers, approves final copy/video, and explicitly authorizes submission.
8. Submit by the revised internal target **2026-09-04 01:00 EDT**, capture `E-029`, and re-open the entry to confirm saved state.
9. Generate the final evidence index and `E-030` attestation from `E-001` through `E-029`; validate/hash/publish both as release assets before the official deadline. This does not change source `C` or the deployed Site.
10. Recheck the public release page, entry, Site, repository, and video; then freeze all artifacts. After the extended deadline perform read-only link/availability checks only.

## Post-deadline rule

Do not change the live Site, D1 data/schema, repository, release assets, video, screenshots, description, or Devpost entry after **2026-09-04 08:00 UTC** without written organizer authorization. Preserve availability and record platform incidents without mutating the entry.
