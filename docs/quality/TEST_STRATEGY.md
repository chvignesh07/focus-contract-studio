# Focus Contract Studio — Test Strategy

Status: **RELEASE-BLOCKING v2**

## Principle

Tests prove observable claims and critical invariants at the layer where they can actually fail. Mocks may isolate pure code; they cannot substitute for D1, hosted Sites, real WebMCP clients, or manual assistive-technology evidence.

## Test layers

| Layer | Environment | Required coverage |
|---|---|---|
| Static | Generated project + CI | strict TypeScript, lint/format, import boundaries, schema snapshots, migration/static SQL checks, license/secret/dependency scans, broken links/authority refs. |
| Pure unit | Vitest | canonicalization/hash vectors, state reducers, field/outcome mapping, tokenizer/BM25, structured/edge ranks, RRF/ties, verifier six rules, public error mapping. |
| DOM/component | Testing Library/user-event | state labels, exact diff, review confirmation, keyboard semantics, live regions, error/recovery, variant/view state. |
| D1 integration | Real Worker-like D1 | migrations, constraints, prepared repositories, guard/finalizer triggers, affected rows, idempotency, isolation, lifecycle purge, audit/receipts, precedent projection. |
| Route/adapter | Same-origin server + D1 | auth/workspace resolution, origin/CSRF/body limits, foreign/nonexistent equality, UI/WebMCP parity, cancellation, output budgets. |
| Browser | Playwright/axe | full fresh anonymous journey, two profiles, reload, stale, lost response, undo/reset, raw observer, planted verifier failures, exposed dialog name/description/modal semantics, blocked background pointer/keyboard interaction, and focused-control bounds/occlusion at desktop, 320 px, 375 px, and 640 CSS px at DPR 2 responsive emulation. Actual browser UI 200% zoom remains a founder-manual release requirement, `NOT_RUN` until completed against the exact deployed version. |
| Hosted | Exact Sites version | D1/cookie/auth/header/public access/version behavior, persistence, two profiles, security headers, latency. |
| Real client/manual | ChatGPT Sol/Terra; conditional Chrome; Safari; VoiceOver | discovery/calls, page-bound state, tool safety, complete human path, manual accessibility, compatibility truth. |

## Critical D1 matrix

Every failure asserts: no new implemented revision, unchanged active pointer, no success receipt, no committed success audit, recoverable stable response.

- missing/rejected/revoked/superseded/stale/already-applied proposal;
- forged proposal body/hash/approval text;
- wrong proposal hash/base/expected/current revision;
- foreign and nonexistent IDs with indistinguishable public response;
- revoke between diagnostic read and critical batch;
- active revision change between diagnostic read and critical batch;
- conditional guard `changes=0` while D1 reports statement success;
- injected error at every batch statement and finalizer validation;
- required downstream statement forced to zero rows;
- same key+same input replay; same key+different input conflict;
- lost response before/after commit;
- 100 paired concurrent same-base attempts on real D1: exactly one revision/receipt;
- proposal, review, undo, reset use corresponding idempotency/guard contracts;
- successful verification projects precedent exactly once; fail/not-reviewed does not.

## Memory counterfactual

Reset identical revision-1 state and canonical Cancel proposal:

1. **On:** eligible D001 cited → proposal created `NOT APPLIED`; revision unchanged.
2. **Off:** same payload/query with no eligible record → `EVIDENCE_REQUIRED_FOR_AGENT_CHANGE`; revision unchanged.
3. Foreign, superseded, rejected, quarantined, expired, wildcard-family-only, and conflict cases cannot satisfy field support.
4. A reviewer-authored novel-proposal UI path may proceed with an explicit no-precedent warning, proving retrieval is not general authority.
5. Approval/apply still fail until an exact UI review exists in both conditions.

Real-client paired evaluation freezes source/deployment, model (`GPT-5.6 Sol` or `Terra`), client version, prompt, state, trial count, expected changed field/abstention, and raw tool traces before trials. Report model behavior separately from deterministic product behavior.

## Retrieval v2

Before product code, `reference-evaluator-v2.mjs` and `SHA256SUMS-v2` must pass. Product implementation:

