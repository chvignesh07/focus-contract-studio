# Focus Contract Studio

Focus Contract Studio is a WebMCP-native accessibility review product. Package 0 established repository custody and local platform probes; its mandatory hosted supported-client observation remains unresolved. On 2026-08-30, the founder authorized public source publication and local Package 1/2 implementation while keeping that hosted row as an explicit release blocker. This decision does not relabel Package 0 as passed and does not authorize Sites deployment or hosted mutation.

## Package 0 stack

The untouched base was generated with `@openai/create-sites@0.2.0` using the `d1` and `auth` add-ons and npm. That exact 17-file scaffold is preserved in the first commit. The working tree uses Node.js 22+, Vinext, Next.js 16, React 19, Vite 8, the OpenAI Sites Vite plugin, Cloudflare's Vite plugin, Wrangler, D1, and Drizzle. Runtime and local Cloudflare tooling were subsequently patched with exact compatible pins; exact resolved versions are locked in `package-lock.json`, and both original and verified stack facts are recorded in `docs/evidence/BOOTSTRAP_PROBES.md`.

The optional generated auth helper is not product authority. Focus Contract Studio remains anonymous unless the required hosted header anti-spoofing and repeat-sign-in byte-stability probes pass.

## Local setup

Requirements: Node.js 22.13 or newer and npm.

```sh
npm ci
npm run verify:package0
npm run verify:package1
npm run dev
```

`verify:package0` runs typecheck, lint, authority/seal validation, WebMCP lifecycle and cancellation tests, direct fresh-D1 probes, the Cloudflare Workers Vitest compatibility probe with remote bindings disabled, a production build, and dependency audits that reject any runtime finding or any critical/high complete-graph finding. A separate minimal HTTP request is recorded in the bootstrap evidence because it requires a running local Worker.

The Package 0 gate also scans the tracked tree and every reachable Git commit for machine-specific home and temporary-directory prefixes. Publishable evidence uses stable placeholders, so public source history does not disclose the development machine's local filesystem layout.

## Package 1 local data plane

Package 1 adds the complete additive Revision 2 D1 schema and a fail-closed anonymous workspace boundary. A signed `__Host-fcs_session` cookie carries a random 256-bit bearer token; D1 stores only domain-separated digests. Reload resolves the same server-owned workspace, while reset rotates the token and creates one isolated deterministic generation with recoverable idempotency. The seed contains exactly two Delete Account variants, implemented revision 1 focusing Delete, and synthetic precedent D001 recommending Cancel. D1 triggers enforce append-only evidence rows, monotonic revision/view pointers, and the proposal, observation, and idempotency transition vocabularies.

The session routes require project-scoped `FCS_SESSION_HMAC_SECRET`, `FCS_CSRF_HMAC_SECRET`, and `FCS_RATE_LIMIT_HMAC_SECRET` secrets plus `FCS_PUBLIC_ORIGIN`; values must never be committed. New workspace creation and new reset mutations each pass an atomic server-global D1 fuse capped at 32 admissions per 60-second window. Reload and lost-response reset replay do not consume new-mutation capacity. This caller-independent fuse bounds anonymous storage pressure without pretending that Origin or an identity header authenticates an operator; its deployment thresholds remain provisional until the separately gated hosted load tests run.

`npm run verify:package1` runs the unchanged Package 0 gate plus Package 1 migration/upgrade, `STRICT` constraint, foreign-key, state-machine, query-plan, streaming body-limit, admission-concurrency, cookie, CSRF/origin, route, two-session isolation, reset/replay, bounded cleanup, privacy, typecheck, lint, production-build, and dependency-security checks. All Worker/D1 tests run with remote bindings disabled. The proposal/retrieval cycle follows D1's documented transaction requirement by placing `PRAGMA defer_foreign_keys = on` inside the atomic batch. Package 1 local success does not resolve Package 0's hosted supported-client row and does not prove a deployed Site.

The project-scoped `.npmrc` works around an npm 10.9.8 peer-placement crash for the Cloudflare Vitest pool. The affected Vitest packages remain exact direct dependencies; the lockfile remains authoritative.

