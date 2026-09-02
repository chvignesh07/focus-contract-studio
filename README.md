# Focus Contract Studio

Focus Contract Studio turns an accessibility focus review into a governed, reversible change. Retrieval may support a proposal; it can never approve or authorize one. The user reviews the exact diff in the visible page, applies it through guarded D1 state transitions, rehearses the result in the browser, verifies six focus behaviors, and can undo it.

The repaired Package 8 local integrity gate passes, but Package 8 is **BLOCKED** as a public-release checkpoint: current Sites documentation does not prove that the deployed request boundary supplies a trustworthy, unspoofable per-client isolation signal. That hosted edge check is `NOT_RUN`. Package 0 remains **INCONCLUSIVE** overall because its mandatory hosted supported-ChatGPT observation is also `NOT_RUN`. This repository does not claim a deployed Site, public URL, supported-client compatibility, Chrome trace, holdout result, founder-manual accessibility result, publication, or Devpost submission.

## 60-second judge path

1. Read the current Delete-versus-Cancel focus mismatch and its cited synthetic precedent.
2. Create a proposal. The preview remains visibly `NOT APPLIED`.
3. Open the review panel and choose an explicit UI decision.
4. Apply the approved exact diff. The model-facing create tool cannot approve or apply it.
5. Run the dialog rehearsal and verification; inspect the six behavior results.
6. Undo to the prior revision or reset the isolated anonymous demo.

The human workflow remains complete when WebMCP is unavailable.

## Supported local setup

Requirements: exact Node.js `22.22.3`, npm `10.9.8`, Git, Gitleaks `8.30.1`, and the platform prerequisites installed by Playwright.

```sh
npm ci
npm run setup:browsers
npm run verify
```

`setup:browsers` installs the pinned Chromium build into the ignored project-local `.playwright-browsers/` directory. The canonical `verify` command checks the frozen Package 7 commit, typecheck, lint, Package 8 Node/D1/seed tests, a clean numbered-migration database, the deterministic development benchmark, production build, the real built-Worker browser journey, accessibility automation, offline dependency audit, dependency/license inventory, live pinned-version Gitleaks scans of an exact tracked-plus-nonignored current-tree snapshot and reachable history with a planted-negative control, bundle scan, local links, pinned CI, release inputs, source binding, and evidence binding. It fails closed if Gitleaks is missing or not exactly `8.30.1`, if config/ignore policy can be overridden, or if the scan receipt is stale for current file content.

Useful narrow commands:

```sh
npm run verify:package8:clean-d1
npm run test:package8:seed
npm run verify:package8:benchmark
npm run test:package8:browser
npm run verify:package8:release
npm run build
```

For local interactive development, provide `FCS_PUBLIC_ORIGIN` plus distinct project-scoped `FCS_SESSION_HMAC_SECRET`, `FCS_CSRF_HMAC_SECRET`, and `FCS_RATE_LIMIT_HMAC_SECRET` values. Each secret is the unpadded base64url encoding of exactly 32 random bytes. Never commit these values. Then run `npm run dev`.

## Architecture and trust boundaries

| Layer | Responsibility | Cannot authorize |
|---|---|---|
| React/Vinext page | Visible review, approval controls, rehearsal, history, undo/reset, privacy disclosure | Model text alone |
| WebMCP adapter | Exactly four narrow imperative tools using the same application operations as the UI | Review, rehearsal capture, undo, reset, workspace selection |
| Server operations | Session/workspace resolution, strict validation, replay recovery, bounded admission | Caller-supplied identity or workspace |
| D1 | Isolation, guarded atomic batches, constraints/triggers, receipts, append-only evidence | Retrieval relevance by itself |
| Retrieval/verifier | Deterministic RRF evidence and independent focus-event checks | Approval or mutation permission |

The anonymous bearer stays in a secure host-only cookie; D1 stores only its one-way digest. The workspace ID is server-resolved. Idempotency recovery occurs before a read-only admission preflight; the operation quota is consumed by the durable success marker inside the same D1 batch as the product mutation. A lost-response replay consumes no additional unit, a conflicting payload fails closed, and a failed batch rolls back product state, idempotency, audit, and admission together.

## Exact WebMCP surface

The page registers exactly:

- `read_active_focus_review`
- `create_focus_contract_proposal`
- `apply_approved_focus_contract`
- `verify_focus_contract`

Create never applies, apply never approves, retrieval never authorizes, and all tool output is bounded. A supported ChatGPT-client run and conditional Chrome trace remain `NOT_RUN`; the local shim/browser tests are not substitutes for those external results.

## Security and privacy

