# Repository Professionalism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the public repository into a judge-first, product-clear, reproducible open-source package without changing the deployed R10 application or overstating submission status.

**Architecture:** Treat this as a non-runtime repository evidence commit layered after the immutable R10 source release. Preserve `webmcp-challenge-2026-r10` as the exact source of the live deployment; improve repository presentation, onboarding, community health, release-status truth, and the historical binding gate needed to admit these repository-only changes. Reuse the published R10 screenshots and the repository's existing local-link, secret-scan, build, browser, and source-binding verification instead of introducing a second documentation framework.

**Tech Stack:** GitHub-flavored Markdown, GitHub repository metadata, Node.js 22.22.3, npm 10.9.8, existing `npm run verify` gate, existing Package 8 publication checks.

**Spec:** `docs/authority/PRODUCT_TRUTH.md`, `docs/delivery/SUBMISSION_PLAN.md`, and the founder-approved repository design from 2026-09-03.

## Global Constraints

- Keep the application runtime, domain model, WebMCP contracts, database, and deployment unchanged.
- Preserve exactly four WebMCP tools and the visible-human-approval authority boundary.
- State that the live deployment is source-bound to `webmcp-challenge-2026-r10`; do not imply a documentation-only follow-up commit was deployed.
- Keep the demo video and final Devpost submission explicitly pending.
- Use only original Focus Contract Studio screenshots already attached to the public R10 release.
- Add no dependency, framework, speculative feature, or unsupported compliance claim.
- Keep one writer in this checkout; use read-only reviewers.

---

### Task 1: Freeze the R10 baseline and plan the evidence-only change

**Files:**
- Create: `docs/superpowers/plans/2026-09-03-repository-professionalism.md`

- [x] Confirm the isolated R10 worktree is on exact commit `cd432d4a055f061ff3a2df8a95fb1b5fae17b47a` with a clean tree.
- [x] Create local branch `docs/repository-professionalism-r10` from that exact commit.
- [x] Install the lockfile-pinned dependencies with `npm ci` under Node.js `22.22.3` and npm `10.9.8`.
- [x] Run `npm run verify` with localhost permission. Require exit `0`, `PACKAGE8_RELEASE_PASS packages=724 checks=16`, and all R10 binding checks passing.
- [x] Self-review this plan against the approved README order, community-health deliverables, truthful R10 status, local setup, tests, and external-action boundary.
- [x] Commit the plan:

```bash
git add docs/superpowers/plans/2026-09-03-repository-professionalism.md
git commit -m "docs: plan the repository professionalism pass"
```

### Task 2: Bring the published product proof into the repository

**Files:**
- Create: `docs/media/r10/hero-mismatch.png`
- Create: `docs/media/r10/proposal-not-applied.png`
- Create: `docs/media/r10/visible-review.png`
- Create: `docs/media/r10/verification-pass.png`
- Modify: `docs/evidence/PROVENANCE_LEDGER.md`

- [x] Download the four original screenshots from the public `webmcp-challenge-2026-r10` GitHub release into a temporary directory.
- [x] Inspect all four images and confirm they show the claimed R10 states without secrets, credentials, personal data, browser chrome, or misleading staging UI.
- [x] Copy the reviewed bytes into `docs/media/r10/` using stable lowercase filenames.
- [x] Record their first-party origin, exact release URL, and purpose in `docs/evidence/PROVENANCE_LEDGER.md`.
- [x] Verify PNG types, non-zero dimensions, file sizes, and SHA-256 digests:

```bash
file docs/media/r10/*.png
sips -g pixelWidth -g pixelHeight docs/media/r10/*.png
shasum -a 256 docs/media/r10/*.png
```

- [x] Commit the visuals and provenance:

```bash
git add docs/media/r10 docs/evidence/PROVENANCE_LEDGER.md
git commit -m "docs: add source-bound R10 product proof"
```

### Task 3: Rewrite the README around the judge's first minute

**Files:**
- Modify: `README.md`

