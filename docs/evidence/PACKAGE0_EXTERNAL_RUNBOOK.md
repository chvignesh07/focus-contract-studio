# Package 0 External Checkpoint Runbook

Package 0 overall result: **INCONCLUSIVE**
External checkpoints: **NOT_RUN**
Authorization status: **no external action is authorized or performed by this commit**

This product-owned runbook closes the local sequencing and recovery defects without changing the imported revision-2 authority pack. Its machine-readable contract is `PACKAGE0_EXTERNAL_RUNBOOK.json`.

Current official OpenAI Sites documentation establishes the controlling platform facts: Sites has **no standalone Codex CLI management view**; ChatGPT desktop or web must create, save, deploy, and manage a Site, while Codex CLI may edit and test local source. Site creation adds `project_id` to `.openai/hosting.json`; local versions are associated with the Git commit used for the build; saving and deployment are separate; every deployment URL is production; a new Site begins owner-limited; and runtime values and secrets belong in Sites rather than `.openai/hosting.json`. Source: [OpenAI Sites documentation](https://learn.chatgpt.com/docs/sites), rechecked 2026-08-30.

## Stage 1 — create, re-freeze source, and save only

This stage is not approved. A future approval transfers the **entire** Sites lifecycle for this checkpoint to one authenticated ChatGPT desktop or web owner; it does not authorize Codex CLI to manage Sites. The fixed target is Site name and slug `focus-contract-studio-package-0` on branch `main`.

### Three independent evidence planes

1. **Structural manifest consistency.** `tests/package0/stage1-evidence-validator.ts` strictly validates manifest schema version 3, checkpoint order, one evidence run ID, six distinct receipt hashes, and equality among five full lineage SHAs. Its only success result is `CONSISTENCY_PASS`. That result is never hosted or Stage 1 completion proof: an operator-authored boolean or a syntactically valid synthetic SHA can establish structure only.
2. **Live local Git/hosting verification.** `tests/package0/stage1-live-local-verifier.ts` reads the real checkout's actual `git rev-parse HEAD`, branch, porcelain status, remote count, and `.openai/hosting.json` project-ID state without recording its value, then runs the complete Package 0 verification command and re-reads the checkout to detect mutation during the gate. `PRE_CREATE` requires no project ID and generates a random 128-bit non-secret evidence run ID. `POST_CREATE` reuses that evidence run ID and requires `project_id` to be a valid non-empty string without recording its value. The sanitized `LOCAL_VERIFICATION_PASS` receipt must be created outside the repository.
3. **Independently reviewed, sanitized Sites-tool receipts.** `tests/package0/stage1-sites-receipt-validator.ts` validates the inventory, authoritative create/source-repository observation, save-only observation, one continuous ChatGPT execution surface and owner, the same evidence run ID, timing, and an independent read-only review bound to the SHA-256 of each exact sanitized receipt. `RECEIPT_CONSISTENCY_PASS` proves only receipt schema, cross-field consistency, timing, and hash binding. It never proves authentication, a hosted/provider fact, or Stage 1 completion by itself.

All three planes are mandatory. Their validators are deliberately unable to turn self-asserted values into hosted truth. After the three artifacts validate, `tests/package0/stage1-evidence-binding-verifier.ts` performs the final cross-plane binding: it recomputes all six referenced hashes, requires the same evidence run ID everywhere, binds saved/pushed lineage to the post-create receipt and actual checkout HEAD, re-runs the live checkout and Package 0 gate, and rejects stale evidence. The complete evidence run is bounded to four hours and final binding must occur within 15 minutes of the last reviewed receipt. `EVIDENCE_BOUND` still does not prove a hosted fact or Stage 1 completion by itself.

### Owner inventory immediately before creation

A user-confirmed selected account/workspace is required immediately before `create_site` in the same ChatGPT desktop or web session that will execute the lifecycle. That single authenticated owner must then repeat a read-only inventory with `role=owner`, the current maximum supported page size of `50`, and cursor exhaustion through every page. Compare both title and slug with the fixed target by case-insensitive exact match. The observation must be no more than 300 seconds before creation.

The sanitized inventory receipt records only authentication success, requested owner role, page count, cursor exhaustion, UTC timestamp, and title/slug/combined match counts. It excludes account and workspace identifiers, Site identifiers, unrelated Site names, and raw tool payloads. Creation is allowed only when the combined unique match count is exactly zero, the inventory is independently reviewed, the working tree is clean on the approved live-verified HEAD, `.openai/hosting.json` has no `project_id`, and Git has no remote.

Stop before creation on any exact or case-insensitive name/slug match, unavailable or ambiguous inventory, unexpected `project_id`, unexpected Git remote, non-`main` branch, dirty tree, or failed current-HEAD verification. Never select a pre-existing Site by name/slug as a substitute for the approved creation.

Create the Site once only with the exact fixed name and slug, then immediately persist the returned opaque ID verbatim without placing its value in evidence. Source-repository association may rely only on the credential nested in the same authoritative `create_site` response. Private visibility requires authoritative Sites or provider evidence; if that evidence is missing or ambiguous, mark the checkpoint `INCONCLUSIVE` and stop before push.

Credential safety means protected connector or in-memory handling plus per-command HTTP authorization only. A token or credential is forbidden in URLs, Git configuration, credential helpers, files, shell history, evidence, logs, commits, and user-visible output. Never invent, select, overwrite, or persist a Git remote. Never push before association, private visibility, and branch `main` are authoritatively established.

The `project_id` write changes source, so commit it and create the post-create local receipt after the commit and before push; this receipt does not require the not-yet-created final manifest. Then run a unique no-hardlinks clean-checkout gate on the new HEAD, privately push that exact `main` HEAD to the verified returned repository, and package that exact HEAD. The five full SHAs—post-creation HEAD, reverified HEAD, pushed HEAD, package source HEAD, and saved-version `commit_sha`—must be the same exact 40-character Git SHA. Final binding makes each one equal the live verifier's actual `git rev-parse HEAD`; an all-`a` or other synthetic SHA cannot qualify.

Save that exact version without deploying it. Observable save-only evidence must establish that no deployment tool was invoked, no deployment ID or status was produced, the saved version exists with the exact pushed commit SHA, and the Site's current live URL remains absent after save-only. Current tools expose no authoritative numerical deployment count, so never claim a numerical deployment count unless a future authoritative interface directly exposes it.

Stop after the version is saved. Do not deploy, set runtime values, mutate D1, change access, or run identity probes. The pre-creation HEAD can never be the saved-version SHA after Site creation changes `.openai/hosting.json`.

The machine-enforced preconditions, ordered actions, forbidden actions, required evidence, stop conditions, live checkout binding, and observable save-only assertions are in `PACKAGE0_EXTERNAL_RUNBOOK.json`. Every receipt, review bundle, manifest, and post-commit verification output must use an absolute path outside the repository. Receipt-writing CLIs create mode-`0600` files exclusively and refuse to overwrite an existing path.

The future owner runs these local validators in this order, only after the corresponding direct observations exist. The non-secret run ID printed into the pre-create receipt is carried unchanged through every later sanitized receipt and manifest:

```text
node --experimental-strip-types tests/package0/stage1-live-local-verifier.ts --phase PRE_CREATE --expected-head <actual-full-head> --receipt /absolute/outside/repository/pre-create-local.json
node --experimental-strip-types tests/package0/stage1-live-local-verifier.ts --phase POST_CREATE --expected-head <actual-post-create-full-head> --evidence-run-id <pre-create-32-hex-run-id> --receipt /absolute/outside/repository/post-create-local.json
node --experimental-strip-types tests/package0/stage1-sites-receipt-validator.ts /absolute/outside/repository/sites-receipt-bundle.json
node --experimental-strip-types tests/package0/stage1-evidence-validator.ts /absolute/outside/repository/stage1-consistency-manifest.json
node --experimental-strip-types tests/package0/stage1-evidence-binding-verifier.ts --manifest /absolute/outside/repository/stage1-consistency-manifest.json --sites-receipts /absolute/outside/repository/sites-receipt-bundle.json --pre-create-receipt /absolute/outside/repository/pre-create-local.json --post-create-receipt /absolute/outside/repository/post-create-local.json --receipt /absolute/outside/repository/final-binding.json
```

The validator vocabulary remains evidence-plane-specific: `LOCAL_VERIFICATION_PASS`, `RECEIPT_CONSISTENCY_PASS`, `CONSISTENCY_PASS`, and `EVIDENCE_BOUND`. None is named or interpreted as a hosted `PASS` or Stage 1 `PASS` in isolation.

The consistency manifest records only the non-secret evidence run ID, checkpoint results, distinct SHA-256 receipt references, full source SHAs, and explicit false declarations for sensitive/private values and unsupported numerical deployment claims—not a workspace label, project ID, repository URL, credential, account identifier, unrelated Site name, raw response, or other private value. Post-commit verification and the validated evidence must remain outside the repository so neither can manufacture a self-referential committed-HEAD claim.

## Stage 2 — owner-only deployment with mutation hard-disabled

This is a separate approval. Deploy only the exact Stage 1 saved version and verify owner-only access. Every D1 run, cleanup, operator-token, and identity setting must be absent or hard-disabled. Run only the named hosted observations and supported Site-tool observation; record bounded results without raw headers, cookies, account values, or secrets.

## Stage 3 — optional identity observation

This is separate and optional. Keep every D1 control hard-disabled. Configure the identity probe value as a hosted secret only for the approved observation, redeploy the exact saved version owner-only, perform anti-spoof and repeat-byte observations, then remove the identity value and redeploy with identity disabled. A failure or inconclusive result keeps optional identity out of the product.

## Stage 4 — bounded D1 run, recoverable cleanup, hard disable

This requires another explicit approval. Owner-only platform access must already be proven, but it is an external prerequisite rather than application-level operator authentication.

The operator generates and retains a random 32-byte base64url token outside the browser, repository, chat, logs, and evidence. Sites receives only its lowercase SHA-256 digest, marked secret. The browser sends the raw token over same-origin HTTPS in the dedicated operator header for one action and immediately clears its input. The server compares the digest in constant time. Origin validation remains only a CSRF layer, and the page checkbox remains only a local human guard.

Do not use browser automation, screenshots, page snapshots, request inspection, or network logging while a real operator token is present. Enter the token manually only for the approved action and confirm that the input clears before collecting any evidence.

The run deployment requires owner confirmation, the operator digest, the run flag, and integer start/end times whose duration is no more than 900 seconds. Cleanup is a distinct deployment state: the run flag and run bounds are removed or false while owner confirmation and the same operator digest remain. Wait until the durable gate's stored run-window expiry plus the enforced five-second drain before enabling and deploying a separate cleanup window of at most 900 seconds. A new browser can re-enter the retained operator token; no cleanup cookie is required.

Finalization validates the token-bound durable gate and will drop only the exact Package 0 parent, child, and gate tables. Exact-name work tables and the gate must still match their sealed schemas; otherwise cleanup fails closed and preserves the table. Gate and work-table creation is fenced into one atomic batch whose gate row rechecks the database clock against the stored run window. Combined with the finalization drain, neither a pre-acquisition nor post-acquisition paused request can recreate schema after zero cleanup.

After zero exact probe schema is proven, remove every temporary Package 0 environment value—including owner confirmation, operator digest, run/cleanup flags and bounds, and identity key—and redeploy the exact saved version hard-disabled. Do not change access or publish.

## Truth boundary

This runbook is local evidence only. Until the separately approved stages actually run against the exact saved/deployed version, their Package 0 rows remain `NOT_RUN`. A saved version, HTTP 200, owner-only setting, local D1 test, or ordinary-browser result does not substitute for hosted D1 or supported ChatGPT evidence.
