# Quickstart Validation: Package 5

## Prerequisites

- Node.js 22.13+
- Exact Package 5 worktree and branch
- Lockfile-compatible shared `node_modules` and `.playwright-browsers` links only while running checks
- No hosted credentials or external actions

## Focused red-to-green loop

```sh
npm run test:package5:node
npm run test:package5:d1
npm run test:package5:dom
npm run test:package5:browser:built
```

Expected: the focused new test fails before its corresponding implementation and passes afterward. Preserve the red output in Package 5 execution evidence without recording secrets or local absolute paths.

## Complete local gate

```sh
npm run verify:package5
```

Expected: inherited Package 4 verification, Package 5 state/real-D1/concurrency/route/DOM/browser/coverage checks, build, audit, source binding, and evidence binding all pass.

## Browser journey

1. Start from seeded revision 1 and create/inspect the exact `NOT APPLIED` proposal.
2. Approve through the visible UI and apply once.
3. Reload; confirm revision 2 and Cancel focus.
4. Complete a fresh raw rehearsal and verify all six checks.
5. Confirm one provenance-complete projected precedent and chronological history.
6. Undo to a later revision; prove the old approval cannot apply.
7. Deliberately confirm reset; confirm a new seeded current workspace.
8. Repeat the required focus/visibility assertions at desktop, 320 px, 375 px, and 200% zoom with reduced motion.

## Exact-commit clone

After the worktree gate passes and the Package 5 checkpoint commit exists, create one disposable `--no-local --single-branch` clone of that exact commit, attach only validated cache links, run `npm run verify:package5`, remove links, prove the clone clean, and remove only that disposable clone.

Hosted/manual/external rows remain `NOT_RUN` for this package.