The preserved `0.2.0` scaffold originally used `vinext start`, which executes through Node and cannot resolve the native `cloudflare:workers` binding module once a D1 route exists. The verified start command now matches the current Sites template: it runs the built Worker through Wrangler using `dist/server/wrangler.json`.

Reviewed numbered SQL is the sole migration authority. The weaker Drizzle generator path is fail-closed, its CLI dependency has been removed, and both the runtime and complete locked dependency graphs currently audit at zero known vulnerabilities. The historical Package 0 audit artifact remains preserved as evidence of that earlier candidate rather than being rewritten.

The temporary hosted D1 probe is fail-closed. Its page checkbox is only a human guard, and caller Origin is only a CSRF layer. Both run and cleanup require a separately supplied operator token whose SHA-256 digest is configured as a hosted secret, verified owner-only access as an external prerequisite, and distinct server-enforced windows capped at 15 minutes. Run and cleanup cannot be enabled together. Cleanup requires the run flag off while owner and operator authorization remain, works from a new browser without a cleanup cookie, and cannot begin until the durable run window plus a five-second drain has elapsed. Atomic gate-plus-schema acquisition rechecks the database clock, preventing both pre-acquisition and post-acquisition delayed runners from recreating schema after zero cleanup. Finalization verifies the exact gate and work-table definitions before removing only the three probe-owned names. Collision, replay, concurrency, lease, forgery, zero-row, cleanup-failure, schema-ownership, and zero-residual protections have local regressions. This is probe safety, not hosted proof.

## Authority and safety

Start with `START_HERE.md`. Revision 2.0 controls. Retrieval can support a proposal but can never approve or authorize a mutation. No Clivus source code or private data is included. Hosted writes, deployment, credentials, publication, public pushes, and Devpost actions require explicit founder approval.

## Public source

The source repository is publicly and anonymously cloneable at [github.com/chvignesh07/focus-contract-studio](https://github.com/chvignesh07/focus-contract-studio). GitHub's authoritative license endpoint detects the root license as Apache-2.0. The sanitized initial-publication receipt is `.artifacts/release/public-repository.json`; it proves source custody and anonymous access only, never a Sites save or deployment.

## Evidence

- `docs/evidence/AUTHORITY_VALIDATION.json` — product-repository authority import validation.
- `docs/evidence/BOOTSTRAP_PROBES.md` — truthful Package 0 probe matrix.
- `docs/evidence/PACKAGE0_SECURITY_HARDENING.md` — red/green evidence for the local D1 boundary repair.
- `docs/evidence/PACKAGE0_EXTERNAL_RUNBOOK.md` — four separately approved external checkpoints; its JSON companion is machine-tested.
- `docs/evidence/CLIENT_MATRIX.md` — real-client and conditional-client status.
- `docs/evidence/PROVENANCE_LEDGER.md` — generated inputs, dependencies, assets, and AI-use provenance.
- `docs/evidence/ADVERSARIAL_REVIEW_1.md` — Package 0 finding dispositions and external boundary.
- `docs/evidence/FOUNDER_EXECUTION_DECISION_2026-08-30.md` — scoped authorization to publish source and implement Packages 1/2 locally while preserving the unresolved hosted release blocker.
- `.artifacts/release/public-repository.json` — sanitized public visibility, license, anonymous-access, and exact-SHA observations.
- `docs/evidence/PACKAGE1_VERIFICATION.md` — Package 1 local exit-gate methods, results, and hosted limitations.
- `.artifacts/test/package1-local-gate.json` — machine-readable local D1/session/isolation result summary.
- `.artifacts/security/package1-security.json` — anonymous-boundary and privacy control summary.

Stage 1 evidence is intentionally split into structural consistency, live checkout verification, and independently reviewed sanitized Sites receipts. A final binding verifier recomputes receipt hashes and binds the saved lineage to the actual checkout; every local result still states that it does not independently prove hosted facts or Stage 1 completion. The exact future single-owner sequence and commands are in the external runbook.

Local success is not a claim that the Site is deployed, public, or callable from ChatGPT. Those claims require their named hosted and real-client `PASS` evidence.

## License

Copyright 2026 Vignesh. Focus Contract Studio's original repository content is licensed under the Apache License, Version 2.0; see `LICENSE`. Dependencies, generated third-party material, external documentation, fonts, and trademarks retain their own terms.