- [x] Replace the internal release-led opening with the product promise: accessibility evidence enters the page, an agent drafts a bounded repair, a human approves it visibly, and the browser proves the result.
- [x] Add concise CI, R10 release, license, live-app, and WebMCP badges or calls to action with valid public targets.
- [x] Place `docs/media/r10/hero-mismatch.png` above the fold with meaningful alt text.
- [x] Tell the concrete Delete-versus-Cancel story before architecture or setup.
- [x] Show the five-step loop: Evidence -> agent proposal -> human approval -> guarded apply -> browser proof.
- [x] Explain why WebMCP is essential: page-bound tools share the same visible state and policy boundary as the human workflow.
- [x] List exactly what agents can and cannot do, preserving the four-tool contract and visible approval rule.
- [x] Add a 60-second judge walkthrough linked to the live app and the exact R10 release.
- [x] Add the remaining three R10 screenshots as a compact proof sequence.
- [x] Preserve reproducible setup, canonical verification, architecture, security, limitations, documentation routes, and Apache-2.0 license while moving deep forensic detail behind links.
- [x] State clearly that `main` may contain later documentation-only improvements while the live app remains bound to the R10 tag.
- [x] Confirm no stale phrase such as "planned judge release target" or "R10 pending" remains in the README:

```bash
rg -n "planned judge release target|R10.*pending|pending.*R10" README.md
```

- [x] Run the existing local Markdown-link validator:

```bash
node --input-type=module -e "import { checkLocalMarkdownLinks } from './scripts/package8-release-checks.mjs'; const broken = checkLocalMarkdownLinks(process.cwd()); if (broken.length) throw new Error(broken.join('\\n')); console.log('LOCAL_MARKDOWN_LINKS_PASS')"
```

- [x] Commit the README together with Task 4's linked contributor files so the commit has no broken local links:

```bash
git add README.md .env.example .gitignore CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md CHANGELOG.md .github/ISSUE_TEMPLATE/bug_report.yml docs/README.md
git commit -m "docs: make the repository judge-first and contributor-ready"
```

