# Focus Contract Studio — Security and Privacy Contract

Status: **RELEASE-BLOCKING v2**

## Security objective

Preserve workspace isolation, exact review/apply integrity, bounded untrusted evidence, recoverable mutations, and minimal data. This is a public demo security contract, not a claim of enterprise or production security certification.

## Threat controls

| Threat | Required control | Proof |
|---|---|---|
| Retrieved prompt injection | Eligibility before rank; quarantined/hostile excluded; rationale text-only; `untrustedContentHint`; retrieval absent from authorization predicates. | Hostile fixtures, DOM/injection tests, dependency review. |
| Model claims approval | No WebMCP/API approval operation; explicit visible UI decision binds proposal/hash/base/session. | Tool/route inventory and forged-text tests. |
| Browser automation mistaken for human | Claim only UI-mediated reviewer intent; no biological-human language. | Copy/schema audit. |
| Stale/forged/partial apply | Conditional guard inside D1 batch; every write gated; finalizer trigger; exact `meta.changes`; canonical hash; unique contender constraints. | Zero-row, revoke-between-read, failure-at-each-statement, and 100-pair concurrency tests. |
| Cross-workspace ID oracle | Server-resolved workspace in every query; foreign/nonexistent same public not-found/status/size/timing budget. | Two-profile enumeration tests. |
| Replay/lost response | Operation-scoped idempotency record and canonical request hash; original receipt recovery. | Same-key same/different input and network fault tests. |
| Forged/stale evidence packet | Read-only route returns a 300-second HMAC token bound to session, workspace, active variant/revision, canonical context, and ordered results; create reruns token-time retrieval and persists evidence only with the proposal. Token is not authorization. | Fixed vectors, tamper/expiry/future-skew/cross-boundary/result-change tests, read-no-write D1 assertion. |
| CSRF/session fixation | Secure host-only cookie, rotation, Origin check, synchronizer token for UI mutations, no state-changing GET, no URL token. | Hosted header/cookie/fixation tests. |
| Auth-header spoof/identity merge | Optional feature only after Sites-hosted overwrite/strip probe; exact validated email bytes HMACed, no lowercase/normalization; raw identity transient. | Signed-out forged-header and repeated sign-in probes. |
| Tool overexposure | Top-level same-origin tools, no `exposedTo`, narrow strict schemas, ≤1.5K result target, exact four-tool inventory. | Real client/Chrome/DevTools audit. |
| Raw-content capture | Observer accepts only stable IDs/enums; no input values/text/clipboard; bounded events/time. | Sensitive-marker E2E and D1/log scan. |
| Abuse/storage exhaustion | Body/event/result limits; atomically consumed per-lineage operation limits that survive reset; bootstrap isolation by a minute-rotating HMAC of direct-edge client metadata; eight-hour access expiry; 24-hour cleanup grace; request-driven purge capped at 10 rows. | Concurrent replay/rollback/saturation tests pass locally. Actual Sites edge client isolation and deployed tuning remain `NOT_RUN` and release-blocking. |
| Secret/license/supply chain | No model key; generated lockfile; exact direct pins; live pinned-version Gitleaks exact-current-tree/reachable-history scans with a planted-negative control; source-bound config and empty ignore policy; dependency/license/bundle scans; notices and provenance ledger. | Package 8 local gate and terminal exact-commit clean clone; hosted release remains separate. |

## Session and workspace design

### Anonymous baseline

- Cookie name: `__Host-fcs_session`; Secure, HttpOnly, Path=/, no Domain, suitable SameSite after hosted probe.
- Store only a one-way digest of the 256-bit random bearer token; the raw cookie bytes exist only for the request, key the short-lived evidence-token HMAC, and are never persisted/logged. Anonymous access expires after eight hours; reset rotates immediately and expiry creates a fresh token/workspace.
- Session resolves exactly one active workspace generation. Workspace IDs never come from client payload.
- A fresh signed-out profile receives a new isolated workspace and full hero flow.

### Optional Sign in with ChatGPT

