# Focus Contract Studio Repository Contract

## Scope and authority

This file governs the entire product repository. Revision 2.0 is controlling. Before material work, read `START_HERE.md` and its mandatory files in order. Current executable code and fresh runtime evidence outrank stale summaries, but neither may silently change a founder decision.

Do not copy Clivus code, data, services, prompts, identifiers, or private artifacts. Retrieval is evidence and can never authorize a mutation. The visible UI is the only approval surface; WebMCP exposes no approval operation.

## Repository custody

- Keep this checkout isolated from the planning workspace and unrelated repositories.
- Preserve the untouched generated-scaffold commit and all user changes.
- Use one writer per checkout. Read-only reviewers may inspect bounded surfaces.
- Never modify global Codex configuration, plugins, MCP servers, credentials, or the read-only planning workspace from this repository.
- Do not start the next implementation package without explicit user authorization.

## Engineering gate

Use Node.js 22.13 or newer and the committed npm lockfile. Run:

```sh
npm ci
npm run verify:package0
```

During development, run the narrow relevant test first. Defects require a reproducer, root-cause fix, regression evidence, and a rerun of affected gates. Never weaken an assertion to make a failure disappear.

Package 0 evidence lives in `docs/evidence/BOOTSTRAP_PROBES.md`. Use only `PASS`, `FAIL`, `INCONCLUSIVE`, `NOT_RUN`, or `NOT_APPLICABLE` as evidence results. A local build, shim, screenshot, saved version, or HTTP 200 never substitutes for a hosted or real-client gate.

## External and destructive actions

Ask immediately before any deployment, hosted D1 mutation, external account write, credential operation, destructive action, purchase, public push, publication, or submission. State the exact target and effect. Never expose secrets, raw identity headers, cookies, private account data, or credentials in logs, artifacts, commits, or chat.

## Product invariants

- The renderer follows the active implemented revision.
- Revision 1 focuses Delete; eligible precedent D001 says Cancel; the initial state is `DECISION MISMATCH`.
- A proposal is durable and visibly `NOT APPLIED`; it does not change the renderer.
- Apply requires an exact current UI-mediated approval and guarded D1 writes that create revision 2 once or create nothing.
- Every guarded write inspects affected-row counts; zero rows is application failure.
- Verification consumes finalized raw browser events and an immutable rendered manifest; expected values cannot manufacture observations.
- Foreign and nonexistent opaque identifiers share the same public response boundary.
- Exactly four release tools are authorized by `docs/contracts/WEBMCP_TOOL_CONTRACT.md`; Package 0's temporary read-only probe must be removed before the release-tool package exits.

## Completion evidence

Before a material handoff: inspect the diff, run the complete proportionate gate from a clean checkout, record exact source/runtime identities, update the evidence source of truth, and report unresolved external proof honestly. Stop when the current package passes and do not begin the next one.