- uses only v2 dev cases for debugging;
- matches development golden ranks/metrics exactly;
- never imports reference evaluator/holdout/expected objects;
- validates materialization, schemas, neutral query text, eligibility categories, pure TS BM25 formula, ties/empty, structured/edge ranks, support, conflict/abstain, hostile content, and 100-repeat determinism;
- runs one public-deployment holdout only after source commit `C` is frozen;
- satisfies every gate in `RRF_BENCHMARK.md` without threshold changes.

## WebMCP tests

- exactly four top-level registrations; no iframe/declarative dependency;
- strict Draft-07 schemas and unknown-key rejection;
- descriptions/parameter names/result sizes within budgets;
- annotations accurate but never used by server authorization;
- `read_active_focus_review` never bootstraps/refreshes/cleans up and creates no D1 session/workspace/query/result/audit row; absent session fails closed; token is no longer than 96 characters with exact issue/expiry timestamps;
- fixed HMAC vectors plus bit-tamper, bad-version, malformed-base64url, expired, future-skew, rotated-session, cross-session, cross-workspace, changed-revision, changed-context, changed-result, and wrong-citation rejection;
- proposal creation reruns retrieval at the token issue second, persists one accepted query/result/support snapshot in the same guarded batch as the proposal, and commits nothing on every rejection or injected statement failure;
- registry abort on teardown/HMR; call abort propagates to fetch;
- same-origin only; no `exposedTo`;
- create never applies; apply cannot review; verify cannot mutate config;
- unsupported surface leaves complete human UI;
- real ChatGPT records read/propose/apply/verify; Chrome records `PASS`, `FAIL`, or `INCONCLUSIVE` after origin/policy probes, with narrower observations in notes only.

## Security/privacy tests

- hosted cookie attributes, CSRF, Origin, no state-changing GET;
- auth-header forge/overwrite/stability; optional feature disabled if inconclusive;
- XSS/HTML/script strings remain text and never reach eligible results;
- no raw email/name/session/CSRF/typed marker in D1, logs, errors, URLs, tool results;
- no raw session key, context digest, result digest, workspace ID, or record ID appears inside the opaque evidence token; token verification uses constant-time Web Crypto and a domain-separated message;
- CSP/header/origin-agent-cluster/tools-policy probes;
- request-driven cleanup deletes only expired targeted workspaces and caps 10/request;
- proposed limits/load fail safely; document actual validated limits;
- dependency, secret, license, public-repo, and source-map checks.

## Quality thresholds

- 100% branch coverage for canonicalization, proposal evidence support, state reducers, guarded-result interpretation, RRF/reference parity, and verifier.
- ≥90% line and ≥85% branch for remaining first-party domain/server code; UI measured separately and cannot replace E2E/manual gates.
- Zero flaky retries in release CI. A flaky test is failing until root cause is fixed.
- Zero critical/high security findings and zero critical/serious axe findings; medium findings require documented resolution or explicit release block.

## Release acceptance

1. Fresh clone with documented runtime runs install/typecheck/test/build/scan.
2. Fresh D1 migration and seeded hero pass.
3. Exact source commit `C` CI passes.
4. Saved Sites version built from `C`; owner deploy checks; founder-approved public access; same version public deploy succeeds.
5. Fresh signed-out and two-profile hosted flows pass.
6. One-time v2 holdout, real ChatGPT, conditional Chrome, founder manual VoiceOver, and internal cold evaluation pass/are truthfully reported.
7. Adversarial review 1 before freeze and review 2 against deployed `C` have no unresolved P0/P1.
8. Release attestation, public repo/license, video, links, screenshots, and Devpost fields identify the same `C`/Sites version.

The exact-release browser and founder-manual artifacts must separately disposition dialog semantics/background inertness and unobscured focused controls in all four required viewport/zoom conditions. The cold evaluation must answer all five `UX_SPEC` questions, including that verification proves a new raw rehearsal matches the named implemented revision rather than proving approval or general conformance.

Any interrupted check is `INCONCLUSIVE`, never inferred pass.
