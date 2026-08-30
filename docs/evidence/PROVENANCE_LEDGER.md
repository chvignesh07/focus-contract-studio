# Provenance Ledger

Evidence ID: `E-017`  
Release status: **NOT_RUN** — Package 0 provenance is recorded; the final dependency/license/media inventory belongs to the release gate.

| Item | Exact source / version | License or terms | Treatment | Repository evidence |
|---|---|---|---|---|
| OpenAI Sites scaffold | `@openai/create-sites@0.2.0`; npm integrity recorded in `BOOTSTRAP_PROBES.md`; upstream `openai/sites` | MIT package metadata | Generated locally, preserved untouched in first commit, then modified; no unsupported in-place generator upgrade was claimed | Commit `a00d754`, `package.json`, `package-lock.json` |
| Revision-2 authority pack | Read-only planning workspace; 43 files; pack SHA-256 `0777f7cf34de0032a299b38bf630c74be120317a282ce1cd7290a466159c107f` | Project-authored planning material | Byte-for-byte import; source was not modified | `docs/evidence/AUTHORITY_VALIDATION.json` |
| Sealed RRF fixtures | Twelve imported fixture/manifest/evaluator files; eight v2 manifest entries | Project-authored synthetic data and evaluator | Byte-for-byte import; no tuning or product reuse of expected holdout judgments | `docs/retrieval/fixtures/rrf/`, `SHA256SUMS-v2` |
| Product code and tests | Original Package 0 implementation authored in this repository | Apache-2.0 | Human-directed, AI-assisted, reviewed and tested | `app/package0-site-tool-probe.tsx`, `probes/`, `tests/package0/` |
| Runtime dependencies | Exact versions in npm lockfile; patched Next `16.3.3` and React/RSC `19.2.8` | Each dependency retains its own license | Used as dependencies; not relicensed by this repository; runtime audit has zero findings | `package-lock.json`; `.artifacts/security/package0-npm-audit-summary.json`; `.artifacts/security/package0-license-summary.json`; final inventory remains `NOT_RUN` until release security gate |
| Local Cloudflare test toolchain | Exact stable family in lockfile; patched `undici@7.29.0` override | Each dependency retains its own license | Local-only, `remoteBindings:false`; compatibility proven by D1 test; no alpha Miniflare adopted | `package.json`, `package-lock.json`, `wrangler.package0.jsonc` |
| Geist fonts | Next.js `next/font` generated scaffold path | Upstream font/package terms | Retained from generated scaffold; no external font fetch added | `app/layout.tsx` |
| Favicon | Generator-provided SVG | Generator/upstream terms | Retained unchanged from scaffold | `public/favicon.svg`, first scaffold commit |
| External documentation | OpenAI Sites/Site tools, WebMCP draft, Cloudflare Workers/D1, Chrome WebMCP | Respective site terms | Facts paraphrased and linked; no documentation copied into product code | `docs/evidence/BOOTSTRAP_PROBES.md` |
| Clivus | No source, service, database, corpus, prompts, models, identifiers, history, or private data used | Not applicable | Explicit clean-room boundary; only the independently stated evidence-versus-authority idea is present | `START_HERE.md`, `docs/delivery/PROVENANCE_AND_LICENSE.md` |
| AI assistance | Codex/ChatGPT used for official-source research, scaffold inspection, code, tests, documentation, and review | Entrant-reviewed original output | No hidden model API in the Site; deterministic app code owns state and authorization | This ledger and Git history |

Copyright 2026 Vignesh. Original repository content is licensed under Apache-2.0. This statement does not relicense dependencies, generated third-party material, fonts, trademarks, or external documentation.
