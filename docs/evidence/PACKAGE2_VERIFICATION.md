# Package 2 Local Verification

<!-- package2-source-binding file_count=229 sha256=98ec0cd8989ab453458300dfa2cecfbd741c1245e9f608bf1b613c865a02288f -->

Status: **LOCAL PACKAGE 2 PASS; HOSTED CHATGPT NOT RUN**

Package 2 implements the smallest complete Revision 2 vertical slice: an anonymous user can inspect the implemented Delete-first revision, rehearse the native Delete Account dialog, see the browser-reported first focus, retrieve the sealed D001 Cancel precedent, and durably create a Cancel-focused proposal that remains visibly `NOT APPLIED` after reload. Retrieval stages evidence only; no Package 2 route or tool approves or applies a configuration. The persisted browser report is explicitly untrusted telemetry, not a verifier receipt, and it cannot authorize any proposal, approval, or application.

This is source-bound local evidence. The verifier binds 229 of 234 tracked repository files with aggregate SHA-256 `98ec0cd8989ab453458300dfa2cecfbd741c1245e9f608bf1b613c865a02288f`. The only exclusions are five exact self-referential evidence files: the manifest itself, the local-gate/browser/security receipts that embed its identity, and this Markdown summary. The Package 2 evidence binder independently checks all four receipts plus this marker. Historical Package 0/1 receipts, evidence structure, authority, fixtures, probes, tests, and every other tracked file remain source-bound. The canonical gate recomputes that closed Git inventory and requires the exact seven-suite inventory and totals; a newly tracked input, omission, addition, changed total, altered status, audit result, remote-binding claim, external-action claim, or hosted claim fails closed. The tracked artifact truthfully marks the containing-commit clean clone as pending because a commit cannot prove its own future clone; the final handoff supplies that independent post-commit evidence.

## Result matrix

| Surface | Result |
|---|---|
| Local TypeScript and ESLint | `PASS` |
| Package 0 regressions | `80/80 PASS` |
| Package 1 Node regressions | `10/10 PASS` |
| Package 1 Workerd/D1 regressions | `59/59 PASS` |
| Package 2 Node regressions | `42/42 PASS` |
| Package 2 Workerd/D1 regressions | `18/18 PASS` |
| Package 2 DOM regressions | `5/5 PASS` |
| Package 2 built-Worker Playwright journeys | `5/5 PASS` |
| Production build | `PASS` |
| Runtime and complete dependency audits | `0` vulnerabilities |
| Reachable-history and working-tree gitleaks scans | `PASS` |
| Supported ChatGPT Site-tools client | `NOT_RUN` |
| Package 0 hosted exit gate | `INCONCLUSIVE` |

All Worker/D1 tests and browser journeys use local disposable databases with remote bindings disabled. No Sites save, deployment, hosted D1 mutation, hosted identity probe, Devpost action, or Package 3 work is represented here.

Canonical gate interval: `2026-08-30T22:20:35Z` through `2026-08-30T22:21:30Z`, exit `0`, using Node `v22.22.3`, npm `10.9.8`, Workerd `1.20260730.1`, and Wrangler `4.116.0`.

## Frozen retrieval and proposal integrity

- The imported sealed RRF fixture materializes exactly 36 records at the recorded byte/hash boundary. Two control records are excluded from the workspace seed; all 34 product records, profiles, supersession edges, and lineage rows are persisted.
- Runtime retrieval accepts only closed behavior/outcome tuples and canonical whole-second UTC timestamps, excludes invalid, hostile, unsupported, quarantined, expired, and actively superseded records before ranking, and reproduces the development golden packet and conflict packet across 100 repeats.
- Read reruns the frozen retrieval using only the resolved server session/workspace and produces no D1 mutation. Its HMAC evidence token is bound to session, workspace, variant, revision, context digest, ordered result digest, and issue second; it is canonical, bounded, expires after five minutes, and fails closed outside the exact 30-second future-skew boundary.
- Create accepts no workspace, role, authority, approval, or apply input. It resolves the current session, reruns retrieval at the token issue second, validates the complete binding, and creates only a `proposed` agent-authored row.
- One guarded D1 batch writes the retrieval query/results, per-field evidence map, proposal, idempotency outcome, and final success audit. Zero-row guards and injected failures leave zero partial rows. Same-key replay recovers the original result; changed-body replay conflicts; concurrent equivalent open proposals cannot duplicate.
- Database finalizers require one to three unique citations, exact top-three result membership, matching record behavior/outcome, exact changed-field evidence, proposal JSON/column parity, and the successful audit as the last link.

## Browser and WebMCP proof

- The browser derives the bounded target set, actual tabbable DOM order, name, description, role, modal flag, and open state from the live dialog at the first `focusin`; it does not submit an expected manifest constant. The server accepts only the exact active renderer contract and configured initial target. A deliberate autofocus mutation reaches the real Reason field, is never repaired by client code, and is rejected with zero observation rows.
- The stored opening report is one immutable, idempotent graph per workspace/variant/implemented revision. Repeat and concurrent reports recover the same session; a database partial-unique index rolls back the losing graph. The API does not accept a caller-selected environment label. This still remains untrusted browser telemetry and is excluded from proposal authority.
- The built Worker runs against a unique disposable local D1 database with both migrations applied. Playwright verifies bootstrap, revision 1, D001/Cancel, native initial focus, the exact rendered tabbable set, configured Tab/Shift+Tab wrap, real background pointer and programmatic-focus blocking, Escape restoration, proposal creation, durable reload, and the unchanged implemented revision.
- Responsive checks cover the page and open-dialog controls at 320 px, 375 px, and 200% layout zoom, plus visible/unobscured focus, reduced motion, and zero serious or critical axe violations. CSS layout zoom is not labeled as browser UI zoom.
- The top-level imperative WebMCP registry exposes exactly `read_active_focus_review` and `create_focus_contract_proposal`. Schemas reject unknown fields, omit client authority/CSRF/session inputs, keep output bounded, unregister cleanly during teardown/HMR, and propagate cancellation.
- A mounted-page test proves bootstrap and read finish before the two registrations, then proves unmount/remount aborts both prior registrations and installs exactly two replacements.
- In browsers without Site tools, the product remains fully usable through the ordinary UI and truthfully says that tools are unavailable; it never fabricates registration success.

## Reproduction

```sh
npm ci
PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright install chromium
npm run verify:package2
gitleaks git --redact --no-banner --log-level error --log-opts=--all .
gitleaks dir --redact --no-banner --log-level error .
```

`verify:package2` runs typecheck, lint, the frozen Package 1 source verifier, every Package 0/1/2 test suite, the production build, the real built-Worker browser journey, both dependency audits, and both Package 1/2 evidence-binding verifiers.

Runtime configuration additionally rejects missing, weak, padded, noncanonical, or reused HMAC material. Each of the session, CSRF, and rate-limit secrets must be a distinct unpadded base64url encoding of exactly 32 random bytes; values are supplied through project-scoped secret storage and are never committed or recorded in evidence.

The Package 2 source manifest rejects symbolic links, invalid UTF-8, NULs, and raw C0/DEL control bytes, keeping every bound source file independently reviewable as text.

## Remaining boundary

The supported ChatGPT Site-tools client has not executed these two tools against an exact saved/deployed source version. Package 0 therefore remains `INCONCLUSIVE`, and this document makes no hosted availability, authentication, storage, or tool-execution claim. Crossing that boundary requires a separately authorized, single-owner ChatGPT desktop Sites lifecycle; it is not part of Package 2 local completion.
