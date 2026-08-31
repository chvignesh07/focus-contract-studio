# Spec Kit Prompt A Verification

**Scope:** Gates 0-2 only

**Baseline:** `ab714fec10443c54ac08fbcdeaf94bd610085031`

**Pilot branch:** `pilot/spec-kit-prompt-a-gates-0-2`

**Pilot worktree:** `<REPOSITORY_ROOT>`

**Result before the dedicated adoption commit:** `PASS`

This receipt covers repository-local Spec Kit adoption only. It does not create
or authorize a Package 3 specification, plan, tasks, test, or implementation.

## Gate 0 — Baseline, authority, and custody

[Empirical] The main checkout was clean on `main`; local `HEAD`, the local
`origin/main` tracking ref, and a fresh read-only `git ls-remote` of
`refs/heads/main` all resolved to
`ab714fec10443c54ac08fbcdeaf94bd610085031`. The branch relationship was `0 0`.
`git diff --check`, index verification, and `git fsck` passed.

[Empirical] Root `AGENTS.md`, `START_HERE.md`, every file in its 26-file
mandatory read order, `docs/evidence/EXECUTION_STATE.{md,json}`, and
`FOUNDER_EXECUTION_DECISION_2026-08-30.md` were read completely before mutation.
They show Package 2 local/public-source `PASS`, hosted proof `NOT_RUN`, and
Package 3 `NOT_AUTHORIZED`.

[Empirical] `docs/evidence/PACKAGE2_VERIFICATION.md` and its machine-readable
receipts record the canonical Package 2 gate at exit `0`: Package 0 `80/80`,
Package 1 Node `10/10`, Package 1 D1 `59/59`, Package 2 Node `42/42`, Package 2
D1 `18/18`, Package 2 DOM `5/5`, and built-local-Worker browser journeys `5/5`.

[Empirical] The current Package 2 source and evidence binders passed at the
baseline. A fresh no-hardlinks clone outside the repository passed both source/evidence
binders; source and clone `AGENTS.md` inode identities differed, proving the
verification did not reuse hard-linked working files. The full Package 2 gate
was rerun separately in the pilot before initialization.

[Empirical] `lsof` and an approved read-only `ps` inspection found no process
with a project file open for writing. Four pre-existing, waiting `gh auth login`
child processes were unrelated to the repository and were not interacted with.
The pilot writer was the sole writer after the isolated worktree was created.

[Empirical] A byte manifest of the main working checkout outside `.git`
contained 33,248 regular-file entries and had SHA-256
`659c43e608598715c6d98ed2022e61db3f886c84a61181436c180abe039bc4a0`.
Its separate 49-entry symlink-target manifest had SHA-256
`fe23d573abd508c73030ff5c18e0992d3e20ee7b1afa0eb9d8697ada3dc07e2d`.
These are the pre-adoption comparison points for the final main-checkout proof.

## Gate 1 — Isolated worktree and pinned provenance

[Empirical] The sibling worktree was created locally from the exact baseline on
`pilot/spec-kit-prompt-a-gates-0-2`; the main checkout was not used as a writer.
Before initialization, `.specify/`, `.agents/`, `.codex/`, and `specs/` were
absent in the pilot.

[Empirical] The official source was cloned from
`https://github.com/github/spec-kit.git` into a disposable detached checkout at
`v1.0.1` commit `9118ed15a0ba65053469a94c560ea5d233f75884`. Its tree is
`460b3a777a0bb19709cd027ffe9180a701efcd2b`; `git fsck` passed. The annotated
tag object is `ed9713e4af96437c7605abfa2411144d1393e247`. `git verify-tag
v1.0.1` returned `error: no signature found`; no signature claim is made.

[Empirical] The detached source had 545 tracked files totaling 11,671,736 bytes
and was clean before lock generation. Its MIT `LICENSE` SHA-256 is
`2510b446bc1f0cf9702453075d20cd88631e20e5642658edb7325d9c1eb534f7`.
The upstream tree has no `uv.lock`.

[Empirical] A local hash-bearing lock was generated before package execution.
Its SHA-256 is
`64b7fbf776403c947c2cce2eba8647fa3ef741995e429de0ea83ed5f03d8cb85`,
an exact match to the adoption plan. `uv lock --check` passed. The preserved
lock is `spec-kit-v1.0.1.uv.lock`; wheel and sdist artifact hashes remain in its
package entries.

[Empirical] The development-dependency-excluded environment contains only
`specify-cli==1.0.1` and the expected 14 host runtime dependencies:
`annotated-doc 0.0.5`, `click 8.5.0`, `json5 0.15.0`, `markdown-it-py 4.2.0`,
`mdurl 0.1.2`, `packaging 26.3`, `pathspec 1.1.1`, `platformdirs 4.11.5`,
`pygments 2.21.0`, `pyyaml 6.0.3`, `readchar 4.2.2`, `rich 15.0.0`,
`shellingham 1.5.4`, and `typer 0.27.2`. The plan comparison has zero version
differences. `colorama 0.4.6` is locked only for Windows and is not installed on
this host.

