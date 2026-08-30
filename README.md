# Focus Contract Studio

Focus Contract Studio is a WebMCP-native accessibility review product. This repository is currently limited to **Package 0: repository custody, generated-runtime validation, and blocking platform probes**. Product feature implementation begins only after Package 0 passes and the founder authorizes Package 1.

## Package 0 stack

The untouched base was generated with `@openai/create-sites@0.2.0` using the `d1` and `auth` add-ons and npm. That exact 17-file scaffold is preserved in the first commit. The working tree uses Node.js 22+, Vinext, Next.js 16, React 19, Vite 8, the OpenAI Sites Vite plugin, Cloudflare's Vite plugin, Wrangler, D1, and Drizzle. Runtime and local Cloudflare tooling were subsequently patched with exact compatible pins; exact resolved versions are locked in `package-lock.json`, and both original and verified stack facts are recorded in `docs/evidence/BOOTSTRAP_PROBES.md`.

The optional generated auth helper is not product authority. Focus Contract Studio remains anonymous unless the required hosted header anti-spoofing and repeat-sign-in byte-stability probes pass.

## Local setup

Requirements: Node.js 22.13 or newer and npm.

```sh
npm ci
npm run verify:package0
npm run dev
```

`verify:package0` runs typecheck, lint, authority/seal validation, WebMCP lifecycle and cancellation tests, direct fresh-D1 probes, the Cloudflare Workers Vitest compatibility probe with remote bindings disabled, a production build, and dependency audits that reject any runtime finding or any critical/high complete-graph finding. A separate minimal HTTP request is recorded in the bootstrap evidence because it requires a running local Worker.

The project-scoped `.npmrc` works around an npm 10.9.8 peer-placement crash for the Cloudflare Vitest pool. The affected Vitest packages remain exact direct dependencies; the lockfile remains authoritative.

The preserved `0.2.0` scaffold originally used `vinext start`, which executes through Node and cannot resolve the native `cloudflare:workers` binding module once a D1 route exists. The verified start command now matches the current Sites template: it runs the built Worker through Wrangler using `dist/server/wrangler.json`.

The runtime dependency audit is clean. The complete development graph retains four moderate `esbuild` advisories through the generated `drizzle-kit` toolchain; that CLI is not served or invoked by the application. The bounded assessment and future upgrade condition are committed under `.artifacts/security/`.

The temporary hosted D1 probe is fail-closed. Its page checkbox is only a human guard, and caller Origin is only a CSRF layer. Both run and cleanup require a separately supplied operator token whose SHA-256 digest is configured as a hosted secret, verified owner-only access as an external prerequisite, and distinct server-enforced windows capped at 15 minutes. Run and cleanup cannot be enabled together. Cleanup requires the run flag off while owner and operator authorization remain, works from a new browser without a cleanup cookie, and cannot begin until the durable run window plus a five-second drain has elapsed. Atomic gate-plus-schema acquisition rechecks the database clock, preventing both pre-acquisition and post-acquisition delayed runners from recreating schema after zero cleanup. Finalization verifies the exact gate and work-table definitions before removing only the three probe-owned names. Collision, replay, concurrency, lease, forgery, zero-row, cleanup-failure, schema-ownership, and zero-residual protections have local regressions. This is probe safety, not hosted proof.

## Authority and safety

Start with `START_HERE.md`. Revision 2.0 controls. Retrieval can support a proposal but can never approve or authorize a mutation. No Clivus source code or private data is included. Hosted writes, deployment, credentials, publication, public pushes, and Devpost actions require explicit founder approval.

## Evidence

- `docs/evidence/AUTHORITY_VALIDATION.json` — product-repository authority import validation.
- `docs/evidence/BOOTSTRAP_PROBES.md` — truthful Package 0 probe matrix.
- `docs/evidence/PACKAGE0_SECURITY_HARDENING.md` — red/green evidence for the local D1 boundary repair.
- `docs/evidence/PACKAGE0_EXTERNAL_RUNBOOK.md` — four separately approved external checkpoints; its JSON companion is machine-tested.
- `docs/evidence/CLIENT_MATRIX.md` — real-client and conditional-client status.
- `docs/evidence/PROVENANCE_LEDGER.md` — generated inputs, dependencies, assets, and AI-use provenance.
- `docs/evidence/ADVERSARIAL_REVIEW_1.md` — Package 0 finding dispositions and external boundary.

Stage 1 evidence is intentionally split into structural consistency, live checkout verification, and independently reviewed sanitized Sites receipts. A final binding verifier recomputes receipt hashes and binds the saved lineage to the actual checkout; every local result still states that it does not independently prove hosted facts or Stage 1 completion. The exact future single-owner sequence and commands are in the external runbook.

Local success is not a claim that the Site is deployed, public, or callable from ChatGPT. Those claims require their named hosted and real-client `PASS` evidence.

## License

Copyright 2026 Vignesh. Focus Contract Studio's original repository content is licensed under the Apache License, Version 2.0; see `LICENSE`. Dependencies, generated third-party material, external documentation, fonts, and trademarks retain their own terms.
