# Focus Contract Studio — Start Here

Status: **CONTROLLING INTAKE**  
Authority revision: **2.0 — 2026-08-29 EDT**  
Current phase: **authority v2 validated; implementation authorized; Package 0 next**

## New to Codex?

Read `docs/delivery/CODEX_TEAM_OPERATING_PLAYBOOK.md` for the beginner-to-advanced operating guide, safe multi-agent team model, worktree/PR workflow, scheduled-task boundaries, and copy-ready project templates under `docs/delivery/codex-team/`. The playbook explains how to execute this pack; it does not override product authority.

## Product in one sentence

Focus Contract Studio is a public ChatGPT Site where an accessibility or design-system lead and ChatGPT inspect one live Delete Account dialog, retrieve applicable reviewer precedent, stage a visibly unapplied configuration change, require an exact UI-mediated review decision, apply it once with guarded D1 writes, and verify the resulting keyboard behavior from raw browser events.

## Non-negotiable product truth

- The active focus revision is the **implemented renderer configuration**. The renderer always follows it.
- Seed revision 1 focuses `delete-button`; synthetic prior reviewer precedent D001 says the applicable decision is `cancel-button`. The UI labels this `DECISION MISMATCH`, not a standards violation.
- Retrieval supplies evidence. It never supplies approval, authorization, identity, or verification truth.
- An agent-authored changed proposal must cite eligible precedent whose normalized outcome supports every changed field. With the precedent removed, the same change is rejected with `EVIDENCE_REQUIRED_FOR_AGENT_CHANGE`.
- Proposal creation never changes the renderer. Only an exact current UI-mediated approval plus guarded execution can create revision 2.
- Verification reads finalized raw focus/key events and the immutable rendered manifest. It cannot manufacture events from the target configuration.
- No Clivus source, service, data, database, prompt corpus, or private implementation is copied. Only the independently specified evidence-versus-authority pattern and clean-room RRF formula are reused.

## Mandatory read order

An implementation agent must read every file below before the named phase. A file omitted from this list is non-controlling unless a controlling file links to it explicitly.

### Before any scaffold or product code

1. `WEBMCP_FOUNDER_DECISIONS.md`
2. `docs/authority/PRODUCT_TRUTH.md`
3. `docs/authority/AUTHORITY_VALIDATION.md`
4. `docs/delivery/AGENT_BUILD_CONTRACT.md`
5. `docs/architecture/TECHNOLOGY_SELECTION.md`
6. `docs/hackathon-build/scope.md`
7. `docs/hackathon-build/prd.md`
8. `docs/hackathon-build/spec.md`
9. `docs/architecture/ARCHITECTURE.md`
10. `docs/architecture/DOMAIN_MODEL.md`
11. `docs/contracts/WEBMCP_TOOL_CONTRACT.md`
12. `docs/retrieval/RETRIEVAL_AND_RRF_SPEC.md`
13. `docs/retrieval/RRF_BENCHMARK.md`

### Before UI implementation

14. `docs/product/UX_SPEC.md`
15. `docs/quality/ACCESSIBILITY_AND_VERIFICATION.md`
16. `docs/quality/SECURITY_AND_PRIVACY.md`

### Before tests, release, or submission

17. `docs/quality/TEST_STRATEGY.md`
18. `docs/quality/TRACEABILITY_MATRIX.md`
19. `docs/hackathon-build/checklist.md`
20. `docs/delivery/EVIDENCE_REGISTRY.md`
21. `docs/delivery/DEPLOYMENT_AND_OPERATIONS.md`
22. `docs/delivery/PROVENANCE_AND_LICENSE.md`
23. `docs/delivery/CODEX_IMPLEMENTATION_PLAN.md`
24. `docs/delivery/SUBMISSION_PLAN.md`
25. `devpost-submission.md`
26. `.devpost-hackathon-state.json`

`docs/hackathon-build/build-notes.md` and `learner-profile.md` explain provenance and the operator. Files under `docs/research/` are dated research snapshots only; they do not override revision-2 authority.

## Authority order

When two statements differ, use this order:

1. current formal Devpost Official Rules and current organizer updates;
2. current official OpenAI Sites/Site-tools documentation and observed hosted behavior;
3. `WEBMCP_FOUNDER_DECISIONS.md`;
4. `docs/authority/PRODUCT_TRUTH.md`;
5. exact interface, domain, retrieval, security, and verification contracts;
6. PRD, UX, checklist, delivery, and submission documents;
7. dated research and advisory opinions.

External documentation never silently changes a founder product decision. A runtime contradiction is recorded as `PASS`, `FAIL`, or `INCONCLUSIVE`; a material scope change requires a new founder decision.

## Stop conditions

Stop and repair the authority before continuing if any implementation would:

- let the renderer diverge from the active implemented revision;
- expose approval through WebMCP or an API route;
- let precedent or model text authorize a mutation;
- create a changed agent proposal without field-level precedent support;
- let `read_active_focus_review` create/refresh/clean up/audit product state or accept a caller-owned evidence query ID;
- apply after a zero-row guard/CAS result or partially write an apply receipt;
- distinguish a foreign opaque ID from a nonexistent one in a public response;
- use expected fixtures to generate observed verifier events;
- tune on the v2 holdout or lower a frozen gate after seeing it;
- claim a saved Sites version is a private storage-isolated preview;
- claim the deployed code equals a later evidence commit;
- claim Chrome, optional sign-in, accessibility, or public availability without the named hosted/manual probe.

## Definition of ready to implement

The current validation result is recorded in `docs/authority/AUTHORITY_VALIDATION.md`. Product code starts with the bootstrap probes in `docs/architecture/TECHNOLOGY_SELECTION.md`; the future product repository reruns authority validation after copying this pack and before feature code.
