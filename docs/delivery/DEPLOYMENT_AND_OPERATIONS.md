# Focus Contract Studio — Deployment and Operations

Status: **RELEASE RUNBOOK**  
Authority revision: **2.0 — 2026-08-29 EDT**

## Hosting truth

The contest release is one ChatGPT Site with one Sites-managed D1 database. There is no secondary frontend, API host, database, object store, queue, model service, or custom analytics service.

**[Empirical]** Sites separates saving a version from deploying it, associates a locally built version with a Git commit, and treats every deployed URL as production. A saved version is not evidence of public availability and does not promise an isolated D1 database. Source: [ChatGPT Sites](https://learn.chatgpt.com/docs/sites).

Therefore:

- local build, saved version, deployment, public access, and real-client acceptance are separate gates;
- intermediate owner-only deployments still use production infrastructure and synthetic data only;
- all contest migrations are additive and backward-compatible across any still-running saved version;
- no release claim says “preview database” unless a current hosted probe proves a distinct binding, which is not assumed here.

### Bootstrap edge prerequisite

The local built Worker accepts a new-workspace bootstrap only with a strictly validated `CF-Connecting-IP`. The application uses it only to derive an ephemeral abuse-control HMAC bucket; it does not access `request.cf`. `X-Forwarded-For`, `X-Real-IP`, and other forwarding headers cannot select the rate bucket. The raw address is neither stored nor logged. Missing or malformed input returns structured HTTP 503 before application writes. This value is never used for authentication or authorization. Hosted edge overwrite/spoof resistance remains unproven until an owner-only deployed probe passes; Package 8 remains **BLOCKED** and that probe is `NOT_RUN`. Do not weaken the fail-closed behavior to deploy.

## Environment model

| Environment | Purpose | Authority and data |
|---|---|---|
| Local fresh test | Unit, component, D1 integration, migration, benchmark-development, and browser automation | Recreated synthetic data; disposable. |
| Local preview | Full human journey and WebMCP shim | Synthetic data; not real-client or public evidence. |
| Saved Sites version | Immutable build candidate associated with source commit | Not deployed and not a public-availability proof; shares no assumed isolated database. |
| Owner-only production deployment | Real ChatGPT/Sites qualification before public access | Production host and real Sites D1; synthetic contest data only. |
| Public production deployment | Exact submitted judge release | Anonymous isolated workspaces plus synthetic precedent; full public and real-client gates apply. |

Never point local tests at the public D1 database. Never derive fixtures from a production export.

## Configuration and secrets

Inspect the generated `.openai/hosting.json` and commit only documented fields:

- the exact Sites `project_id` returned by creation;
- D1 enabled with binding name `DB`;
- R2 disabled/null;
- no invented or undocumented binding.

The current runtime requires exactly four values configured through the official
Sites mechanism and never committed:

- `FCS_SESSION_HMAC_SECRET`, `FCS_CSRF_HMAC_SECRET`, and
  `FCS_RATE_LIMIT_HMAC_SECRET`: three distinct canonical unpadded base64url secrets,
  each decoding to exactly 32 bytes;
- `FCS_PUBLIC_ORIGIN`: the exact public origin, with no path, query, or fragment.

Local development uses separately generated ignored values. The server fails closed with a non-secret correlation ID when required configuration is absent. Logs, tool results, receipts, screenshots, CI artifacts, and error pages never reveal secret values.

Canonical local verification also requires Gitleaks `8.30.1`. CI downloads the official Linux archive at that exact version, verifies its pinned SHA-256 before installation, then runs `npm run verify`. The verifier forces source-bound config and an intentionally empty ignore file, strips config environment overrides, rejects inline allow comments, scans a content-bound exact current-tree snapshot plus reachable `--all` history, and rejects a planted synthetic secret-shaped fixture; a missing, stale, wrong-policy, wrong-scope, finding-bearing, or unsuccessful scan fails the gate.

## Migration discipline

1. The scaffold probe records the generated schema/migration source paths; those inspected paths become authoritative.
2. Generate numbered SQL migrations into the generated migration directory.
3. Review foreign keys, checks, unique/index definitions, guarded-apply trigger/finalizer logic, and every destructive statement.
4. Apply to a fresh local database twice: once from zero and once as an upgrade from the previous schema.
5. Run full D1 integration, rollback injection, zero-row conditional-write, and query-plan tests.
6. Apply only through the current official Sites workflow.
7. Never edit an applied migration. Add a forward-compatible migration.
8. Never drop or rewrite revisions, decisions, receipts, workspaces, or audit history during the contest.

A destructive migration requires a separately proven export/restore procedure and fresh founder approval. It is not part of this release plan.

## Seed, reset, and cleanup

- Seed material is versioned, synthetic, deterministic, and validated against `SHA256SUMS-v2` before insertion.
- The seed is idempotent and creates no duplicate product, variant, revision, precedent, or relationship row.
- Every workspace is separately keyed and owned; shared fixture provenance never becomes cross-workspace product state.
- `Reset demo` operates only on the current anonymous workspace, creates an audit receipt, rotates the anonymous session, and cannot reseed global tables during a public request.
- Expiry cleanup is request-driven, bounded by row/time limits, and run only on safe bootstrap or write paths. It cannot delay the hero path indefinitely or delete immutable release evidence.
- The retention values and disclosure are controlled by `SECURITY_AND_PRIVACY.md` and become claims only after hosted validation.

## Source-to-release lineage

The deployed source commit and post-deploy evidence are necessarily created at different times. Never force them into a self-referential “same commit” claim.

### Committed input record

Before source freeze, commit `release/BUILD_INPUTS.json` into source commit `C`:

```json
{
  "schemaVersion": "fcs-build-inputs-v1",
  "product": "Focus Contract Studio",
  "release": "webmcp-challenge-2026",
  "gitTag": "webmcp-challenge-2026",
  "nodeVersion": "<exact>",
  "packageManager": "<exact>",
  "lockfileSha256": "<sha256>",
  "authorityRevision": "2.0",
  "fixtureManifest": "docs/retrieval/fixtures/rrf/SHA256SUMS-v2",
  "fixtureManifestSha256": "<sha256>",
  "verifyCommand": "<exact command>",
  "buildCommand": "<exact command>"
}
```

It contains no `gitCommit` field, no hash of itself, and no Sites/video/submission values. The release process records `C` externally after commit.

### Post-deploy attestation

After public acceptance, video upload, and submission, generate `.artifacts/release/RELEASE_ATTESTATION.json`:

```json
{
  "schemaVersion": "fcs-release-attestation-v1",
  "sourceCommit": "<full C sha>",
  "sourceTag": "webmcp-challenge-2026",
  "sourceRepository": "<public repository url>",
  "buildInputsSha256": "<sha256 from C>",
  "sitesProjectId": "<exact id>",
  "sitesVersionId": "<exact id>",
  "deployedUrl": "<public https url>",
  "savedAt": "<UTC>",
  "deployedAt": "<UTC>",
  "fixtureHashes": {},
  "evidenceIndexSha256": "<sha256>",
  "evidenceArtifacts": [],
  "testedClients": [],
  "video": { "url": "<public YouTube>", "sha256": "<sha256>", "durationSeconds": 0 },
  "devpost": { "submissionUrl": "<url>", "confirmedAt": "<UTC>" },
  "generatedAt": "<UTC>"
}
```

The attestation is not committed into `C`. Validate it against a schema, hash it, upload it with its evidence index as public release assets, and freeze those assets through judging. If an optional later evidence commit `E` is used, the attestation names both `sourceCommit=C` and `evidenceCommit=E`; the deployment is never claimed to contain `E`.

## Candidate and release sequence

1. Confirm repository root, branch, exact HEAD, clean tree, and no unrelated overlay.
2. Recheck official Devpost rules/updates and current Sites/WebMCP documentation.
3. Fresh-install from the lockfile using documented Node/package-manager versions.
4. Verify fixture/schema/evaluator hashes and migration history.
5. Run canonical `verify`, production build, dependency/license/secret/history/bundle scans, and Review 1 disposition checker.
6. Generate final `release/BUILD_INPUTS.json`; commit/push/tag exact source commit `C` to the public repository.
7. Save a Sites version built from `C`; record project/version IDs and timestamps outside `C`.
8. Deploy that same version owner-only. Treat it as production. Apply only tested additive migrations.
9. Run owner smoke: release marker, session isolation, dialog observation, memory counterfactual, proposal non-mutation, guarded apply/retry/concurrency recovery, verification, reload, undo, headers, limits, and supported ChatGPT tool calls.
10. Obtain the founder's explicit public-access action. Expose/deploy the exact same saved version publicly.
11. In clean signed-out and second browser profiles, rerun the full judge journey, cross-profile isolation, public links, accessibility automation, and live performance.
12. Run supported ChatGPT acceptance and conditional Chrome acceptance. Record exact client/build/flag/result.
13. An independent reviewer runs the sealed v2 holdout exactly once on source `C`; founder performs the VoiceOver/manual session; cold evaluator performs the 15-second comprehension test.
14. Complete Adversarial Review 2 against the public exact version.
15. If any product/configuration/fixture/migration change is required, create a new `C`, Sites version, and full sequence. Never silently patch the candidate.
16. Capture exact-release screenshots/video and complete pre-submission evidence; complete Devpost, submit with buffer, and capture the receipt; then generate/validate/publish the final evidence index and receipt-bearing attestation before freeze.

## Public acceptance minimum

- Live URL opens signed out with no credentials and no private data.
- Two fresh profiles receive different workspaces and indistinguishable unavailable-ID errors.
- Revision 1 renders Delete; D001 says Cancel; `DECISION MISMATCH` is visible.
- Memory-on accepts the evidence-supported agent proposal; memory-off rejects the identical change; neither applies it.
- UI review plus guarded apply produces exactly revision 2; same-key retry produces no duplicate.
- Raw rehearsal verifies revision 2; deliberate divergence fails; reload and undo preserve history.
- Exactly four tools are registered in a supported ChatGPT client, with bounded outputs and no approval tool.
- Public repository, Apache-2.0 license, video, and all Devpost links work while signed out.

## Rollback and incident policy

Before the submission deadline:

- a code/runtime regression may be recovered by deploying the last known-good saved version, then rerunning public identity and journey gates;
- a data regression uses a tested forward repair; never rewind/delete D1 history blindly;
- every recovery records time, source/version, impact, action, and verification;
- any recovered version must still match the eventual attestation and submission.

At or after the deadline, perform read-only availability checks only. Do not change code, access, D1 data/schema, repository, video, screenshots, or Devpost entry—including rollback—without written organizer authorization. If the platform itself restores service without an entrant mutation, record the incident and keep claims exact.

## Operations through judging

- Morning and evening: signed-out HTTP/page availability, public repository, public video, and Devpost-link check.
- Daily only before the deadline: full synthetic hero journey if it will not invalidate frozen evidence.
- After the deadline: no journey that mutates product state unless organizer-authorized; use read-only health and availability indicators.
- Record Sites/D1 error observations using available logs with redaction; do not add a third-party analytics service.
- **[Empirical]** Sites may provide automatic unique-visitor/pageview analytics. The privacy notice discloses platform analytics and makes no unsupported data-residency claim for code, D1, artifacts, or logs.

## Deadline freeze

At **2026-09-03 20:00 UTC / 16:00 EDT / 13:00 PT**:

- freeze source tag/commit, deployed Sites project/version/access, public repository, video, screenshots, evidence assets, Devpost content, and links;
- preserve public availability through the published judging period;
- continue experiments only on a clearly separate post-contest project/branch/site that is not linked from the entry;
- recheck official rules/updates immediately before freeze because they remain controlling.
