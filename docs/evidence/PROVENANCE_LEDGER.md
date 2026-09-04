# Provenance Ledger

> Historical note: `E-017` below records the Package 8 pre-publication checkpoint.
> The post-R10 supplement records later public-release facts without rewriting that
> historical disposition.

Evidence ID: `E-017`  
Package 8 local integrity status: **PASS**; overall disposition: **BLOCKED** — source, dependency/license, notices, live security-scan, and AI-use provenance are recorded, while actual Sites edge client isolation remains `NOT_RUN`. Final source commit `C` and its clean-clone proof are terminal session evidence and are not self-recorded; deployed/version identities, media, and submission provenance remain `NOT_RUN`.

| Item | Exact source / version | License or terms | Treatment | Repository evidence |
|---|---|---|---|---|
| OpenAI Sites scaffold | `@openai/create-sites@0.2.0`; npm integrity recorded in `BOOTSTRAP_PROBES.md`; upstream `openai/sites` | MIT package metadata | Generated locally, preserved untouched in first commit, then modified; no unsupported in-place generator upgrade was claimed | Commit `a00d754`, `package.json`, `package-lock.json` |
| Revision-2 authority pack | Read-only planning workspace; 43 files; pack SHA-256 `0777f7cf34de0032a299b38bf630c74be120317a282ce1cd7290a466159c107f` | Project-authored planning material | Byte-for-byte import; source was not modified | `docs/evidence/AUTHORITY_VALIDATION.json` |
| Sealed RRF fixtures | Twelve imported fixture/manifest/evaluator files; eight v2 manifest entries | Project-authored synthetic data and evaluator | Byte-for-byte import; no tuning or product reuse of expected holdout judgments | `docs/retrieval/fixtures/rrf/`, `SHA256SUMS-v2` |
| Product code and tests | Original Packages 0-8 implementation authored in this repository | Apache-2.0 | Human-directed, AI-assisted, reviewed and locally verified | `app/`, `lib/`, `tests/`, `scripts/` |
| Locked dependencies | 724 exact package entries in npm lockfile; direct versions exact-pinned | Each dependency retains its own detected license | Deterministic inventory has no missing, unknown, or prohibited license; known LGPL/MPL/CC-BY/Python obligations remain visible and are not called permissive | `package-lock.json`; `.artifacts/security/package8-dependency-license.json`; `THIRD_PARTY_NOTICES.md` |
| Local Cloudflare test toolchain | Exact stable family in lockfile; patched `undici@7.29.0` override | Each dependency retains its own license | Local-only, `remoteBindings:false`; compatibility proven by D1 test; no alpha Miniflare adopted | `package.json`, `package-lock.json`, `wrangler.package0.jsonc` |
| CI actions | `actions/checkout` commit `3d3c42e5aac5ba805825da76410c181273ba90b1`; `actions/setup-node` commit `820762786026740c76f36085b0efc47a31fe5020` | Respective upstream repositories and licenses | Immutable commit references; read-only token permissions; package-manager cache disabled | `.github/workflows/verify.yml` |
| Browser test binary | Chromium revision selected by exact `@playwright/test@1.62.1`; installed by Playwright into project-local ignored cache | Chromium and bundled component terms | Test-only; not copied into source or production bundle | `package-lock.json`, `npm run setup:browsers` |
| Package 8 security/evidence automation | Original nonce-header proxy, native D1 trigger-coupled admission, direct-edge bootstrap digest, validators, live Gitleaks orchestration, and evidence binding; Gitleaks `8.30.1` official binary | Apache-2.0 project code; Gitleaks MIT | Uses Vinext/Next/D1/Node/Git/npm capabilities; no new runtime or scanner library added; CI verifies the official archive SHA-256 before executing it | `proxy.ts`, `lib/server/admission.ts`, `drizzle/0006_package8_atomic_admission.sql`, `.github/workflows/verify.yml`, `scripts/package8-*.mjs`, `.artifacts/security/release-security.json` |
| Geist fonts | Next.js `next/font` generated scaffold path | Upstream font/package terms | Retained from generated scaffold; no external font fetch added | `app/layout.tsx` |
| Favicon | Generator-provided SVG | Generator/upstream terms | Retained unchanged from scaffold | `public/favicon.svg`, first scaffold commit |
| External documentation | OpenAI Sites/Site tools, WebMCP draft, Cloudflare Workers/D1, Chrome WebMCP | Respective site terms | Facts paraphrased and linked; no documentation copied into product code | `docs/evidence/BOOTSTRAP_PROBES.md` |
| Clivus | No Clivus source, service, database, corpus, prompts, models, identifiers, history, or private data used | Not applicable | Explicit clean-room boundary; only the independently stated evidence-versus-authority idea is present | `START_HERE.md`, `docs/delivery/PROVENANCE_AND_LICENSE.md` |
| AI assistance | Codex/ChatGPT used for official-source research, scaffold inspection, code, tests, documentation, and review; Claude supplied an earlier advisory plan review | Entrant-reviewed original output | No hidden model API in the Site; deterministic app code owns state and authorization; advisory output was not treated as authority | This ledger and Git history |
| Public source custody | `https://github.com/chvignesh07/focus-contract-studio`; initial public commit `61a9249e6ac2727986147a5476307271db4ee9be` | Apache-2.0 detected from root `LICENSE` | Created only after exact-name owner inventory, history privacy rewrite, full local gate, secret scans, and no-hardlinks verification; normal pushes only | `.artifacts/release/public-repository.json` |