## Gate 2 — Core-only initialization

[Empirical] The pinned CLI was executed from the disposable source environment
with `--locked --no-dev --offline`; it was not installed globally. The exact
initializer selected Codex, shell scripts, non-interactive mode, and no preset,
extension, bundle, or integration option. It exited `0` and made no network
request during initialization.

[Empirical] The generated surface is exactly 30 core files: ten allowlisted
`.agents/skills/speckit-*/SKILL.md` files and 20 `.specify/**` files. The
post-bridge hashes are in `GENERATED_FILES.sha256`. There are no symlinks. The
only executables are the six expected `.specify/scripts/bash/*.sh` files.

[Empirical] Immediately after initialization,
`specify integration status --json` returned `status: ok`, Codex as the sole
integration, 10 Codex-managed files, 12 shared managed files, and zero missing,
modified, invalid, or unchecked managed paths. The unedited response is in
`INTEGRATION_STATUS_IMMEDIATE.json`. After the thin constitution was written,
the same command still returned those zero counts because the seeded
constitution is intentionally not an upstream manifest-managed file.

[Empirical] The thin constitution only restates already-controlling authority:
authority precedence, evidence-versus-authorization, UI-mediated review,
WebMCP's non-approval boundary, privacy-bounded observation, fixture/observation
separation, verifier independence, guarded writes, package evidence, and
separate external-action approval.

## Generated-surface security review

[Empirical] Static URL scanning found zero `http://`, `https://`, or `www.`
references in generated `.agents` and `.specify` files. Network-command scanning
found no `curl`, `wget`, SSH/SCP, socket client, URL client, or Git
fetch/pull/push/clone instruction in generated scripts or workflow files.

[Empirical] The official `speckit-taskstoissues` skill contains GitHub issue
read/write instructions. It is retained only because the plan's exact
ten-skill allowlist includes it. It was not invoked, and the bridge constitution
states that issue creation remains separately approval-gated.

[Empirical] Core skill text contains dormant extension-hook instructions, and
the bundled workflow can later dispatch planning and implementation commands.
No `.specify/extensions.yml`, extension directory, preset, bundle,
`integration-events.yml`, `.codex/config.toml`, or `.github/hooks` path exists;
the workflow and all skills were audited but not invoked.

[Empirical] Independent source review identified that pre-existing, unregistered
`.specify/extensions/**` content could cause Codex event configuration during a
forced brownfield init. The exact target was preflighted before init and had no
Spec Kit-managed path, extension content, or `.codex` configuration. The
conditional path therefore was not reachable. Introducing any such content is
prohibited by this adoption gate and would require a new review.

[Empirical] Three scoped Gitleaks directory scans covered `.agents`, `.specify`,
and `docs/evidence/spec-kit`; all returned `no leaks found`. A second explicit
private-key/token pattern scan returned no match.

[Empirical] No other installed local/global skill has a `speckit-*` name or
directory. Deterministic PyYAML validation found all ten exact names, non-empty
descriptions, the exact compatibility string, and the expected
`github-spec-kit` metadata/source values with zero parse or duplicate errors.

[Empirical] A fresh `codex-cli 0.151.0` session ran with `--strict-config`,
`--sandbox read-only`, `--ephemeral`, `--ignore-user-config`, and
`--ignore-rules`. It invoked no tool or skill and reported exactly the ten
project skill names, `parsing_errors: []`, and `duplicate_name_errors: []`.
`GENERATED_FILES.sha256` and Git status were unchanged after the smoke test.

## Verification command ledger

All commands were run from the pilot unless a different directory is shown.

