# Package 0 Local Security Hardening

Evidence date: **2026-08-30 EDT**
Scope result: **PASS — local regressions only**
Hosted and supported-client result: **NOT_RUN**

## Reproduced root causes

1. **[Empirical] Source lineage was stale after Site creation.** Official OpenAI Sites documentation says a newly provisioned local Site adds `project_id` to `.openai/hosting.json`, while a saved local version is associated with the Git commit used for its build. The repository had no machine-enforced post-creation commit sequence. The new runbook test failed with `ENOENT` before its product-owned contract existed.
2. **[Empirical] Run and finalization require different deployed states.** The handler required run enablement plus owner confirmation for execution, but finalization required run disablement while owner confirmation remained. The prior evidence text told the operator to remove values too early and depended on an HttpOnly cleanup cookie.
3. **[Empirical] Mutation enablement was durable and cleanup was browser-bound.** No server time bound existed. Losing the 15-minute cookie or browser prevented exact finalization.
4. **[Empirical] No application-layer operator authorization existed.** A matching Origin, UI checkbox, and two environment booleans could reach the D1 runner. The focused handler suite reproduced missing and forged operator calls reaching the database-availability branch (`503` rather than the required authorization rejection).
5. **[Empirical] Lease recovery had a stale-writer race.** The gate was created before the work-table DDL. A paused runner could resume that DDL after stale-`RUNNING` finalization had returned zero schema. The regression observed `late-ddl` instead of a settled runner.
6. **[Empirical] Recovery did not re-prove table ownership.** Replacing an exact-name work table with a sentinel schema was silently dropped by finalization; the regression reported a missing expected rejection.
7. **[Empirical] Pre-acquisition replay could outlive cleanup.** A second authorized run paused before its reserved-schema check, while another run completed and cleanup removed the gate. Releasing the old request after zero cleanup recreated the gate because acquisition did not recheck the database clock.
8. **[Empirical] Gate ownership was not re-proved.** Replacing the exact-name durable gate with a compatible sentinel schema let finalization drop unrelated data; the regression reported a missing expected rejection.

## Red evidence

- Hosted handler command: 11 passed, 5 failed for operator authorization, bounded windows, cookie removal, and cleanup state.
- D1 runner command: 4 passed, 2 failed for delayed DDL after lease recovery and exact-name schema ownership.
- External runbook command: 0 passed, 2 failed because the checkpoint contract did not exist.
- A follow-up state-machine regression failed `503 !== 409` when run and cleanup enablement were simultaneously true.
- Final read-only review produced two additional red regressions: the pre-acquisition request completed after zero cleanup, and the replaced gate was finalized instead of rejected.

The failures were observed before their corresponding production changes. No external action, credential operation, hosted write, deployment, source push, or account mutation occurred.

## Implemented security properties

- D1 run and cleanup require a 43-character base64url operator token. The server hashes it and compares the lowercase SHA-256 digest in constant time with a hosted secret value. Missing configuration, missing token, malformed token, and forgery share one fail-closed response.
- Origin validation remains a CSRF layer. The browser checkbox remains a local human guard. Neither is server authorization.
- Owner-only access remains a separately observed external prerequisite and is never described as proof of the request caller.
- Run and cleanup have different enable flags and different integer `not_before`/`expires_at` values. Each window must be active and no longer than 900 seconds. Both enable flags cannot be true together.
- Finalization requires run disabled, owner confirmation retained, operator authorization retained, cleanup enabled, and an active cleanup window. It does not read or issue a cleanup cookie, so a new browser can re-enter the retained operator token.
- Gate creation, token binding, persisted run bounds, and both work-table creations occur in one D1 batch. The gate row uses the database clock and rejects acquisition outside the stored window, so a pre-acquisition request cannot resume after expiry; a post-acquisition stale runner has no later create-table operation available.
- Finalization cannot claim or drop the gate until its stored run-window expiry plus a five-second drain. The 120-second `RUNNING` recovery lease remains independently enforced.
- Final cleanup is limited to the three exact Package 0 names. Any present work table and the gate must match their sealed schemas before removal; an ownership mismatch preserves the table and returns a bounded error.
- The sealed migration statements, collision preflight, one-shot gate, concurrent acquisition, repeat rejection, 120-second recovery lease, forged-token rejection, prepared/constraint/batch behavior, zero-row rejection, and final exact zero-schema check remain enforced.
- No raw operator token, digest, identity header, cookie, credential, or private account value is logged, returned, or recorded in evidence.

