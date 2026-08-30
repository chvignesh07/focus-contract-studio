# Focus Contract Studio — Authority Validation

Status: **PASS — DOCUMENTATION AUTHORITY ONLY**  
Validated: **2026-08-29T18:08:41Z**  
Authority revision: **2.0**

## Meaning of this result

The planning pack is coherent enough to begin Package 0. This is not product, deployment, client, accessibility, security, or submission evidence. All generated-runtime and hosted facts named in `TECHNOLOGY_SELECTION.md` remain release-blocking probes; every later code/configuration change reruns the relevant validator.

## Current primary-source refresh

Verified live on 2026-08-29:

- **[Empirical]** The [official Devpost rules](https://webmcp.devpost.com/rules) list the September 3, 2026 1:00 p.m. PT deadline; an accessible working live URL; complete public licensed repository; public YouTube demo under three minutes with audio; and four equally weighted criteria in tie-break order.
- **[Empirical]** The [August 28 organizer update](https://webmcp.devpost.com/updates/46116-6-days-left-to-build) says to show the working product in the first 10–15 seconds and freezes description, video, repository, and live Site at the deadline.
- **[Empirical]** Current [ChatGPT Sites documentation](https://learn.chatgpt.com/docs/sites) says every deployed URL is production, save and deploy are separate, local versions are associated with the build Git commit, D1 is the durable structured-data choice, Sites supplies exact authenticated email/full-name headers for optional sign-in, and Sites records pageview/unique-visitor analytics.
- **[Empirical]** Current [ChatGPT Site-tools documentation](https://learn.chatgpt.com/docs/webmcp) requires feature-detected imperative `document.modelContext.registerTool`, ordinary authorization/validation, and a complete non-WebMCP interface; supported Site-tools models are GPT-5.6 Sol/Terra, with availability restrictions disclosed in the technology probe.
- **[Empirical]** Current [Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp) requires origin isolation and the `tools` Permissions Policy, which defaults to `self`; `Origin-Agent-Cluster: ?0` disables the API.
- **[Empirical]** Current [D1 database documentation](https://developers.cloudflare.com/d1/worker-api/d1-database/) says `batch()` is transactional and a statement error rolls back the sequence, while result metadata can legitimately report `success:true` with `changes:0`. The guarded-write design therefore checks every affected-row count and forces incomplete work to raise inside the batch.

## Resolved contradictions

| Finding | Permanent resolution |
|---|---|
| Renderer both obeyed and violated one “desired contract.” | Active revision is implemented configuration. Revision 1 renders Delete; separate D001 precedent says Cancel; UI reports `DECISION MISMATCH`. |
| Retrieval value was asserted but did not causally affect product behavior. | Agent-authored changed fields require matching eligible cited outcomes. Same change passes with D001 and fails without it; review/apply remain separate. |
| A tool annotated read-only was described as persisting retrieval rows. | The read now makes no product-state write and returns a five-minute HMAC evidence token. Proposal creation reruns token-time retrieval and atomically persists the accepted evidence snapshot with the proposal. |
| Benchmark v1 required impossible lift over a perfect baseline. | V1 remains immutable and invalid. Mechanically feasible v2 was calibrated and sealed before product retrieval code. |
| FTS5 could let ineligible rows affect BM25 collection statistics. | One indexed eligibility query caps the set at 36; frozen TypeScript BM25 scores only eligible rows. No production FTS table. |
| D1 batch success was treated as proof every conditional write occurred. | Every write is guarded, every `meta.changes` is asserted, and an application finalizer trigger aborts incomplete multi-row success. |
| Foreign IDs had a distinguishable scope error. | Foreign and nonexistent opaque IDs share the same public not-found envelope/status/size/timing budget. |
| Auth assumed an opaque identifier or normalized email. | Anonymous is baseline. Optional continuity uses exact validated authenticated-email header bytes under HMAC only after hosted spoof/stability probes; raw identity is not persisted. |
| Saved Site version was treated like an isolated preview environment. | Every deployment is production; saved version is a build candidate only; D1 isolation is never assumed and migrations are additive. |
| One committed manifest tried to contain post-deploy/video/submission facts. | Source commit `C` contains only `release/BUILD_INPUTS.json`; a separate post-deploy attestation maps `C`, Sites version/URL, evidence, video, and submission. |
| Chrome and biological-human claims exceeded available proof. | ChatGPT real-client proof is mandatory; Chrome is conditional; authority is described as UI-mediated reviewer intent, never biological attestation. |

## Mechanical validation

| Check | Result |
|---|---|
| JSON syntax | 10/10 JSON files parsed. |
| Mandatory intake paths | 26/26 unique `START_HERE.md` paths exist. |
| Markdown local links | 0 broken local links across 37 Markdown files. |
| Markdown structure | 28 controlling Markdown files each have one H1, balanced fenced blocks, and no control characters. |
| Checklist heading references | Every `file > heading` reference resolves to an existing exact heading. |
| WebMCP read/proposal boundary | Read annotation, zero-write semantics, token input, server-only persisted query ID, and atomic evidence+proposal contract are consistent. |
| V2 file integrity | All 8 entries in `SHA256SUMS-v2` pass. |
| V2 schema/count/query checks | Effective corpus 36; development 12; procedural holdout 18; schemas and deterministic neutral queries pass. |
| V2 reference determinism | 100 repetitions byte-identical. |
| V2 pre-seal outcome | `overall: PASS`; 12/12 development and 18/18 holdout dispositions; zero forbidden appearances. |
| V2 holdout feasibility | RRF mean nDCG@3 `0.975817`; strongest single `0.903270`; lift `0.072547`; MRR@3 `0.958333`; Recall@3 `1.000000`. |
| Stale controlling vocabulary | No live use of the old mismatch label, FTS5 production rank, self-referential release manifest, invented five-point scale, normalized-email identity, or storage-isolated saved preview. |

## Frozen v2 integrity hashes

```text
rrf-corpus-v1.json                5f0ca4d31b80b5cb270a1ddd14e2a6f98596a516acf84634e27ba522a179eaa3
rrf-corpus-overrides-v2.json      783fdd1507de009707e6a7f6fb5cd01412896bb21f55682f7dfcb8ef160ce9cb
rrf-dev-queries-v2.json           1bb9c02a4b5c9c20fa34e53ff85de86ea41c0425e35335cb295bdf182575298d
rrf-holdout-queries-v2.json       ff3d45dbf976582a23a7354ae84ffb67b83ea4029b2fa20cb2dc506c762629f0
rrf-corpus-schema-v2.json         546d4ea2524cd04c4ff3520eb01d7091d25ecaa2bd60401f5c7232ac8ec56802
rrf-query-suite-schema-v2.json    d2db025ee29fd28282ae06d7e15b1db291a2831e2905a940f43cb121a3c6ee3e
reference-evaluator-v2.mjs        b9d027f8c3a1aeff248c72e811062cec1ff8340419d9c625af3fe4857a97fa7a
RRF_V2_CALIBRATION.json           bc815df5557b483bc4a27f02735afbbd54c4cb350278cf83f29ffe79be9883b6
```

## Deliberately not yet passed

- Sites scaffold/generator/build/binding/migration compatibility;
- hosted cookie, identity anti-spoof/stability, access, and D1 persistence;
- real ChatGPT and conditional Chrome application-tool flows;
- product unit/D1/browser/security/accessibility tests and coverage;
- exact-source product parity with v2 development goldens;
- one-time deployed release holdout and latency;
- founder VoiceOver/manual session and cold evaluator;
- public repository/Site/video/Devpost/attestation.

These are `NOT_RUN`, not missing documentation. Package 0 begins them in the order specified by `CODEX_IMPLEMENTATION_PLAN.md`.
