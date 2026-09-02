# Focus Contract Studio — Evidence Registry

Status: **CONTROLLING EVIDENCE CONTRACT**  
Authority revision: **2.0 — 2026-08-29 EDT**

## Purpose

This registry prevents “we tested it” from becoming an unverifiable claim. Every release gate, compatibility statement, benchmark number, security statement, accessibility statement, and submission link must resolve to one named artifact tied to the correct source commit and, where relevant, the exact deployed Sites version.

## Result vocabulary

- `PASS`: the named procedure completed in the named environment and met the frozen gate.
- `FAIL`: the procedure completed and did not meet the gate.
- `INCONCLUSIVE`: interrupted, inaccessible, wrong source/version, incomplete, or unable to establish the result.
- `NOT_RUN`: planned but not executed. Never convert this to a claim.
- `NOT_APPLICABLE`: permitted only for an explicitly conditional item such as Chrome or optional sign-in, with the failed/unsupported bootstrap probe linked.

No blank result means pass. Local, shim, or saved-version results never substitute for public deployed/real-client evidence.

## Release identity model

- `C` is the full Git SHA containing the exact deployed source and final `release/BUILD_INPUTS.json`.
- `V` is the exact Sites saved version built from `C`.
- `U` is the public deployed URL for `V`.
- `A` is the post-deploy `RELEASE_ATTESTATION.json`, generated only after public/client/manual/video/submission evidence exists.
- Optional `E` is a later evidence-only repository commit. If used, it must never be described as deployed source.

Every artifact records the identifiers that existed when it ran. Source-only evidence records `C`; live evidence records `C`, `V`, and `U`; video/submission evidence also records the relevant URL/hash/receipt. `A` joins them without self-reference.

## File conventions

Future product repository paths:

```text
docs/evidence/
  BOOTSTRAP_PROBES.md
  AUTHORITY_VALIDATION.json
  PROVENANCE_LEDGER.md
  ADVERSARIAL_REVIEW_1.md
  ADVERSARIAL_REVIEW_2.md
  MANUAL_ACCESSIBILITY.md
  COLD_COMPREHENSION.md
  CLIENT_MATRIX.md
release/
  BUILD_INPUTS.json
.artifacts/
  test/
  security/
  retrieval/
  browser/
  clients/
  accessibility/
  reviews/
  media/
  submission/
  release/EVIDENCE_INDEX.json
  release/RELEASE_ATTESTATION.json
```

Markdown files contain concise, human-readable summaries and artifact hashes. `.artifacts/` contains machine output, traces, screenshots, and reports and is excluded from production bundles. Secrets, unredacted authenticated headers, browser session bearer values, IPs, full emails, names, typed values, and private browser/account content are never stored.

## Required evidence

