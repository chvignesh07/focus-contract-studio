# Package 0 External Checkpoint Runbook

Status: **NOT_RUN — no external action is authorized or performed by this commit**

This product-owned runbook closes the local sequencing and recovery defects without changing the imported revision-2 authority pack. Its machine-readable contract is `PACKAGE0_EXTERNAL_RUNBOOK.json`.

Current official OpenAI Sites documentation establishes the controlling platform facts: Site creation adds `project_id` to `.openai/hosting.json`; local versions are associated with the Git commit used for the build; saving and deployment are separate; every deployment URL is production; a new Site begins owner-limited; and runtime values and secrets belong in Sites rather than `.openai/hosting.json`. Source: [OpenAI Sites documentation](https://learn.chatgpt.com/docs/sites), rechecked 2026-08-30.

## Stage 1 — create, re-freeze source, and save only

This stage requires one fresh approval. Its fixed target is Site name and slug `focus-contract-studio-package-0` on branch `main`. Immediately before creation, repeat a read-only owner-site inventory in the approved workspace and compare both title/name and slug by case-insensitive exact match. Creation is allowed only when the inventory is complete and unambiguous, the combined match count is exactly zero, the working tree is clean on the approved fully reverified HEAD, `.openai/hosting.json` has no `project_id`, and Git has no remote.

Stop before creation on any exact or case-insensitive name/slug match, unavailable or ambiguous inventory, unexpected `project_id`, unexpected Git remote, non-`main` branch, dirty tree, or failed current-HEAD verification. Never select a pre-existing Site by name/slug as a substitute for the approved creation.

Create the Site once only with the exact fixed name and slug, then immediately persist the returned opaque ID verbatim. The only permitted source target is the private Sites-managed repository returned by that same create operation. Before any push, independently verify its private visibility, association with the returned Site project, and `main` branch. Stop if the association or privacy is unavailable or ambiguous. Never invent, select, overwrite, or persist a Git remote; use the returned short-lived source credential only as per-command authentication, and never record it.

The `project_id` write changes source, so commit it, rerun the complete Package 0 gate and a unique no-hardlinks clean-checkout gate on the new HEAD, privately push that exact `main` HEAD to the verified returned repository, and package that exact HEAD. The five full SHAs—post-creation HEAD, reverified HEAD, pushed HEAD, package source HEAD, and saved-version `commit_sha`—must be the same exact 40-character Git SHA. Save the version and then prove the deployment count for the Site created by this operation is numerically zero.

Stop after the version is saved. Do not deploy, set runtime values, mutate D1, change access, or run identity probes. The pre-creation HEAD can never be the saved-version SHA after Site creation changes `.openai/hosting.json`.

The machine-enforced preconditions, ordered actions, forbidden actions, required evidence, stop conditions, SHA equality, and zero-deployment assertion are in `PACKAGE0_EXTERNAL_RUNBOOK.json`. After the last read-only zero-deployment observation, a redacted evidence manifest at an absolute path outside the repository must pass `node --experimental-strip-types tests/package0/stage1-evidence-validator.ts /absolute/outside/repository/stage1-evidence.json`; Stage 1 is incomplete unless that command returns `PASS`. The validator rejects missing or out-of-order checkpoints, any forbidden action, incomplete or ambiguous inventory, case-insensitive title/slug collisions, dirty or unverified source, an existing remote or `project_id`, duplicate creation, wrong target/repository/branch, push before repository verification, persisted remote/credential, mismatched full SHAs, any deployment, unrecognized manifest fields, and an in-repository evidence path.

The manifest may record only counts, booleans, checkpoint IDs/results, and source SHAs—not a workspace label, project ID, repository URL, credential, account identifier, or other private value. The separately reviewed handoff may report only the sanitized non-sensitive workspace display label. Post-commit verification and the validated manifest must remain outside the repository so neither can manufacture a self-referential committed-HEAD claim.

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