Every dynamic response receives a per-request nonce CSP with nonce-rooted `script-src 'nonce-…' 'strict-dynamic'`, no script `'self'`, and `style-src 'self' 'nonce-…'` for nonced inline framework styles plus same-origin built stylesheets. The policy contains no wildcard, `unsafe-inline`, or `unsafe-eval`. Responses also set `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Origin-Agent-Cluster: ?1`, and a same-origin `tools=(self)` Permissions Policy while disabling camera, geolocation, microphone, and payment. The built-Worker browser test injects an unnonced same-origin script and proves it is blocked while built scripts, dynamic chunks, styles, the exact four WebMCP tools, responsive states, keyboard focus, and Axe checks continue to work.

Anonymous access expires after eight hours. Reset rotates the session while preserving its anonymous admission lineage. Request-driven cleanup removes at most ten expired workspaces after a 24-hour grace period; no immediate backup deletion is claimed. Per anonymous workspace lineage/hour the locally enforced limits are 10 proposals, 10 reviews, 6 applies, 12 rehearsals, 12 verifications, 6 undos, and 5 resets. A new-workspace bootstrap is locally limited to 32 requests per minute per rotating HMAC client digest derived only when Cloudflare runtime metadata and `CF-Connecting-IP` are both present; caller-controlled forwarding headers are ignored, no raw address is stored, and absence fails closed. Whether Sites preserves that trusted boundary is unverified and release-blocking.

Use synthetic demo data only. Do not enter credentials or sensitive, regulated, customer, employee, or production information. The app stores bounded proposals, reviews, revisions, receipts, audits, and allowlisted focus-event evidence; it does not store raw session tokens, typed values, reasons, email/name identity headers, IP addresses, or user agents. The platform may retain its own logs and analytics under its policies. No data-residency or production-security certification is claimed. See [Security and Privacy](docs/quality/SECURITY_AND_PRIVACY.md).

## Accessibility

The product uses a visible UI approval path, native/dialog semantics, deterministic focus return, keyboard-operable controls, responsive layouts, reduced-motion handling, and a complete no-WebMCP fallback. Local automation exercises keyboard behavior and rejects serious/critical axe findings on the built Worker. Founder-manual assistive-technology evaluation and any WCAG-conformance claim remain `NOT_RUN`/unmade.

## Benchmark truth

The 36 precedent records and queries are synthetic. RRF development benchmark v2 is sealed and rerun deterministically; its 12/12 development dispositions are not a holdout result and do not establish general superiority. Benchmark v1 remains preserved and labeled invalid. The one-time release holdout is explicitly outside Package 8 and remains `NOT_RUN`.

## CI, evidence, and release boundary

[The verify workflow](.github/workflows/verify.yml) uses read-only permissions, exact commit-pinned checkout/setup actions, Ubuntu 24.04, Node `22.22.3`, a checksum-pinned Gitleaks `8.30.1` binary, locked installation, explicit project-local browser setup, and the canonical verification command. Cache reuse is disabled as a correctness dependency.

[Build inputs](release/BUILD_INPUTS.json) contain only authorized pre-deploy inputs: exact toolchain, commands, lockfile hash, authority revision, and fixture-manifest hash. They deliberately contain no source commit, self-hash, Sites identifiers, deployed URL, video, Devpost, or post-deploy fact. Deployment, tag/push, publication, hosted mutation, and submission follow the separately approval-gated [deployment runbook](docs/delivery/DEPLOYMENT_AND_OPERATIONS.md); none occurred in Package 8.

Primary local evidence:

- [Package 8 checkpoint](docs/evidence/PACKAGE8_CHECKPOINT.md)
- [Package 8 implementation reviews](docs/evidence/PACKAGE8_REVIEWS.md), distinct from unstarted `E-018` Review 1
- [Execution state](docs/evidence/EXECUTION_STATE.md) and [evidence registry](docs/delivery/EVIDENCE_REGISTRY.md)
- [Provenance ledger](docs/evidence/PROVENANCE_LEDGER.md), [third-party notices](THIRD_PARTY_NOTICES.md), and deterministic dependency/license inventory
- Machine-readable local gate, source manifest, clean-D1 result, and security scan summaries under `.artifacts/`

## Provenance and AI use

This is a new isolated project. No Clivus source, service, database, corpus, prompt, model, identifier, history, or private data is included. The RRF formula is a clean-room implementation of the cited 2009 method over original synthetic fixtures. Codex/ChatGPT assisted official-source research, implementation, tests, documentation, and review; Claude provided an earlier advisory plan review. The entrant directed and reviewed the work. The Site calls no hidden model API: deterministic application code owns persistence, ranking, authorization, application, and verification.

Original repository content is licensed under Apache License 2.0; see [LICENSE](LICENSE). Dependencies and generated material retain their own terms. [Third-party notices](THIRD_PARTY_NOTICES.md) record every locked package and explicitly surface reviewed LGPL, MPL, CC-BY, and Python-license obligations.
