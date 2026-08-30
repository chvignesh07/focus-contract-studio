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
| Abuse/storage exhaustion | Body/event/result limits, proposed per-operation limits, workspace TTL/access expiry, request-driven bounded purge. | Deployed load/limit tests before defaults become confirmed. |
| Secret/license/supply chain | No model key; generated lockfile; exact direct pins; secret/license/vulnerability scans; provenance ledger. | Frozen-commit CI and clean clone. |

## Session and workspace design

### Anonymous baseline

- Cookie name: `__Host-fcs_session`; Secure, HttpOnly, Path=/, no Domain, suitable SameSite after hosted probe.
- Store only a one-way digest of the 256-bit random bearer token; the raw cookie bytes exist only for the request, key the short-lived evidence-token HMAC, and are never persisted/logged. Rotate on reset/sign-in transition and after the configured age.
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

## Browser and WebMCP headers

Start from generated Sites headers. Probe before adding:

- CSP compatible with generated bundles and no unsafe dynamic HTML;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: no-referrer` or strict same-origin equivalent;
- frame policy consistent with top-level ChatGPT browser behavior;
- Chrome `window.originAgentCluster === true`, deployed `Origin-Agent-Cluster`, and `document.featurePolicy.allowsFeature("tools")`.

Chrome defaults `tools` to self for top-level same-origin contexts, but record the actual deployment. Add `Origin-Agent-Cluster: ?1` or `Permissions-Policy: tools=(self)` only if Sites permits and the probe proves compatibility. `?0` blocks Chrome WebMCP.

## Data inventory and retention

| Data | Stored | Lifecycle |
|---|---|---|
| Anonymous token | Browser only | Rotated/expired; only digest in D1. |
| Raw email/full name | No | Request lifetime only when optional sign-in passes. |
| Subject/session digest | Yes | Workspace retention; never reversible without secret. |
| Implemented revisions/proposals/reviews/receipts/audit | Yes | Immutable while retained workspace exists. |
| Rationale/summary | Yes, bounded | Synthetic/demo or reviewer-entered; disclosed as untrusted. |
| Raw observation IDs/events/manifests | Yes, bounded | No text/value; retained with workspace. |
| IP/user-agent | Not stored by app | Platform logs may exist under Sites policies. |
| Sites traffic analytics | Platform-managed | Sites automatically records unique visitors/page views; app adds no SDK. |

Anonymous TTL is **access expiry**, followed by request-driven bounded cleanup: eligible requests purge at most 10 workspaces beyond a documented grace period using explicit whole-workspace cascades. If no requests occur, physical rows may remain until later access/manual cleanup. Do not claim immediate deletion from platform backups.

The current public Sites documentation reviewed for this release does not state a residency guarantee for deployed code, D1, generated artifacts, or logs. The product therefore makes no residency promise and forbids sensitive/regulated data.

## Proposed limits — not confirmed until hosted load tests

Initial candidates:

- JSON body 16 KiB; tool result target 1.5K characters;
- proposal summary 280, rationale 320 stored/120 tool excerpt;
- 64 observation events/30 seconds/session;
- 10 proposals, 10 reviews, 6 applies, 12 verifications, 5 resets per workspace/hour;
- 36 eligible rows, top-12/ranker, top-3 UI/top-2 tool.

Record deployed p95/error/load evidence before labeling these confirmed. Limit failure must preserve active revision and idempotency recovery.

## Disclosure

The live page states: synthetic demo data; no credentials required; do not enter sensitive data; optional sign-in status; stored record categories; reset/access-expiry behavior; Sites-managed analytics; no residency guarantee; public demo limits; contact/repository link. Do not imply OpenAI/Devpost endorsement.