Current official Sites documentation guarantees server request headers `oai-authenticated-user-email` and optional `oai-authenticated-user-full-name`; it does not document an opaque user ID or email normalization.

- Validate the exact email header syntactically and within 254 bytes.
- Derive `subject_key = HMAC-SHA-256(identity_secret, "sites-email-exact-v1:" + exactHeaderBytes)`.
- Do not lowercase, trim internal bytes, provider-normalize, or use full name for identity.
- Email/full name may be displayed during that response but are never persisted, cached, audited, or logged.
- Hosted probe must show a signed-out caller cannot forge forwarded identity and Sites strips/overwrites caller-supplied versions. `FAIL` or `INCONCLUSIVE` disables optional sign-in with no release loss.

## Request boundary

- HTTPS only in deployment.
- JSON mutations require correct method, `Content-Type: application/json`, bounded body, same Origin, server session, CSRF token for UI route, and strict schema.
- WebMCP execution runs in page session but still uses ordinary server authorization; tool metadata is not authority.
- The evidence token is `v1.<issued-second>.<base64url-MAC>` only, at most 96 characters, never placed in a URL/log/audit row, and never accepted as review/apply authority. Verification rejects expiry beyond 300 seconds, more than 30 seconds future skew, malformed encodings, and cross-session/state/result replay with `crypto.subtle.verify`; manual string comparison is forbidden.
- Set `Cache-Control: no-store` on workspace/session/review/receipt routes.
- Validate UUID/opaque formats before repository access; generic not-found after server workspace predicate.

## Guarded D1 writes

Implement the exact guard/finalizer design in `docs/architecture/ARCHITECTURE.md`. Requirements:

- authorization predicates live in the conditional guard insert, not a prior read;
- all subsequent writes join the guard/created row;
- success audit is inside the batch;
- finalizer trigger aborts incomplete multi-row success;
- every expected affected-row count is asserted;
- zero-row authorization/CAS is a stable failure and no product mutation;
- failure-attempt audit is separate, best-effort, and never a success-like receipt.
- operation admission is consumed by the durable success marker inside that same batch; replay inserts no marker, and any failed batch rolls back the counter, idempotency row, audit, and product graph together.

## Browser and WebMCP headers

Package 8 applies these source-controlled headers through the supported Vinext/Next request proxy:

- a fresh per-request nonce CSP with `default-src 'self'`, `base-uri 'none'`, `object-src 'none'`, `frame-ancestors 'none'`, same-origin form/connect/font, data-only image addition, nonce-rooted scripts (`script-src 'nonce-…' 'strict-dynamic'` with no script `'self'`), and nonced inline styles plus same-origin generated stylesheets (`style-src 'self' 'nonce-…'`);
- `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`;
- `Origin-Agent-Cluster: ?1`;
- `Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=(), tools=(self)`.

The local built-Worker browser tests observe a distinct valid nonce, nonce propagation to framework script and inline-style elements, the expected violation for an injected unnonced same-origin script, no unexpected CSP violation, working built stylesheets/dynamic chunks, `window.originAgentCluster === true`, the exact four tools, and no serious/critical Axe finding. They also exercise the current Package 8 source at 320px, 375px, and a 640 CSS px viewport at DPR 2 for reflow, 44px targets, keyboard focus visibility, native-dialog initial/return focus, and Axe. The DPR profile is responsive emulation, not browser UI zoom; actual browser UI 200% zoom remains founder-manual `NOT_RUN`. This is local source/runtime evidence only. Sites header preservation, actual edge client isolation, supported-ChatGPT behavior, and the conditional real Chrome WebMCP trace remain `NOT_RUN`; the missing edge proof blocks Package 8 from a public-release-safe claim.

## Data inventory and retention