### Task 4: Make local setup and collaboration self-explanatory

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`
- Create: `CONTRIBUTING.md`
- Create: `SECURITY.md`
- Create: `CODE_OF_CONDUCT.md`
- Create: `CHANGELOG.md`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `docs/README.md`

- [x] Add a safe `.env.example` with `FCS_PUBLIC_ORIGIN` plus three explicit secret placeholders; never include working, reused, or production credentials.
- [x] Add the narrow `.gitignore` exception required to track only `.env.example` while continuing to ignore every real `.env*` file.
- [x] Document exact secret generation and local startup steps without asking contributors to invent formats.
- [x] Add a concise contribution path: branch, install, verify, focused test expectations, product authority, WebMCP invariants, evidence labels, and pull-request checklist.
- [x] Add a coordinated vulnerability disclosure policy with supported version, reporting route, response expectations, and explicit prohibition on testing the public service or real user data.
- [x] Add a short original code of conduct appropriate for this repository; do not import a third-party template that creates an unrecorded license obligation.
- [x] Add a changelog that records the R10 public release and the documentation-only repository professionalism pass without calling it a deployed product release.
- [x] Add one structured bug-report form that captures environment, reproduction, expected/actual behavior, accessibility input method, and redaction confirmation.
- [x] Add `docs/README.md` as the curated map to product truth, WebMCP contracts, architecture, security, verification, operations, evidence, and submission materials.
- [x] Verify the example remains tracked while real environment files remain ignored:

```bash
git check-ignore -v .env.local
git check-ignore -v .env.example || true
git status --short
```

- [x] Run the existing local Markdown-link validator again:

```bash
node --input-type=module -e "import { checkLocalMarkdownLinks } from './scripts/package8-release-checks.mjs'; const broken = checkLocalMarkdownLinks(process.cwd()); if (broken.length) throw new Error(broken.join('\\n')); console.log('LOCAL_MARKDOWN_LINKS_PASS')"
```

- [x] Commit the open-source package atomically with the README links in Task 3:
  the README depends on these paths, so a split intermediate commit would have
  contained broken local links.

### Task 5: Reconcile the published R10 truth with the submission draft

**Files:**
- Modify: `devpost-submission.md`
- Modify: `.devpost-hackathon-state.json`

- [x] Replace obsolete R9/R10-pending statements with verified public R10 facts: live URL, public repository, exact tag, GitHub release, four-tool hosted proof, and canonical local gate.
- [x] Preserve the honest boundary that the under-three-minute public video and final Devpost submission remain pending.
- [x] Update only the state fields whose external facts changed; keep the workflow status at `drafting`.
- [x] Validate JSON syntax:

```bash
node -e "JSON.parse(require('node:fs').readFileSync('.devpost-hackathon-state.json', 'utf8'))"
```

- [x] Search the public-facing package for contradictory R10 status language and manually disposition every hit:

```bash
rg -n "R9 is live|R10.*pending|pending.*R10|planned judge release target" README.md devpost-submission.md .devpost-hackathon-state.json CHANGELOG.md
```

- [x] Commit the status reconciliation:

```bash
git add devpost-submission.md .devpost-hackathon-state.json
git commit -m "docs: reconcile the public R10 release status"
```

### Task 6: Prove the repository package and obtain independent review

**Files:**
- Verify: all files changed by Tasks 1-5
- Modify: `tests/package9-node/source-evidence.test.ts`

- [x] Reproduce the historical R10 binding failure caused by comparing R9 with post-R10 `HEAD`.
- [x] Freeze the R10 assertion to the immutable annotated R10 tag and add a separate exact allowlist for post-R10 non-runtime repository changes.
- [x] Run `npm run verify:package9:binding` and require all 11 tests to pass.
- [x] Review `git diff webmcp-challenge-2026-r10...HEAD` and confirm every change is documentation, repository metadata, first-party media, or the minimal binding-test repair.
- [x] Run a placeholder and private-data scan across all changed text:

```bash
git diff --name-only --diff-filter=ACMRT webmcp-challenge-2026-r10...HEAD
rg -n "TBD|TODO|FIXME|CHANGEME|<your" README.md CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md CHANGELOG.md docs/README.md docs/evidence/PROVENANCE_LEDGER.md devpost-submission.md .devpost-hackathon-state.json .env.example .github/ISSUE_TEMPLATE/bug_report.yml
```

- [x] Run the existing exported `checkLocalMarkdownLinks` verifier and require zero broken local links.
- [ ] Run `npm run verify` from the clean committed branch with localhost permission; require exit `0`, `PACKAGE8_RELEASE_PASS packages=724 checks=16`, and all R10 binding checks passing.
- [ ] Create a clean no-hardlinks clone of the exact branch HEAD, run `npm ci`, then run `npm run verify` there with localhost permission.
- [x] Ask one read-only reviewer to assess product clarity, README hierarchy, setup completeness, status truth, accessibility of screenshots, broken links, and open-source professionalism against the approved design.
- [x] Ask one read-only reviewer to assess security/privacy claims, secret handling, release lineage, four-tool invariants, and whether any changed wording exceeds the evidence.
- [x] Resolve every Critical or Important finding and rerun the affected checks.
- [ ] Record the final branch name, HEAD, diff summary, gate result, clone result, and any genuinely unverified external item.

### Task 7: Finish at the external publication boundary

**Files:**
- No further local file changes unless review finds an issue.

- [ ] Use `superpowers:finishing-a-development-branch` after the final green verification.
- [ ] Keep the completed local branch and worktree intact unless the founder selects another integration option.
- [ ] Before any push, PR, merge to the public remote, GitHub metadata change, release edit, or publication, request one exact authorization naming the branch/commit, destination, and effect.
- [ ] Enable and verify GitHub private vulnerability reporting before publishing the new `SECURITY.md` link.
- [x] Do not mark the demo video or final Devpost submission complete.