| ID | Stage | Required artifact | Gate / claim supported | Required identity | Release status now |
|---|---|---|---|---|---|
| `E-001` | Authority | `docs/evidence/AUTHORITY_VALIDATION.json` | All controlling docs/refs consistent; no stale forbidden assumptions; JSON/Markdown/local links valid. | Authority revision + pack hash | `NOT_RUN` in product repo |
| `E-002` | Benchmark seal | `docs/retrieval/fixtures/rrf/SHA256SUMS-v2` | Exact v2 inputs, schemas, evaluator, and calibration are frozen. | File hashes | `PASS` in planning pack |
| `E-003` | Benchmark calibration | `docs/retrieval/fixtures/rrf/RRF_V2_CALIBRATION.json` | Feasible pre-implementation baselines and predicted v2 gates; not product evidence. | Evaluator/input hashes | `PASS` in planning pack |
| `E-004` | Bootstrap | `docs/evidence/BOOTSTRAP_PROBES.md` | Generated framework/versions, build, bindings, access, D1, WebMCP, identity, cookie, trustworthy client-isolation signal, test harness, and conditional Chrome facts. | Probe commit + Sites probe version | `NOT_RUN`; actual Sites edge client isolation blocks Package 8 |
| `E-005` | Build inputs | `release/BUILD_INPUTS.json` | Exact toolchain, commands, lockfile, authority, and fixture inputs committed before deploy. | Contained in `C` | `PASS` local pre-live input; final `C` not assigned |
| `E-006` | Unit/contracts | `.artifacts/test/unit.json` | Schemas, hashes, evidence-token vectors/tamper/expiry/boundaries, state machines, rank vectors, verifier rules, UI reducers. | `C` | `PASS` frozen local evidence; final `C` identity pending |
| `E-007` | D1 integration | `.artifacts/test/d1.json` | Migrations, constraints, isolation, read-no-write, atomic evidence+proposal persistence, guarded writes, transaction-coupled admission, zero-row checks, rollback, idempotency, concurrency. | `C` | `PASS` frozen local evidence plus Package 8 all-mutation admission/replay/rollback and clean-D1 tests; final `C` identity pending |
| `E-008` | Component/UI | `.artifacts/test/component.json` | Visible states, exact review controls, dialog semantics, live announcements. | `C` | `PASS` frozen local evidence; final `C` identity pending |
| `E-009` | Browser automation | `.artifacts/browser/playwright.json` | Complete anonymous human journey, keyboard, two-profile isolation, reload, stale failure, undo. | `C` + local/owner/public environment | `PASS` frozen/local built-Worker evidence; owner/public identity pending |
| `E-010` | Accessibility automation | `.artifacts/accessibility/axe.json` | No serious/critical automated violations on every key state. | `C` + browser/version | `PASS` frozen/local automation plus Package 8 built-Worker 320/375/true-200%-zoom keyboard/reflow/Axe checks; manual evidence pending |
| `E-011` | Observer/verifier | `.artifacts/test/verifier-independence.json` | Allowlisted observation-event privacy/immutability; six rules; each deliberate divergence fails; dependency boundary. | `C` | `PASS` frozen local evidence; final `C` identity pending |
| `E-012` | Memory causal proof | `.artifacts/test/memory-counterfactual.json` | Same agent proposal accepted with D001 and rejected without; no application/approval change. | `C` + fixture IDs/digests | `PASS` local deterministic counterfactual; final `C` identity pending |
| `E-013` | Retrieval development | `.artifacts/retrieval/rrf-dev-report.json` | 12/12 dev dispositions, golden parity, zero forbidden, 100-repeat determinism; no holdout import. | `C` + v2 hashes | `PASS` local development only; holdout remains `NOT_RUN` |
| `E-014` | Coverage | `.artifacts/test/coverage-summary.json` | Frozen safety-core/global coverage thresholds. | `C` | `PASS` frozen local coverage gates; final `C` identity pending |
| `E-015` | Build/clean clone | `.artifacts/test/clean-clone.json` | Locked install, typecheck, lint, canonical verify, production build from a fresh clone. | `C` + toolchain | `TERMINAL_POST_COMMIT` |
| `E-016` | Security/supply chain | `.artifacts/security/release-security.json` | Nonce-rooted CSP/config, atomic admission, live pinned Gitleaks content-bound current-tree/reachable-history scans with locked policy and planted negative, dependency/license/bundle scans; no unresolved critical/high. | `C` | Local integrity `PASS`; overall Package 8 `BLOCKED` on Sites edge client isolation; final `C` identity pending |
| `E-017` | Provenance | `docs/evidence/PROVENANCE_LEDGER.md` | New-project/Clivus boundary, dependency/assets/scanner/AI disclosure, license obligations. | `C` | Local integrity `PASS`; overall Package 8 `BLOCKED`; final `C` identity pending |
| `E-018` | Review 1 | `docs/evidence/ADVERSARIAL_REVIEW_1.md` | Local authority/security/retrieval/UX audit; every finding disposition and retest. | Reviewed commit(s), final `C` candidate | `NOT_RUN` |
| `E-019` | Deployment mapping | `.artifacts/release/sites-deployment.json` | Sites project/version `V` was built from `C`; owner/public deployment timestamps and `U`. | `C`, `V`, `U` | `NOT_RUN` |
| `E-020` | Public smoke | `.artifacts/browser/public-journey.json` | Signed-out first run, two-profile isolation, full hero, persistence, recovery, public availability. | `C`, `V`, `U` | `NOT_RUN` |
| `E-021` | Real clients | `docs/evidence/CLIENT_MATRIX.md` + `.artifacts/clients/client-matrix.json` | Exact ChatGPT PASS; Chrome/other only as tested `PASS`/`FAIL`/`INCONCLUSIVE`/`NOT_APPLICABLE`. | `C`, `V`, `U`, client/build | `NOT_RUN` |
| `E-022` | Release holdout | `.artifacts/retrieval/rrf-holdout-report.json` | One-time exact-source 18/18 dispositions, metrics, zero forbidden, determinism, latency, independent runner. | `C`, `V`, `U`, v2 hashes | `NOT_RUN` |
| `E-023` | Manual accessibility | `docs/evidence/MANUAL_ACCESSIBILITY.md` | Named VoiceOver/browser/OS and keyboard/reflow checks completed by founder. | `C`, `V`, `U`, environment | `NOT_RUN` |
| `E-024` | Cold comprehension | `docs/evidence/COLD_COMPREHENSION.md` | First-time evaluator identifies four hero truths within 15 seconds without coaching. | `C`, `V`, `U`, evaluator protocol | `NOT_RUN` |
| `E-025` | Review 2 | `docs/evidence/ADVERSARIAL_REVIEW_2.md` | Fresh public-release attack and claim audit; no open high-severity finding. | `C`, `V`, `U` | `NOT_RUN` |
| `E-026` | Screenshots | `.artifacts/media/screenshots.json` | Four exact-release images, dimensions, hashes, timestamps, no secrets. | `C`, `V`, `U` | `NOT_RUN` |
| `E-027` | Video | `.artifacts/media/video.json` | Public YouTube, ≤170 seconds, audio, first product proof ≤15 seconds, file hash, signed-out playback. | `C`, `V`, `U`, video URL/hash | `NOT_RUN` |
| `E-028` | Submission audit | `.artifacts/submission/devpost-audit.json` | Every required standard/custom field, link, truthful founder fact, and claim-source check. | `C`, `V`, `U`, video/repo URLs | `NOT_RUN` |
| `E-029` | Submission receipt | `.artifacts/submission/devpost-receipt.json` | Successful saved/final submission and timestamp before deadline. | Submission URL/id + time | `NOT_RUN` |
| `E-030` | Release attestation | `.artifacts/release/RELEASE_ATTESTATION.json` | Complete validated mapping across `C`, `V`, `U`, evidence, video, and submission. | All release identities | `NOT_RUN` |