## Post-R10 presentation supplement

The screenshots below are first-party captures of the public R10 application.
They were published with the annotated
[`webmcp-challenge-2026-r10`](https://github.com/chvignesh07/focus-contract-studio/releases/tag/webmcp-challenge-2026-r10)
release, visually reviewed for private data, and copied byte-for-byte into this
repository for a self-contained project explanation. They are project-authored
documentation assets covered by the repository's Apache-2.0 license.

| Asset | R10 state shown | SHA-256 |
|---|---|---|
| `docs/media/r10/hero-mismatch.png` | Implemented and browser-observed Delete focus versus D001 Cancel precedent | `c3e1daddf0fe9003c29e8a0762f24ba473a6e17f0cc1930207ba14cd2214b6a9` |
| `docs/media/r10/proposal-not-applied.png` | Agent-authored proposal remains visibly `NOT APPLIED` before review | `6d089fdd35e5dfc1e05a1ff1234ed2200a25b8ac65823703ccf89f456697e0cd` |
| `docs/media/r10/visible-review.png` | Human-only confirmation boundary | `7f5fcc9c1f90f0174d068c2e2ad99f38b57616f86d6d67c5e6e0605a45090d28` |
| `docs/media/r10/verification-pass.png` | Fresh raw browser rehearsal passes all six focus checks | `9915bcef0149f5e1534a21772c34060c529e63c4b85a5712ecb9929ec2842998` |

## R11 visual-system supplement

The R11 interface is original project JSX and CSS. The design pass used the
published shadcn/ui composition model and Magic UI motion examples as research,
but copied no registry component, source file, illustration, icon, video, or
other third-party asset. 21st.dev was used for pattern comparison only. Motion
and RemoCN were evaluated and not added; the existing platform and CSS covered
the live interface. No chart library was added because this workflow has no
honest metric series to visualize.

The four screenshots below were generated by the exact R11 Playwright journey
with synthetic data and reviewed for private data. They are committed in the
annotated `webmcp-challenge-2026-r11` release at
`cc9fd46f92cc51445d9d2b9ee36ff6f3300242e5`; ChatGPT Sites version 11 reports
that same source SHA and is deployed to the public Site.

| Asset | R11 state shown | SHA-256 |
|---|---|---|
| `docs/media/r11/hero-story.png` | Product story, authority map, live revision, observation, precedent, and proposal truth | `e4e20ff577e916edae7dfbe9010967329f27a728012a5803d5175b8dd1ed6f9d` |
| `docs/media/r11/proposal-not-applied.png` | Exact proposal remains visibly `NOT APPLIED` before review | `9a15e4583ad61d2ce81306eff2746a5e25b4b2587fab74151a22dad2fe52a087` |
| `docs/media/r11/visible-review.png` | Visible review confirmation remains the sole authorization boundary | `b75395a1310c01a9533c6b6487207c8eb398373c8825e3a79da78f177cb7dbc7` |
| `docs/media/r11/verification-pass.png` | Six-check browser rehearsal and chronological committed state | `0bca986b30a0b2d615f191d65186a007ddf558691e4a31d825d66df2645e5b50` |

Copyright 2026 Vignesh. Original repository content is licensed under Apache-2.0. This statement does not relicense dependencies, generated third-party material, fonts, trademarks, or external documentation.