## Green evidence and remaining boundary

The point-in-time `2afb08c` green runs passed 18/18 hosted-handler tests, 9/9 hosted-D1 runner tests (15/15 including the direct D1 suite), and 2/2 then-current external-runbook tests. The tracked `7926034` local-gate and clean-checkout artifacts remain historical measurements, not current-HEAD proof. Complete current-HEAD and unique no-hardlinks post-commit verification must be recorded outside the repository and reported at handoff so this source document never fabricates a self-referential committed SHA.

This evidence does not establish Sites deployment behavior, owner-only access, hosted environment propagation, managed D1 semantics, real edge logs, optional identity, or supported ChatGPT Site-tool behavior. Those rows remain `NOT_RUN` and Package 0 cannot pass until the separately approved external checkpoints supply them.

## Stage 1 evidence contract hardening

The Stage 1 contract now separates structural manifest consistency, live local Git/hosting verification, and independently reviewed sanitized Sites-tool receipts. The structural validator returns only `CONSISTENCY_PASS`; it cannot elevate caller-authored booleans or a synthetic all-`a` SHA into hosted proof. The live verifier reads the actual branch, HEAD, clean state, remotes, and project-ID state, rejects a missing, null, blank, or non-string post-create `project_id` without recording a valid value, runs `npm run verify:package0`, and detects checkout changes during the gate. The receipt validator enforces authenticated owner inventory shape and timing, one continuous execution owner/surface/run ID, exact same-response source association, authoritative private-visibility evidence, non-persistent per-command credential handling, observable save-only evidence, sanitization, and independent hash-bound review.

Independent review found that the first separated design still allowed arbitrary manifest receipt hashes, cross-plane SHA disagreement, replayable old receipts, and an impossible post-create/final-manifest order. Those findings were reproduced before remediation. `PRE_CREATE` now generates a non-secret random 128-bit evidence run ID, `POST_CREATE` reuses it before push without requiring the future final manifest, and a final binding verifier runs only after the Sites receipts and manifest validate. It recomputes all six hashes, binds saved/pushed/manifest/post-receipt SHAs to the actual current checkout, reruns the live Package 0 gate, enforces ordered timestamps, limits the evidence run to four hours, and rejects final binding more than 15 minutes after the last review. Its `EVIDENCE_BOUND` result still does not independently prove hosted facts or Stage 1 completion.

No authoritative numerical deployment-count interface is currently exposed, so the contract forbids a numerical zero claim. It instead requires directly reviewed evidence that no deployment tool was invoked, no deployment ID or status was produced, the saved version carries the exact pushed SHA, and the current live URL remains absent after save-only. Missing association, privacy, authentication, lineage, review, or absent-live-URL proof produces `INCONCLUSIVE` or a validator failure; it never degrades into operator assertion.

This change hardens evidence and future operator procedure only; **runtime product behavior was not changed**. No Sites lifecycle action, credential operation, repository push, package/save/deploy action, environment change, hosted D1 or identity probe, publication, or Package 1 work was performed.

## Protected-surface recheck

- **[Empirical]** The 95-file read-only planning workspace aggregate remains `291d5c548322b707a75878aa5d4ce34444af9cb486801231f9c7091e068c5da0`, exactly matching the Package 0 baseline.
- **[Empirical]** Global Codex `AGENTS.md`, `config.toml`, combined agent catalogs, skills, and plugins retain their recorded baseline digests. No planning, global configuration, agent, skill, or plugin file was changed.
- **[Empirical]** Credential content was never read. The credential file's current metadata is stable across the hardening rechecks; its recorded modification/change time is `2026-08-30T04:39:43Z`, more than nine hours before this hardening request entered the session at `2026-08-30T13:54:27Z`. The older Package 0 artifact predates that metadata change, so this evidence does not speculate about its earlier cause; it proves the change did not occur during this task.
- **[Empirical]** `.openai/hosting.json` remains unmodified and contains no `project_id`. No Site, version, deployment, hosted D1 write, credential operation, remote push, or publication was performed.
