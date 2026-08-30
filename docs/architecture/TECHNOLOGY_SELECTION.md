# Focus Contract Studio — Top-One Technology Selection

Status: **LOCKED SUBJECT TO NAMED BOOTSTRAP PROBES**  
Research refreshed: **2026-08-29 EDT**

## Selection principle

Use the smallest first-party stack that proves the live WebMCP workflow, durable state, guarded mutations, independent verification, premium UI, and public submission. The generated Sites starter, its scripts, and observed hosted behavior outrank package/framework guesses.

## Chosen stack

| Layer | Top-one choice | Evidence and implementation rule |
|---|---|---|
| Runtime and host | **ChatGPT Sites** | **[Empirical]** Sites is a public-beta hosted web-app workflow; every deployment URL is production. Create the Site once and preserve its generated `project_id`. No detached backend. |
| Persistent data | **Sites-managed D1 binding `DB`** | **[Empirical]** Official Sites guidance selects D1 for durable structured records. Use `STRICT` ordinary tables where compatible, foreign keys/checks/indexes, prepared statements, and numbered reviewed SQL migrations. |
| Starter/framework | **Whatever the current official Sites workflow generates** | **[Empirical]** Public docs do not lock a framework, add-on name, CLI version, or test harness. Generated files/scripts are authoritative; record them in bootstrap evidence before editing. |
| Language | **Strict TypeScript** | One contract source across UI, routes, domain, retrieval, verifier, and WebMCP. `strict`, `noUncheckedIndexedAccess`, and no unexplained `any` in release code. |
| UI | **Starter-compatible React UI, semantic HTML, native `<dialog>`, product CSS tokens** | Use a component library only if the generated starter already requires it. Preserve ordinary UI when WebMCP is absent. |
| Migrations | **Numbered, reviewed SQL migrations** | Do not assume Drizzle. Install/use it only if the generated scaffold already supports it and a hosted migration/rollback-compatibility probe passes. Generated SQL is always reviewed and committed. |
| Runtime queries | **Prepared D1 SQL in thin repositories** | Critical proposal/apply/undo/review operations use explicit guarded SQL and inspect every `D1Result.meta.changes`; a zero-row write is failure, not implicit success. |
| Validation | **Zod 4 strict objects → Draft-07 JSON Schema** | Use `z.strictObject()` and `z.toJSONSchema(schema, { target: "draft-07" })`; forbid transforms and unrepresentable types in tool input schemas; never use an input mode that removes `additionalProperties:false`. |
| WebMCP | **Top-level imperative `document.modelContext.registerTool`** | Register exactly four same-origin tools, omit cross-origin `exposedTo`, pass the registry abort signal in the supported options argument, and retain a complete human UI. |
| Lexical retrieval | **Pure TypeScript BM25 over the already-eligible bounded rows** | **[Empirical]** FTS5 BM25 uses global table statistics; that violates the strict eligibility-before-ranking claim. D1 first fetches at most 36 eligible records; deterministic TypeScript BM25 scores only that set. No FTS5 table is needed for release. |
| Other retrieval | **D1 structured rank + explicit subject-edge rank + clean-room RRF `k=60`** | Every ranker consumes the same eligible set. Fixed formulas, total ordering, schemas, fixtures, hashes, and calibration precede product retrieval code. |
| Session | **Anonymous `__Host-fcs_session` cookie** | Random bearer token; store only keyed digest; Secure/HttpOnly/SameSite; rotate and expire. Hosted cookie behavior is a blocking probe. |
| Optional identity | **Exact documented authenticated email header, HMACed byte-for-byte** | **[Empirical]** Current Sites docs guarantee `oai-authenticated-user-email` and optional full name, not an opaque ID or normalization rule. Validate syntax; do not lowercase/local-part-normalize; never persist raw email/name. Ship optional continuity only after hosted anti-spoofing and stability probes. |
| Crypto | **Web Crypto SHA-256/HMAC + random UUID/token generation** | Worker-compatible, no third-party crypto package. Domain-separated five-minute evidence tokens keep reads write-free and bind proposal evidence to session/workspace/state/results. Fixed canonical vectors and tamper tests are mandatory. |
| Unit/DOM | **Vitest 4.1+ + Testing Library + user-event** | Pin the generated compatible versions. Worker-runtime coverage uses Istanbul because Cloudflare's integration does not support V8 coverage. |
| D1 integration | **Generated official harness, otherwise Cloudflare Vitest integration** | Choose only after a fresh migrated D1 test proves real batch, constraint, and binding behavior. Do not mock the critical database semantics. |
| Browser/accessibility | **Playwright + `@axe-core/playwright` + founder manual keyboard/VoiceOver** | Automated checks are partial. Safari is human-UI/accessibility only, not a WebMCP acceptance client. |
| CI/release evidence | **GitHub Actions + GitHub Release assets** | CI ties tests to frozen source commit `C`. Post-deploy attestation is schema-validated, hashed, published, and frozen as a release asset; it is not a self-referential source manifest. |

