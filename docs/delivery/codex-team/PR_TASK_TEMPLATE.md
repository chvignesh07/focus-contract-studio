# Codex Worktree / Pull Request Task Brief

Do not start a writing task until every required field is concrete. One brief equals one independently mergeable outcome.

## Identity

- Task title:
- Package/issue:
- Reviewed base branch:
- Reviewed base commit:
- Intended branch name:
- Integration owner:
- Dependencies that must already be merged:

## Goal

Describe the observable result, not just an activity.

## Context

- Controlling files:
- Relevant source paths:
- Existing tests and fixtures:
- Current failure or missing behavior:
- Runtime/environment facts already verified:

## Exclusive ownership

- Paths this task may edit:
- Paths this task may add:
- Paths this task must not edit:
- Shared interfaces frozen for this task:
- Migration/lockfile/generated-config owner:

If another active task can edit any same mutable path, stop and sequence the work.

## Constraints

- Product invariants:
- Security/privacy boundaries:
- Compatibility requirements:
- External actions forbidden without approval:
- Out of scope:

## Required delegation

- Read-only code mapping needed: yes/no
- Official-doc verification needed: yes/no
- Read-only test/accessibility review needed: yes/no
- Read-only security/contract review needed: yes/no
- Maximum concurrent subagents: 3

## Done when

- User-visible behavior:
- Tests that must pass:
- Type-check/lint/build gates:
- Browser/visual/manual proof:
- Security/accessibility proof:
- Documentation/evidence updates:
- Clean-checkout reproduction:
- Known high-severity issues allowed: none

## Handoff report

Return:

1. exact branch and commit;
2. changed files and behavior;
3. commands/checks actually run with outcomes;
4. screenshots/traces/evidence paths where applicable;
5. valid review findings fixed and rerun gates;
6. external actions or state changes performed;
7. remaining risk, FAIL, or INCONCLUSIVE items;
8. merge-order or follow-up dependency.