| Data | Stored | Lifecycle |
|---|---|---|
| Anonymous token | Browser only | Rotated/expired; only digest in D1. |
| Raw email/full name | No | Request lifetime only when optional sign-in passes. |
| Subject/session digest | Yes | Workspace retention; never reversible without secret. |
| Bootstrap client digest | Yes, short-lived | Minute-window HMAC of direct-edge client address; no raw address; expires after two minutes and is removed by bounded request-driven cleanup. |
| Implemented revisions/proposals/reviews/receipts/audit | Yes | Immutable while retained workspace exists. |
| Rationale/summary | Yes, bounded | Synthetic/demo or reviewer-entered; disclosed as untrusted. |
| Raw observation IDs/events/manifests | Yes, bounded | No text/value; retained with workspace. |
| IP/user-agent | Not stored by app | Platform logs may exist under Sites policies. |
| Sites traffic analytics | Platform-managed | Sites automatically records unique visitors/page views; app adds no SDK. |

Anonymous TTL is **eight-hour access expiry**, followed by request-driven bounded cleanup after a **24-hour grace period**: eligible requests purge at most 10 workspaces using explicit whole-workspace cascades. If no requests occur, physical rows may remain until later access/manual cleanup. Do not claim immediate deletion from platform backups.

The current public Sites documentation reviewed for this release does not state a residency guarantee for deployed code, D1, generated artifacts, or logs. The product therefore makes no residency promise and forbids sensitive/regulated data.

## Locally enforced limits — hosted tuning not confirmed

Package 8 enforces:

- JSON body 16 KiB; tool result target 1.5K characters;
- proposal summary 280, rationale 320 stored/120 tool excerpt;
- 64 observation events/30 seconds/session;
- 12 variant selections, 10 proposals, 10 reviews, 6 applies, 12 rehearsals, 12 verifications, 6 undos, and 5 resets per anonymous workspace lineage/hour; reset preserves that lineage;
- 32 new-workspace bootstraps/minute per rotating client digest only when both non-HTTP Cloudflare request metadata and `CF-Connecting-IP` are present; `X-Forwarded-For`, `X-Real-IP`, and other caller-controlled headers cannot select or change the bucket; absence or malformed metadata returns `503` before any workspace/product write;
- 36 eligible rows, top-12/ranker, top-3 UI/top-2 tool.

Workspace values are confirmed by local atomic D1 tests across variant selection, initial focus, proposal, review, apply, rehearsal/finalization, verification, undo, and reset, including replay-before-admission, conflicting-payload rejection, downstream rollback, saturation, zero unauthorized product change, and no stale in-progress record. Local direct-edge bootstrap tests prove that one client cannot exhaust another client, spoofed forwarding metadata cannot select a fresh bucket, and rejection writes nothing. Current public Sites documentation does not establish that the deployed boundary supplies the same trustworthy signal. Package 8 is therefore **BLOCKED** until a deployed probe proves that fact or an independently enforced edge control is adopted and evidenced. Record deployed p95/error/load evidence before presenting any threshold as production-tuned capacity.

## Logging and redaction

Application code does not persist raw session/CSRF/evidence tokens, identity headers, reasons, typed values, email/name, IP addresses, or user agents. Errors expose bounded public codes and correlation IDs rather than raw inputs. Package 8 requires Gitleaks `8.30.1` to scan a byte-bound snapshot of every tracked and non-ignored untracked current-tree file plus reachable `--all` history, and rejects a planted secret-shaped fixture. The runner forces and hashes the source-bound `.gitleaks.toml` and intentionally empty Package 8 ignore file, strips environment config overrides, and disables inline allow comments. Its ignored runtime receipt binds version, normalized command/scope, policy hashes, commit/tree, worktree status, current-content digest, exit status, and result counts. The separate source, history, evidence, and production-bundle scanners remain defense in depth. No empty committed Gitleaks report is accepted as proof. Platform logs may still exist under Sites policies, so the page discloses that boundary and makes no platform-retention promise.

## Disclosure

The live page states: synthetic demo data; no credentials required; do not enter sensitive data; optional sign-in status; stored record categories; reset/access-expiry behavior; Sites-managed analytics; no residency guarantee; public demo limits; contact/repository link. Do not imply OpenAI/Devpost endorsement.