Primary current sources: [ChatGPT Sites](https://learn.chatgpt.com/docs/sites), [ChatGPT Site tools](https://learn.chatgpt.com/docs/webmcp), [Chrome WebMCP](https://developer.chrome.com/docs/ai/webmcp), [Chrome secure tools](https://developer.chrome.com/docs/ai/webmcp/secure-tools), [Cloudflare D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/), [D1 results](https://developers.cloudflare.com/d1/worker-api/return-object/), [SQLite BM25](https://www.sqlite.org/fts5.html#the_bm25_function), [Zod JSON Schema](https://zod.dev/json-schema), and [Cloudflare Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/).

## Rejected technologies

| Rejected | Root cause |
|---|---|
| External backend/Supabase | Adds auth, CORS, secret, deployment, and failure boundaries without improving the page-bound proof. |
| FTS5 production BM25 | Global collection statistics allow ineligible rows to influence scores. The 36-row corpus makes exact local BM25 cheap and auditable. |
| Vector/embedding service | Adds nondeterminism, latency, cost, privacy, and a secret for a tiny synthetic corpus. |
| Graph database | Explicit typed D1 subject edges are sufficient. |
| R2 | No user-uploaded/file artifact belongs in the product data path. |
| Model API | ChatGPT is already the reasoning surface through WebMCP; another model weakens the challenge fit. |
| Clivus runtime/code/data | Different product authority and unnecessary provenance/security surface. |
| Tailwind/new UI kit | Extra surface for a single custom workflow unless already generated. |
| Storybook | Live seeded states plus component/E2E tests cover the release need. |
| Analytics SDK | Sites records traffic automatically; another processor is unnecessary. |
| Background worker/queue | The release uses request-driven bounded cleanup and no asynchronous product job. |

## Version and dependency policy

1. Use the current official Sites workflow; record the generated framework, scripts, Node/package-manager requirements, dependency versions, `.openai/hosting.json`, and project ID.
2. Commit the untouched scaffold and lockfile before feature work in the future product repository.
3. Exact-pin direct additions; generated transitive ranges remain lockfile-controlled.
4. Run license, secret, vulnerability, clean-build, and dependency-drift checks on frozen commit `C`.
5. A dependency/runtime change after the first release candidate creates a new commit/version and reruns every affected gate.

## Bootstrap probes — block features until resolved

All results go to future repository file `docs/evidence/BOOTSTRAP_PROBES.md` using `PASS`, `FAIL`, or `INCONCLUSIVE`.

| ID | Probe | Required evidence / decision |
|---|---|---|
| TP-01 | Starter | Untouched generated app installs, typechecks, tests if provided, builds, creates one Site, saves one version, and deploys owner-only. Record exact commands/files. |
| TP-02 | D1 | Binding/API shape, numbered migration workflow, `STRICT` support, FK/check/unique behavior, prepared statements, error rollback, zero-row success metadata, persistence, and additive migration compatibility pass locally and hosted. |
| TP-03 | Cookie/CSRF | Hosted response can set intended `__Host-` HttpOnly/Secure/SameSite cookie; Origin and CSRF behavior is observed; signed-out two-profile isolation passes. |
| TP-04 | Optional sign-in | Sites overwrites/strips caller-forged auth headers, exact email is stable enough for the demo, raw values do not persist/log, sign-out separates state. `FAIL/INCONCLUSIVE` means optional sign-in is disabled. |
| TP-05 | ChatGPT tools | Latest supported non-Enterprise/Edu ChatGPT desktop with GPT-5.6 Sol or Terra discovers/calls a minimal top-level imperative tool; cancellation, navigation, and duplicate cleanup pass. |
| TP-06 | Chrome | Record browser version/flag or origin trial, `window.originAgentCluster`, `Origin-Agent-Cluster`, `document.featurePolicy.allowsFeature("tools")`, discovery, call, abort, and same-origin exposure. Any unmet required step means `FAIL`; an interrupted/unavailable probe is `INCONCLUSIVE`. Record narrower observations in notes rather than inventing an intermediate status. |
| TP-07 | Headers | Sites preserves compatible CSP, `X-Content-Type-Options`, referrer policy, and—only if needed—`Origin-Agent-Cluster: ?1` / `Permissions-Policy: tools=(self)`. Do not add headers blindly. |
| TP-08 | Test harness | Fresh Worker-like D1 is migrated; a guarded batch, injected statement error rollback, and zero-row result are exercised. Worker coverage uses Istanbul. |
| TP-09 | Versions/storage | Confirm saved version is only a code/build candidate; record whether candidate shares the project D1. Never assume isolated preview storage. |
| TP-10 | Public access | After founder approval, deploy the same saved version publicly; fresh signed-out browser and two profiles load/persist/isolate successfully. |

## Top-one implementation consequences

- No FTS migration, trigger, or query syntax is part of the product.
- No optional identity code is merged into release `C` unless TP-04 passes early; anonymous is the baseline.
- Chrome is compatibility evidence, not a mandatory contest gate. ChatGPT plus complete human UI are mandatory.
- Every migration is additive/backward-compatible because old and candidate code may share one project database; restoring an older version restores code only, never D1 data/schema.