| Command | Result |
|---|---|
| `git status --porcelain=v2 --branch --untracked-files=all` | Main clean; `main`, exact baseline, `+0 -0`. Pilot initially clean on its dedicated branch. |
| `git rev-parse HEAD origin/main` | Both baseline SHA. |
| `git ls-remote --heads origin refs/heads/main` | Live remote baseline SHA. Read-only network operation. |
| `git rev-list --left-right --count origin/main...HEAD` | `0 0`. |
| `git diff --check && git diff --cached --check && git fsck --no-progress` | Exit `0`. |
| Package 2 source/evidence binders in the fresh no-hardlinks baseline clone | Both exit `0`; source manifest `98ec0cd8989ab453458300dfa2cecfbd741c1245e9f608bf1b613c865a02288f`, evidence binder `PASS`. |
| `npm run verify:package2` in the pilot before init | First sandboxed run reached local bind and failed with `listen EPERM`; approved localhost-capable rerun exited `0` with the same complete passing counts. |
| `npm ci` in the pilot | Exit `1`, `ENOSPC`; exact partial pilot `node_modules` was removed. No tracked file changed. |
| `cp -cR` of baseline dependency caches plus `npm ls --depth=0 --json` | Copy-on-write pilot-local dependency directories created; `npm ls` exit `0`. They are ignored and are not adoption paths. |
| `git ls-remote https://github.com/github/spec-kit.git ...` | Official `v1.0.1` tag peeled to the expected commit. Read-only network operation. |
| `git clone ... --branch v1.0.1 --single-branch` plus `git rev-parse` / `git fsck` | Detached exact commit/tree; clean tracked source; fsck pass. |
| `git verify-tag v1.0.1` | Expected non-pass: `error: no signature found`; recorded as unsigned. |
| `uv lock --python 3.14.5 --no-python-downloads --no-progress` | Exit `0`; 22 lock entries including conditional/test extras; no package executed first. |
| `uv lock --check --python 3.14.5 --no-python-downloads` | Exit `0`; `Resolved 22 packages`. |
| `shasum -a 256 uv.lock` | Expected lock SHA exact match. |
| `uv pip list --python .venv/bin/python --format freeze` | Exactly 15 installed lines: Spec Kit plus the 14 planned host runtime dependencies; no pytest/coverage/dev extras. |
| `uv run ... specify version` | Exit `0`; CLI `1.0.1`, Python `3.14.5`, Darwin arm64. |
| `uv run ... specify init --here --force --non-interactive --integration codex --script sh` | Exit `0`; Codex core and shell assets only. |
| `uv run ... specify integration status --json` immediately after init | `status: ok`; `0/0/0/0` missing/modified/invalid/unchecked. |
| `find .specify .agents -type f ...` | 20 `.specify` files, ten skill files, no extra `.agents` path, no symlink. |
| `shasum -a 256 -c docs/evidence/spec-kit/GENERATED_FILES.sha256` | 30/30 `OK`, including after the Codex smoke test. |
| `for f in .specify/scripts/bash/*.sh; do bash -n "$f"; done` | Exit `0`, six of six. |
| `python docs/evidence/spec-kit/verify_adoption.py .` through the locked runtime | Final exit `0`; exact surface, manifests, modes, JSON/YAML/frontmatter, forbidden paths, symlinks, and lock all pass. The first draft of this verifier correctly failed its own overly shallow workflow-name assumption; the verifier was corrected to the documented nested schema and rerun. |
| `rg` URL/network/external-write scans across `.agents` and `.specify` | Zero URL/network command hits; only the reviewed dormant issue-write and extension/workflow instruction surfaces described above. |
| global/project `speckit-*` skill collision scans | Zero pre-existing collision. |
| `gitleaks dir --redact --no-banner --log-level info` on each adoption surface | Three exits `0`; no leaks. |
| fresh `codex exec ... --sandbox read-only --ephemeral ...` | Initial outer sandbox attempt failed before session start with `Operation not permitted`; approved rerun kept Codex's own sandbox read-only and exited `0` with ten skills and empty error arrays. |

## Rollback proof

[Empirical] A second disposable target was initialized through the same pinned,
locked, offline runtime. The bridge constitution was copied into it and hashed
as `2fdc74a25835202eae17bd9b3a03d55210d5a7925c2411f3aa55ccb75a4c4496`.
Running the following without `--force` exited `0` and reported `Removed 10
file(s)`:

```sh
uv run --project <DISPOSABLE_SPEC_KIT_SOURCE> \
  --locked --no-dev --offline --python 3.14.5 --no-python-downloads \
  --link-mode clone specify integration uninstall codex
```

Afterward `.agents` and the Codex manifest were absent, shared `.specify`
infrastructure remained, `.codex` was absent, and the bridge constitution's hash
was unchanged.

[Empirical] A direct `git revert` immediately after uninstall was tested and
correctly refused to overwrite the uninstaller's local
`.specify/init-options.json` change. The executable two-stage procedure therefore
uses a recoverable Git stash between inspection and revert:

```sh
# After preserving the verification report and reviewing the uninstall diff:
git diff -- .specify .agents docs/evidence/spec-kit
git stash push --include-untracked \
  -m "rollback: preserve hash-aware Spec Kit uninstall state" -- \
  .specify .agents docs/evidence/spec-kit
git revert --no-edit <ADOPTION_COMMIT_SHA>
git diff --exit-code \
  ab714fec10443c54ac08fbcdeaf94bd610085031 HEAD --
git status --porcelain=v2 --branch --untracked-files=all
git stash list
```

The stash is retained as recoverable uninstall evidence and is not reapplied or
dropped automatically. In a disposable no-hardlinks clone, this sequence
created one revert commit, left a clean checkout, and produced tree
`596116507a6cdc83cd169758fdf8fe8ae2561bb4`, exactly equal to the baseline tree.
This proves the uninstaller's preservation behavior and the Git revert that
removes shared `.specify`, the skills, and adoption evidence.

## Scope closure

[Empirical] No Package 3 specification, plan, task file, test, or product code
was created. No application code, dependency manifest, D1/Sites configuration,
Devpost state, access, or unrelated evidence claim changed. No issue-creation
skill or generated workflow was invoked. No merge, push, deploy, publish,
hosted-data mutation, credential change, billing action, or other external write
occurred. Network use was limited to read-only provenance/remote checks, locked
dependency retrieval into the disposable environment, and the required
read-only Codex discovery smoke test.