## Machine-readable index

`.artifacts/release/EVIDENCE_INDEX.json` is generated from this registry, finalized after `E-029`, and published as a release asset. Each entry has:

```json
{
  "id": "E-020",
  "status": "PASS",
  "summaryPath": null,
  "artifactPath": ".artifacts/browser/public-journey.json",
  "artifactSha256": "<sha256>",
  "sourceCommit": "<C>",
  "sitesVersionId": "<V-or-null>",
  "deployedUrl": "<U-or-null>",
  "environment": "<exact>",
  "startedAt": "<UTC>",
  "completedAt": "<UTC>",
  "commandOrProcedure": "<exact command or named manual protocol>",
  "gate": "<frozen expected result>",
  "observed": "<bounded result>",
  "reviewer": "<operator or agent role>",
  "notes": "<redacted notes>"
}
```

Validator rules:

1. IDs are unique and every required ID `E-001` through `E-029` exists. `E-030` is intentionally outside the index to prevent a circular hash.
2. Every `PASS` artifact exists and matches its SHA-256.
3. Live evidence has the same `C`, `V`, and `U` as the release candidate.
4. `FAIL`, `INCONCLUSIVE`, or `NOT_RUN` cannot support a positive submission claim.
5. Conditional `NOT_APPLICABLE` links to its bootstrap probe.
6. Timestamps are canonical UTC and predate submission; the holdout runs once for each candidate `C`.
7. No artifact contains registered secret/identity patterns.
8. `RELEASE_ATTESTATION.json` validates and references the exact final index hash; the index does not contain or hash the attestation itself.

## Claim-to-evidence rule

Submission copy may state only:

- a directly observed fact backed by a `PASS` artifact for the exact release;
- a bounded product-description fact visible in source/UI;
- a clearly labeled hypothesis with its future validation test.

Examples:

- Allowed after `E-022 PASS`: “On our synthetic 36-record v2 benchmark, RRF beat every single eligible ranker by at least 0.05 mean nDCG@3 with zero forbidden results.”
- Not allowed: “RRF is generally superior,” “production-proven retrieval,” or “scientifically proves memory.”
- Allowed after `E-021 ChatGPT PASS`: name the exact tested ChatGPT client/build.
- Not allowed after shim-only automation: “Works in ChatGPT.”
- Allowed after `E-023 PASS`: report the six named manual behaviors and exact environment.
- Not allowed: “WCAG compliant,” “certified accessible,” or compatibility beyond tested scope.

## Artifact publication and retention

- Commit deterministic source-side summaries and non-sensitive prerelease evidence into `C` when they exist before freeze.
- Keep raw CI artifacts downloadable and hash them in the evidence index.
- Publish the post-deploy attestation, evidence index, benchmark release report, client matrix, manual checklist, review summaries, and screenshot manifest as hash-verified release assets, then freeze them through judging.
- Preserve failed and inconclusive reports; never overwrite them with a later pass. New candidate/source creates a new timestamped artifact.
- Retain public evidence, repository, Site, and video through judging. Do not expose cookies, tokens, authenticated headers, personal identity, private conversations, or raw platform logs.
