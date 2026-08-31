from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path, PurePosixPath


EXPECTED_BRANCH = "feat/package-3-raw-observer-verifier"
BASELINE_GIT_COMMIT = "cb75d76e0cfd91534e27ea1ce6a2f192423d99c7"
CHECKPOINT_COMMIT_MESSAGE = "docs: complete Package 3 Prompt B specification"
GENERATED_MANIFEST_SHA256 = (
    "16628d7ae751a55aab7295d5c82e11426b18b6db94aa014f960d9a1c7d71aaaf"
)
PROMPT_A_VALIDATOR_SHA256 = (
    "d4a2b93e603f89223f8ac43a9f570df3f290f2c25a730be8d632f755ef0521f9"
)
WORKFLOW_SUFFIX = "docs/delivery/SPEC_KIT_ADOPTION_PLAN_2026-08-30.md"
BASELINE_PATH = "docs/evidence/spec-kit/PACKAGE3_AUTHORITY_BASELINE.json"
RECEIPT_PATH = "docs/evidence/spec-kit/PACKAGE3_AUTHORITY_BASELINE.sha256"
REHASH_LOG_PATH = "docs/evidence/spec-kit/PACKAGE3_AUTHORITY_REHASH_LOG.json"
VALIDATOR_PATH = "docs/evidence/spec-kit/verify_prompt_b.py"
FEATURE_POINTER_PATH = ".specify/feature.json"
EXPECTED_FEATURE_POINTER = (
    b'{\n  "feature_directory": "specs/001-package-3-raw-observer-verifier"\n}\n'
)
EXPECTED_FEATURE_POINTER_SHA256 = (
    "0f6600dc3e0c4754d657ce7ee8997659520e40f22a7a6d78ae479767fec71869"
)
SPEC_PATH = "specs/001-package-3-raw-observer-verifier/spec.md"
CHECKLIST_PATH = (
    "specs/001-package-3-raw-observer-verifier/checklists/requirements.md"
)
PROMPT_B_VISIBLE_PATHS = frozenset(
    {
        BASELINE_PATH,
        RECEIPT_PATH,
        REHASH_LOG_PATH,
        VALIDATOR_PATH,
        SPEC_PATH,
        CHECKLIST_PATH,
    }
)
PROMPT_B_PATHS = PROMPT_B_VISIBLE_PATHS | {FEATURE_POINTER_PATH}
PROMPT_B_EVIDENCE_PATHS = frozenset(
    {BASELINE_PATH, RECEIPT_PATH, REHASH_LOG_PATH, VALIDATOR_PATH}
)
FEATURE_FILES = frozenset({SPEC_PATH, CHECKLIST_PATH})
VALIDATION_STATES = ("working", "committed")
IGNORED_SECRET_PATHSPECS = (
    ":(glob)**/.env*",
    ":(glob)**/credential",
    ":(glob)**/credential.*",
    ":(glob)**/credentials",
    ":(glob)**/credentials.*",
    ":(glob)**/certificate",
    ":(glob)**/certificate.*",
    ":(glob)**/certificates",
    ":(glob)**/certificates.*",
    ":(glob)**/id_rsa",
    ":(glob)**/id_ed25519",
    ":(glob)**/id_dsa",
    ":(glob)**/id_ecdsa",
    ":(glob)**/id_ecdsa_sk",
    ":(glob)**/id_ed25519_sk",
    ":(glob)**/*.pem",
    ":(glob)**/*.key",
    ":(glob)**/*.crt",
    ":(glob)**/*.cer",
    ":(glob)**/*.der",
    ":(glob)**/*.p12",
    ":(glob)**/*.pfx",
)
EXPECTED_CATEGORY_COUNTS = {
    "AUT": 5,
    "OBS": 11,
    "VER": 16,
    "SEC": 10,
    "MUT": 7,
    "EVD": 13,
}
VERIFIER_BEHAVIORS = {
    "P3-VER-004": (
        "`initialFocus`",
        "first `focusin` after `dialog_open`",
        "configured initial focus",
        "frozen manifest",
    ),
    "P3-VER-005": (
        "`focusOrder`",
        "visits every configured target once in exact order before wrap",
        "tabbable set equals the configured set",
    ),
    "P3-VER-006": (
        "`trapTab`",
        "forward Tab on the configured final target",
        "configured first target",
        "no outside target",
    ),
    "P3-VER-007": (
        "`trapShiftTab`",
        "Shift+Tab on the configured first target",
        "configured final target",
    ),
    "P3-VER-008": (
        "`escapeAction`",
        "Escape while the dialog is open",
        "close reason `escape`",
        "never by close reason `delete`",
    ),
    "P3-VER-009": (
        "`returnFocus`",
        "first focus-return fact after close",
        "`delete-trigger`",
    ),
}
MUTATION_REQUIREMENTS = {
    "P3-MUT-001": ("initial focus is Delete", "requires Cancel", "fail `initialFocus`"),
    "P3-MUT-002": ("swaps Cancel and Delete", "fail `focusOrder`"),
    "P3-MUT-003": ("omits one configured tabbable target", "fail `focusOrder`"),
    "P3-MUT-004": ("escapes to the trigger or background", "fail `trapTab`"),
    "P3-MUT-005": ("backward Shift+Tab", "escapes", "fail `trapShiftTab`"),
    "P3-MUT-006": ("leaves the dialog open or dispatches Delete", "fail `escapeAction`"),
    "P3-MUT-007": ("other than `delete-trigger`", "fail `returnFocus`"),
}
MUTATION_IDS = frozenset(MUTATION_REQUIREMENTS)
HASH_PATTERN = re.compile(r"^[0-9a-f]{64}$")
COMMIT_PATTERN = re.compile(r"^[0-9a-f]{40}$")
REQUIREMENT_PATTERN = re.compile(
    r"^- \*\*(P3-([A-Z]+)-[0-9]{3})\*\*:\s+.+$"
)
SOURCE_ROW_PATTERN = re.compile(
    r"^\| (P3-[A-Z]+-[0-9]{3}) \| (.+) \|$"
)
P3_SYNTAX_PATTERN = re.compile(r"P3-[A-Za-z0-9*]")
ABSOLUTE_PATH_PATTERN = re.compile(
    r"(?<![A-Za-z0-9:])/(?:[A-Za-z0-9._~-]+/)+[A-Za-z0-9._~-]+"
)
SECRET_PATTERNS = (
    re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{30,}\b"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
    re.compile(
        r"(?i)(?:api[_-]?key|client[_-]?secret|password|access[_-]?token)"
        r"\s*[:=]\s*['\"]?[A-Za-z0-9_./+=-]{12,}"
    ),
)


class ValidationError(Exception):
    pass


def check(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def runtime_root(value: str, alias: str) -> Path:
    raw = Path(value)
    check(raw.is_absolute(), f"{alias} runtime argument must be absolute")
    check(not raw.is_symlink(), f"{alias} runtime root must not be a symlink")
    try:
        resolved = raw.resolve(strict=True)
    except OSError as exc:
        raise ValidationError(f"{alias} runtime root is unavailable") from exc
    check(resolved == raw, f"{alias} runtime root must be canonical")
    check(resolved.is_dir(), f"{alias} runtime root must be a directory")
    return resolved


def child_path(root: Path, relative: str, label: str) -> Path:
    pure = PurePosixPath(relative)
    check(not pure.is_absolute(), f"unsafe relative path: {label}")
    check(".." not in pure.parts and "." not in pure.parts, f"unsafe path: {label}")
    current = root
    for part in pure.parts:
        current = current / part
        check(not current.is_symlink(), f"symlink not allowed: {label}")
    try:
        resolved = current.resolve(strict=True)
    except OSError as exc:
        raise ValidationError(f"required path unavailable: {label}") from exc
    check(root == resolved or root in resolved.parents, f"path escapes root: {label}")
    return resolved


def regular_file(root: Path, relative: str, label: str | None = None) -> Path:
    path = child_path(root, relative, label or relative)
    check(path.is_file(), f"regular file required: {label or relative}")
    return path


def regular_files(root: Path, relative: str, label: str) -> set[str]:
    base = child_path(root, relative, label)
    check(base.is_dir(), f"directory required: {label}")
    files: set[str] = set()
    for path in base.rglob("*"):
        rel = path.relative_to(root).as_posix()
        check(not path.is_symlink(), f"symlink not allowed: {rel}")
        if path.is_file():
            files.add(rel)
    return files


def strict_json(data: bytes, label: str) -> object:
    def unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
        result: dict[str, object] = {}
        for key, value in pairs:
            check(key not in result, f"duplicate decoded JSON key: {label} > {key}")
            result[key] = value
        return result

    try:
        return json.loads(data.decode("utf-8"), object_pairs_hook=unique_object)
    except ValidationError:
        raise
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise ValidationError(f"invalid JSON: {label}") from exc


def git_result(root: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            ["git", "-C", str(root), *arguments],
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError as exc:
        raise ValidationError("git is unavailable") from exc


def git_output(root: Path, *arguments: str) -> str:
    result = git_result(root, *arguments)
    check(result.returncode == 0, f"git command failed: {' '.join(arguments)}")
    return result.stdout.strip()


def parse_generated_manifest(path: Path) -> dict[str, str]:
    check(
        sha256_file(path) == GENERATED_MANIFEST_SHA256,
        "Prompt A generated manifest hash mismatch",
    )
    result: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        match = re.fullmatch(r"([0-9a-f]{64})  ([^\r\n]+)", line)
        check(match is not None, "Prompt A generated manifest line invalid")
        digest, relative = match.groups()
        check(relative not in result, "Prompt A generated manifest duplicate path")
        result[relative] = digest
    check(len(result) == 30, "Prompt A managed file count must be 30")
    check(
        sum(path.startswith(".agents/skills/speckit-") for path in result) == 10,
        "Prompt A skill file count must be 10",
    )
    check(
        sum(path.startswith(".specify/") for path in result) == 20,
        "Prompt A .specify file count must be 20",
    )
    return result


def untracked_files(repository_root: Path) -> set[str]:
    result = git_result(
        repository_root, "ls-files", "--others", "--exclude-standard", "-z"
    )
    check(result.returncode == 0, "cannot enumerate untracked files")
    return {path for path in result.stdout.split("\0") if path}


def validate_repository_state(
    repository_root: Path, state: str, expected_head: str | None
) -> str:
    check(
        Path(git_output(repository_root, "rev-parse", "--show-toplevel")).resolve()
        == repository_root,
        "runtime repository root is not the Git worktree root",
    )
    check(
        git_output(repository_root, "branch", "--show-current") == EXPECTED_BRANCH,
        "feature branch mismatch",
    )
    head = git_output(repository_root, "rev-parse", "HEAD")
    if state == "working":
        check(
            expected_head is None,
            "--expected-head is prohibited in working mode",
        )
    else:
        check(state == "committed", "unknown validation state")
        check(
            expected_head is not None,
            "--expected-head is required for committed mode; "
            f"expected=<missing>, actual={head}",
        )
        check(
            COMMIT_PATTERN.fullmatch(expected_head) is not None,
            "committed --expected-head must be 40 lowercase hex; "
            f"expected={expected_head}, actual={head}",
        )
        check(
            head == expected_head,
            f"checkpoint HEAD mismatch: expected={expected_head}, actual={head}",
        )
    check(
        git_result(repository_root, "diff", "--quiet", "--").returncode == 0,
        "tracked working-tree changes are not allowed",
    )
    check(
        git_result(repository_root, "diff", "--cached", "--quiet", "--").returncode
        == 0,
        "staged changes are not allowed",
    )
    if state == "working":
        check(head == BASELINE_GIT_COMMIT, "working-state baseline HEAD mismatch")
        check(
            untracked_files(repository_root) == PROMPT_B_VISIBLE_PATHS,
            "untracked surface differs from the exact Prompt B allowlist",
        )
    else:
        parents = git_output(
            repository_root, "rev-list", "--parents", "-n", "1", "HEAD"
        ).split()
        check(
            len(parents) == 2 and parents[1] == BASELINE_GIT_COMMIT,
            "checkpoint commit must have exactly the authority baseline as parent",
        )
        check(
            git_output(repository_root, "show", "-s", "--format=%s", "HEAD")
            == CHECKPOINT_COMMIT_MESSAGE,
            "checkpoint commit message mismatch",
        )
        changed = set(
            git_output(
                repository_root,
                "diff-tree",
                "--no-commit-id",
                "--name-only",
                "-r",
                "HEAD",
            ).splitlines()
        )
        check(
            changed == PROMPT_B_VISIBLE_PATHS,
            "checkpoint commit differs from the exact six-file Prompt B surface",
        )
        check(
            not git_output(
                repository_root, "status", "--porcelain=v1", "--untracked-files=all"
            ),
            "committed-state worktree must be clean",
        )
        for relative in PROMPT_B_VISIBLE_PATHS:
            check(
                git_result(
                    repository_root, "ls-files", "--error-unmatch", "--", relative
                ).returncode
                == 0,
                f"checkpoint artifact is not tracked: {relative}",
            )
            check(
                git_output(repository_root, "hash-object", "--", relative)
                == git_output(repository_root, "rev-parse", f"HEAD:{relative}"),
                f"checkpoint artifact differs from HEAD: {relative}",
            )
    return head


def validate_feature_pointer(repository_root: Path, state: str) -> tuple[str, str]:
    expected_value = strict_json(EXPECTED_FEATURE_POINTER, "expected feature pointer")
    check(
        expected_value
        == {"feature_directory": "specs/001-package-3-raw-observer-verifier"},
        "built-in feature pointer semantics mismatch",
    )
    check(
        sha256_bytes(EXPECTED_FEATURE_POINTER) == EXPECTED_FEATURE_POINTER_SHA256,
        "built-in feature pointer digest mismatch",
    )
    check(
        git_result(
            repository_root, "check-ignore", "-q", "--", FEATURE_POINTER_PATH
        ).returncode
        == 0,
        "Prompt B feature pointer must remain ignored",
    )
    candidate = repository_root / FEATURE_POINTER_PATH
    check(not candidate.is_symlink(), "symlink not allowed: .specify/feature.json")
    if not candidate.exists():
        check(
            state == "committed",
            "working-state feature pointer must be present",
        )
        return "absent_expected_in_pristine_clone", EXPECTED_FEATURE_POINTER_SHA256

    data = regular_file(repository_root, FEATURE_POINTER_PATH).read_bytes()
    check(data == EXPECTED_FEATURE_POINTER, "feature pointer byte content mismatch")
    check(
        strict_json(data, FEATURE_POINTER_PATH) == expected_value,
        "feature pointer semantic content mismatch",
    )
    check(
        sha256_bytes(data) == EXPECTED_FEATURE_POINTER_SHA256,
        "feature pointer digest mismatch",
    )
    return "present_exact_ignored", EXPECTED_FEATURE_POINTER_SHA256


def validate_evidence_surface(repository_root: Path) -> None:
    tracked_evidence_result = git_result(
        repository_root, "ls-files", "-z", "--", "docs/evidence/spec-kit"
    )
    check(tracked_evidence_result.returncode == 0, "cannot enumerate evidence files")
    tracked_evidence = {
        path for path in tracked_evidence_result.stdout.split("\0") if path
    }
    check(
        regular_files(
            repository_root, "docs/evidence/spec-kit", "docs/evidence/spec-kit"
        )
        == tracked_evidence | PROMPT_B_EVIDENCE_PATHS,
        "spec-kit evidence surface differs from the exact phase allowlist",
    )


def validate_feature_surface(repository_root: Path) -> None:
    check(
        regular_files(repository_root, "specs", "specs") == FEATURE_FILES,
        "specs surface differs from the exact Prompt B feature files",
    )


def validate_ignored_secret_files(repository_root: Path) -> None:
    result = git_result(
        repository_root,
        "ls-files",
        "--others",
        "--ignored",
        "--exclude-standard",
        "-z",
        "--",
        *IGNORED_SECRET_PATHSPECS,
    )
    check(result.returncode == 0, "cannot enumerate ignored secret-like files")
    check(not result.stdout, "ignored secret-like file is not allowed")


def validate_git_and_surfaces(
    repository_root: Path, state: str, expected_head: str | None
) -> tuple[dict[str, str], str, str, str]:
    head = validate_repository_state(repository_root, state, expected_head)
    validate_evidence_surface(repository_root)
    feature_pointer_state, feature_pointer_hash = validate_feature_pointer(
        repository_root, state
    )
    validate_ignored_secret_files(repository_root)

    generated_manifest = regular_file(
        repository_root,
        "docs/evidence/spec-kit/GENERATED_FILES.sha256",
    )
    generated = parse_generated_manifest(generated_manifest)
    check(
        sha256_file(
            regular_file(
                repository_root,
                "docs/evidence/spec-kit/verify_adoption.py",
            )
        )
        == PROMPT_A_VALIDATOR_SHA256,
        "Prompt A validator changed",
    )
    actual_agents = regular_files(repository_root, ".agents", ".agents")
    actual_specify = regular_files(repository_root, ".specify", ".specify")
    expected_agents = {path for path in generated if path.startswith(".agents/")}
    expected_specify = {
        path for path in generated if path.startswith(".specify/")
    }
    if feature_pointer_state == "present_exact_ignored":
        expected_specify.add(FEATURE_POINTER_PATH)
    check(actual_agents == expected_agents, "Prompt A .agents surface mismatch")
    check(
        actual_specify == expected_specify,
        "phase-aware .specify surface mismatch",
    )
    for relative, expected_hash in generated.items():
        check(
            sha256_file(regular_file(repository_root, relative)) == expected_hash,
            f"Prompt A managed hash mismatch: {relative}",
        )
    executable_paths = {
        relative
        for relative in set(generated)
        | (
            {FEATURE_POINTER_PATH}
            if feature_pointer_state == "present_exact_ignored"
            else set()
        )
        if regular_file(repository_root, relative).stat().st_mode
        & (stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    }
    expected_executables = {
        relative
        for relative in generated
        if relative.startswith(".specify/scripts/bash/")
    }
    check(
        executable_paths == expected_executables,
        "Prompt A executable-mode surface mismatch",
    )
    validate_feature_surface(repository_root)
    for relative in PROMPT_B_VISIBLE_PATHS:
        regular_file(repository_root, relative)
    return generated, head, feature_pointer_state, feature_pointer_hash


def validate_json_anchor(data: bytes, anchor: str, label: str) -> None:
    value = strict_json(data, label)
    if anchor == "$":
        return
    check(anchor.startswith("$."), f"unsupported JSON anchor: {label}")
    current = value
    for component in anchor[2:].split("."):
        check(isinstance(current, dict) and component in current, f"missing anchor: {label}")
        current = current[component]


def markdown_label(value: str) -> str:
    return value.replace("`", "").replace("**", "").replace("__", "").strip()


def markdown_line_states(text: str) -> list[tuple[str, bool]]:
    result: list[tuple[str, bool]] = []
    fence: tuple[str, int] | None = None
    for line in text.splitlines():
        if fence is not None:
            marker, minimum = fence
            result.append((line, True))
            closing = (
                r" {0,3}" + re.escape(marker) + "{" + str(minimum) + ",}[ \t]*"
            )
            if re.fullmatch(closing, line):
                fence = None
            continue
        opening = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
        if opening:
            token = opening.group(1)
            fence = (token[0], len(token))
            result.append((line, True))
        else:
            result.append((line, False))
    return result


def markdown_structural_anchors(data: bytes, label: str) -> set[tuple[str, ...]]:
    try:
        text = data.decode("utf-8")
    except UnicodeError as exc:
        raise ValidationError(f"anchor source is not UTF-8: {label}") from exc
    stack: list[str] = []
    anchors: set[tuple[str, ...]] = set()
    for line, fenced in markdown_line_states(text):
        if fenced:
            continue
        heading = re.match(r"^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$", line)
        if heading:
            level = len(heading.group(1))
            stack = stack[: level - 1]
            stack.extend([""] * (level - 1 - len(stack)))
            stack.append(markdown_label(heading.group(2)))
            anchors.add(tuple(part for part in stack if part))
            continue
        block_label: str | None = None
        if line.lstrip().startswith("|") and line.rstrip().endswith("|"):
            first_cell = markdown_label(line.strip()[1:-1].split("|", 1)[0])
            if first_cell and not re.fullmatch(r":?-{3,}:?", first_cell):
                block_label = first_cell
        else:
            list_item = re.match(
                r"^\s*[-*+]\s+(?:\[[ xX]\]\s+)?(?:\*\*|__)(.+?)(?:\*\*|__)(?:\s|$)",
                line,
            )
            if list_item:
                block_label = markdown_label(list_item.group(1))
        if block_label:
            anchors.add(tuple([*(part for part in stack if part), block_label]))
    return anchors


def validate_text_anchor(data: bytes, anchor: str, label: str) -> None:
    expected = tuple(markdown_label(part) for part in anchor.split(" > "))
    check(
        any(path[-len(expected) :] == expected for path in markdown_structural_anchors(data, label)),
        f"missing structural anchor: {label}",
    )


def validate_source(
    repository_root: Path,
    baseline_commit: str,
    entry: dict[str, object],
    read_order: bool,
) -> tuple[str, set[str]]:
    expected_keys = {
        "path",
        "git_blob_id",
        "sha256",
        "bytes",
        "package_3_relevance",
        "anchors",
        "annotation",
    }
    if read_order:
        expected_keys.add("read_order")
    check(set(entry) == expected_keys, "repository authority entry shape mismatch")
    relative = entry.get("path")
    check(isinstance(relative, str), "repository authority path must be a string")
    data = regular_file(repository_root, relative).read_bytes()
    check(entry.get("bytes") == len(data), f"byte-size mismatch: {relative}")
    check(entry.get("sha256") == sha256_bytes(data), f"SHA-256 mismatch: {relative}")
    blob = git_output(repository_root, "rev-parse", f"{baseline_commit}:{relative}")
    check(entry.get("git_blob_id") == blob, f"Git blob mismatch: {relative}")
    anchors = entry.get("anchors")
    check(isinstance(anchors, list) and anchors, f"anchors missing: {relative}")
    check(len(anchors) == len(set(anchors)), f"duplicate anchors: {relative}")
    for anchor in anchors:
        check(isinstance(anchor, str) and anchor, f"invalid anchor: {relative}")
        if anchor.startswith("$"):
            validate_json_anchor(data, anchor, f"{relative} > {anchor}")
        else:
            validate_text_anchor(data, anchor, f"{relative} > {anchor}")
    check(
        isinstance(entry.get("annotation"), str) and entry["annotation"],
        f"annotation missing: {relative}",
    )
    return relative, set(anchors)


def validate_baseline(
    repository_root: Path, planning_workspace: Path
) -> tuple[dict[str, object], str, dict[str, set[str]]]:
    baseline_path = regular_file(repository_root, BASELINE_PATH)
    baseline = strict_json(baseline_path.read_bytes(), BASELINE_PATH)
    check(isinstance(baseline, dict), "authority baseline must be an object")
    check(
        set(baseline)
        == {
            "schema_version",
            "package",
            "repository_path",
            "path_aliases",
            "baseline_git_commit",
            "authority_contract",
            "authority_files",
            "sequencing_context_files",
            "workflow_contract",
        },
        "authority baseline top-level shape mismatch",
    )
    check(
        baseline.get("schema_version") == "fcs-package3-authority-baseline-v2",
        "authority baseline schema mismatch",
    )
    check(
        baseline.get("repository_path") == "<REPOSITORY_ROOT>",
        "repository alias mismatch",
    )
    expected_aliases = {
        "<REPOSITORY_ROOT>": "--repository-root",
        "<PLANNING_WORKSPACE>": "--planning-workspace",
    }
    check(baseline.get("path_aliases") == expected_aliases, "path aliases mismatch")
    baseline_commit = baseline.get("baseline_git_commit")
    check(
        baseline_commit == BASELINE_GIT_COMMIT,
        "authority baseline commit mismatch",
    )

    authority = baseline.get("authority_files")
    sequencing = baseline.get("sequencing_context_files")
    check(isinstance(authority, list) and len(authority) == 28, "authority file count must be 28")
    check(isinstance(sequencing, list) and len(sequencing) == 2, "sequencing file count must be 2")
    source_anchors: dict[str, set[str]] = {}
    for entry in authority:
        check(isinstance(entry, dict), "authority entry must be an object")
        relative, anchors = validate_source(repository_root, baseline_commit, entry, True)
        check(relative not in source_anchors, "duplicate authority path")
        source_anchors[relative] = anchors
    for entry in sequencing:
        check(isinstance(entry, dict), "sequencing entry must be an object")
        relative, anchors = validate_source(repository_root, baseline_commit, entry, False)
        check(relative not in source_anchors, "duplicate authority path")
        source_anchors[relative] = anchors
    check(
        [entry.get("path") for entry in authority[:2]] == ["AGENTS.md", "START_HERE.md"],
        "root authority order mismatch",
    )
    ordered = [entry for entry in authority if entry.get("read_order") is not None]
    check(
        [entry.get("read_order") for entry in ordered] == list(range(1, 27)),
        "mandatory read-order numbers mismatch",
    )
    start_text = regular_file(repository_root, "START_HERE.md").read_text(encoding="utf-8")
    mandatory_block = start_text.split("## Mandatory read order", 1)[1].split(
        "## Authority order", 1
    )[0]
    mandatory_paths = re.findall(r"^[0-9]+\. `([^`]+)`$", mandatory_block, re.MULTILINE)
    check(
        [entry.get("path") for entry in ordered] == mandatory_paths,
        "mandatory read-order paths mismatch",
    )
    check(
        {entry.get("path") for entry in sequencing}
        == {"docs/evidence/EXECUTION_STATE.md", "docs/evidence/EXECUTION_STATE.json"},
        "sequencing paths mismatch",
    )

    workflow = baseline.get("workflow_contract")
    check(isinstance(workflow, dict), "workflow contract must be an object")
    check(
        set(workflow)
        == {
            "source_type",
            "path",
            "git_blob_id",
            "sha256",
            "bytes",
            "package_3_relevance",
            "anchors",
            "annotation",
        },
        "workflow contract shape mismatch",
    )
    workflow_alias = f"<PLANNING_WORKSPACE>/{WORKFLOW_SUFFIX}"
    check(workflow.get("path") == workflow_alias, "workflow alias path mismatch")
    check(workflow.get("git_blob_id") is None, "external workflow Git blob must be null")
    workflow_path = regular_file(planning_workspace, WORKFLOW_SUFFIX, workflow_alias)
    workflow_data = workflow_path.read_bytes()
    check(workflow.get("bytes") == len(workflow_data), "workflow byte-size mismatch")
    check(workflow.get("sha256") == sha256_bytes(workflow_data), "workflow SHA-256 mismatch")
    workflow_anchors = workflow.get("anchors")
    check(isinstance(workflow_anchors, list) and workflow_anchors, "workflow anchors missing")
    check(len(workflow_anchors) == len(set(workflow_anchors)), "duplicate workflow anchors")
    for anchor in workflow_anchors:
        check(isinstance(anchor, str) and anchor, "invalid workflow anchor")
        validate_text_anchor(workflow_data, anchor, f"{workflow_alias} > {anchor}")
    source_anchors[workflow_alias] = set(workflow_anchors)
    check(
        sum(len(anchors) for anchors in source_anchors.values()) == 158,
        "authority anchor count must be 158",
    )
    baseline_hash = sha256_file(baseline_path)
    receipt = regular_file(repository_root, RECEIPT_PATH)
    check(
        receipt.read_bytes() == f"{baseline_hash}  {BASELINE_PATH}\n".encode(),
        "authority baseline receipt mismatch",
    )
    return baseline, baseline_hash, source_anchors


def code_span_references(cell: str) -> list[str]:
    double = re.findall(r"`` (.+?) ``", cell)
    remainder = re.sub(r"`` .+? ``", "", cell)
    return double + re.findall(r"`([^`]+)`", remainder)


def specification_sections(text: str) -> tuple[list[str], list[str]]:
    lines = markdown_line_states(text)
    requirements = [
        index
        for index, (line, fenced) in enumerate(lines)
        if not fenced and re.fullmatch(r" {0,3}## Requirements(?:\s.*)?", line)
    ]
    source_maps = [
        index
        for index, (line, fenced) in enumerate(lines)
        if not fenced
        and re.fullmatch(r" {0,3}## Requirement Source Map(?:\s.*)?", line)
    ]
    check(
        len(requirements) == 1,
        "Requirements section must appear exactly once, outside fences",
    )
    check(
        len(source_maps) == 1,
        "Requirement Source Map must appear exactly once, outside fences",
    )
    requirement_index = requirements[0]
    source_map_index = source_maps[0]
    check(
        lines[requirement_index] == ("## Requirements *(mandatory)*", False),
        "Requirements section heading is not canonical",
    )
    check(
        lines[source_map_index] == ("## Requirement Source Map", False),
        "Requirement Source Map heading is not canonical",
    )
    second_level = [
        (index, line)
        for index, (line, fenced) in enumerate(lines)
        if not fenced and re.match(r"^##(?!#)\s", line)
    ]
    requirement_position = next(
        index
        for index, (line_index, _) in enumerate(second_level)
        if line_index == requirement_index
    )
    check(
        requirement_position + 2 < len(second_level)
        and second_level[requirement_position + 1]
        == (source_map_index, "## Requirement Source Map")
        and second_level[requirement_position + 2][1]
        == "## Success Criteria *(mandatory)*",
        "Requirements, source map, and success criteria are not canonically ordered",
    )
    success_index = second_level[requirement_position + 2][0]
    requirement_lines: list[str] = []
    for index, (line, fenced) in enumerate(lines):
        if not P3_SYNTAX_PATTERN.search(line):
            continue
        check(not fenced, "P3 syntax is not allowed inside a Markdown fence")
        if requirement_index < index < source_map_index:
            check(
                REQUIREMENT_PATTERN.fullmatch(line) is not None,
                "P3 requirement syntax must be canonical and unindented",
            )
            requirement_lines.append(line)
        elif source_map_index < index < success_index:
            check(
                SOURCE_ROW_PATTERN.fullmatch(line) is not None,
                "P3 source-map syntax must be canonical and unindented",
            )
        else:
            raise ValidationError("P3 syntax exists outside its canonical section")
    table_lines = [
        line
        for line, fenced in lines[source_map_index + 1 : success_index]
        if not fenced and line.startswith("|")
    ]
    return requirement_lines, table_lines


def validate_specification(
    repository_root: Path,
    baseline_hash: str,
    source_anchors: dict[str, set[str]],
) -> tuple[str, str]:
    spec_path = regular_file(repository_root, SPEC_PATH)
    spec_text = spec_path.read_text(encoding="utf-8")
    check(
        spec_text.count(f"**Authority Baseline SHA-256**: `{baseline_hash}`") == 1,
        "specification baseline-hash reference mismatch",
    )
    requirement_lines, table_lines = specification_sections(spec_text)
    check(len(requirement_lines) == 62, "requirement count must be 62")
    definitions: list[tuple[str, str]] = []
    definition_lines: dict[str, str] = {}
    for line in requirement_lines:
        match = REQUIREMENT_PATTERN.fullmatch(line)
        check(match is not None, "malformed Package 3 requirement")
        requirement_id, category = match.groups()
        definitions.append((requirement_id, category))
        definition_lines[requirement_id] = line
    requirement_ids = [requirement_id for requirement_id, _ in definitions]
    check(len(requirement_ids) == 62, "requirement count must be 62")
    check(len(set(requirement_ids)) == 62, "requirement IDs must be unique")
    counts = Counter(category for _, category in definitions)
    check(dict(counts) == EXPECTED_CATEGORY_COUNTS, "requirement category counts mismatch")
    expected_ids = {
        f"P3-{category}-{number:03d}"
        for category, count in EXPECTED_CATEGORY_COUNTS.items()
        for number in range(1, count + 1)
    }
    check(set(requirement_ids) == expected_ids, "requirement ID set mismatch")

    check(len(table_lines) == 64, "source-map table must contain exactly 62 data rows")
    check(
        table_lines[:2]
        == [
            "| Requirement ID | Controlling source path and heading anchor(s) |",
            "|---|---|",
        ],
        "source-map table header mismatch",
    )
    rows: list[tuple[str, str]] = []
    for line in table_lines[2:]:
        match = SOURCE_ROW_PATTERN.fullmatch(line)
        check(match is not None, "malformed source-map data row")
        rows.append(match.groups())
    row_ids = [requirement_id for requirement_id, _ in rows]
    check(len(row_ids) == 62, "source-map row count must be 62")
    check(len(set(row_ids)) == 62, "source-map IDs must be unique")
    check(set(row_ids) == expected_ids, "source-map ID set mismatch")
    for requirement_id, cell in rows:
        references = code_span_references(cell)
        check(references, f"source-map row has no references: {requirement_id}")
        for reference in references:
            source_path, separator, anchor = reference.partition(" > ")
            check(separator == " > ", f"source-map reference malformed: {requirement_id}")
            check(source_path in source_anchors, f"source-map path missing: {requirement_id}")
            check(anchor in source_anchors[source_path], f"source-map anchor missing: {requirement_id}")
    for requirement_id, required_phrases in VERIFIER_BEHAVIORS.items():
        for phrase in required_phrases:
            check(
                phrase in definition_lines[requirement_id],
                f"verifier behavior semantics missing: {requirement_id}",
            )
    check(MUTATION_IDS <= set(requirement_ids), "mutation ID set incomplete")
    for requirement_id, required_phrases in MUTATION_REQUIREMENTS.items():
        for phrase in required_phrases:
            check(
                phrase in definition_lines[requirement_id],
                f"mutation semantics missing: {requirement_id}",
            )

    checklist_path = regular_file(repository_root, CHECKLIST_PATH)
    checklist_text = checklist_path.read_text(encoding="utf-8")
    check(len(re.findall(r"^- \[x\] ", checklist_text, re.MULTILINE)) == 16, "checklist must contain 16 passing items")
    check(not re.search(r"^- \[ \] ", checklist_text, re.MULTILINE), "checklist has an unchecked item")
    return sha256_file(spec_path), sha256_file(checklist_path)


def validate_rehash_log(
    repository_root: Path,
    baseline_hash: str,
    prompt_b_hashes: dict[str, str],
) -> str:
    log_path = regular_file(repository_root, REHASH_LOG_PATH)
    log = strict_json(log_path.read_bytes(), REHASH_LOG_PATH)
    check(isinstance(log, dict), "rehash log must be an object")
    check(
        set(log)
        == {
            "schema_version",
            "baseline_manifest",
            "baseline_sha256",
            "receipt",
            "receipt_sha256",
            "path_resolution",
            "supersedes",
            "artifact_sha256",
            "checks",
        },
        "rehash log top-level shape mismatch",
    )
    check(log.get("schema_version") == "fcs-package3-authority-rehash-log-v4", "rehash log schema mismatch")
    check(log.get("baseline_manifest") == BASELINE_PATH, "rehash log baseline path mismatch")
    check(log.get("baseline_sha256") == baseline_hash, "rehash log baseline hash mismatch")
    check(log.get("receipt") == RECEIPT_PATH, "rehash log receipt path mismatch")
    receipt_hash = sha256_file(regular_file(repository_root, RECEIPT_PATH))
    check(log.get("receipt_sha256") == receipt_hash, "rehash log receipt hash mismatch")
    check(
        log.get("path_resolution")
        == {
            "<REPOSITORY_ROOT>": "--repository-root",
            "<PLANNING_WORKSPACE>": "--planning-workspace",
        },
        "rehash log path-resolution contract mismatch",
    )
    artifact_hashes = log.get("artifact_sha256")
    check(artifact_hashes == prompt_b_hashes, "rehash log artifact hashes mismatch")
    supersedes = log.get("supersedes")
    check(isinstance(supersedes, dict) and supersedes, "rehash log supersedes record missing")
    check(
        all(isinstance(value, str) and HASH_PATTERN.fullmatch(value) for value in supersedes.values()),
        "rehash log superseded hashes invalid",
    )
    checks = log.get("checks")
    check(isinstance(checks, list) and len(checks) == 1, "rehash log must contain one repair check")
    repair = checks[0]
    check(isinstance(repair, dict), "rehash repair check must be an object")
    expected_values = {
        "phase": "prompt_b_checkpoint_binding_repair",
        "git_head": BASELINE_GIT_COMMIT,
        "baseline_sha256": baseline_hash,
        "receipt_sha256": receipt_hash,
        "prompt_a_managed_files_checked": 30,
        "authority_files_checked": 30,
        "workflow_contract_files_checked": 1,
        "source_anchors_checked": 158,
        "stable_requirements_checked": 62,
        "requirement_source_map": "PASS",
        "specification_checklist": "16/16 PASS",
        "strict_recursive_json_decoder": "PASS",
        "canonical_fence_aware_markdown_sections": "PASS",
        "validator_self_tests": "19/19 PASS",
        "working_state_validation": "PASS_EXPECTED_HEAD_PROHIBITED",
        "committed_state_contract": "CALLER_EXPECTED_HEAD_SINGLE_CHILD_OF_BASELINE_EXACT_SIX_FILES_CLEAN",
        "immutable_checkpoint": "CALLER_SUPPLIED_EXPECTED_HEAD_WITHOUT_EMBEDDED_COMMIT_SHA",
        "feature_pointer_contract": "PRESENT_EXACT_IGNORED_OR_ABSENT_IN_PRISTINE_COMMITTED_CLONE",
        "controlled_surface_scope": "SPEC_KIT_EVIDENCE_AND_SPECIFICATION",
        "ignored_secret_like_name_matches": 0,
        "local_path_references": 0,
        "unresolved_critical_high_findings": 0,
        "missing_controlling_requirements": 0,
        "allowed_write_boundary": "PASS",
        "main_checkout": "UNTOUCHED",
        "result": "PASS",
    }
    for key, value in expected_values.items():
        check(repair.get(key) == value, f"rehash repair check mismatch: {key}")
    check(
        set(repair) == set(expected_values) | {"checked_at"},
        "rehash repair check shape mismatch",
    )
    checked_at = repair.get("checked_at")
    check(
        isinstance(checked_at, str)
        and re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z", checked_at),
        "rehash repair timestamp invalid",
    )
    return sha256_file(log_path)


def validate_text_hygiene(repository_root: Path, feature_pointer_state: str) -> None:
    private_key_marker = "-----BEGIN " + "PRIVATE" + " KEY-----"
    placeholder_markers = (
        "TO" + "DO",
        "FIX" + "ME",
        "TK" + "TK",
        "NEEDS" + " CLARIFICATION",
        "{" + "{",
        "}" + "}",
    )
    allowed_aliases = {"<REPOSITORY_ROOT>", "<PLANNING_WORKSPACE>"}
    paths = set(PROMPT_B_VISIBLE_PATHS)
    if feature_pointer_state == "present_exact_ignored":
        paths.add(FEATURE_POINTER_PATH)
    for relative in sorted(paths):
        data = regular_file(repository_root, relative).read_bytes()
        check(b"\x00" not in data, f"NUL byte not allowed: {relative}")
        check(b"\r" not in data, f"carriage return not allowed: {relative}")
        check(data.endswith(b"\n"), f"final newline required: {relative}")
        for line in data.splitlines():
            check(line == line.rstrip(b" \t"), f"trailing whitespace: {relative}")
        try:
            text = data.decode("utf-8")
        except UnicodeError as exc:
            raise ValidationError(f"UTF-8 required: {relative}") from exc
        if relative.endswith(".json"):
            text += "\n" + json.dumps(
                strict_json(
                    regular_file(repository_root, relative).read_bytes(), relative
                ),
                ensure_ascii=False,
                indent=2,
            )
        portable = text.replace("<REPOSITORY_ROOT>/", "repository-root/").replace(
            "<PLANNING_WORKSPACE>/", "planning-workspace/"
        )
        check(
            ABSOLUTE_PATH_PATTERN.search(portable) is None,
            f"local absolute path not allowed: {relative}",
        )
        check(private_key_marker not in text, f"private key material found: {relative}")
        for pattern in SECRET_PATTERNS:
            check(pattern.search(text) is None, f"secret-like value found: {relative}")
        for marker in placeholder_markers:
            check(marker not in text, f"placeholder found: {relative}")
        aliases = set(re.findall(r"<[A-Z][A-Z0-9_]+>", text))
        check(aliases <= allowed_aliases, f"unknown path placeholder: {relative}")


def validate(
    repository_root: Path,
    planning_workspace: Path,
    state: str,
    expected_head: str | None,
) -> dict[str, object]:
    generated, head, feature_pointer_state, feature_pointer_hash = (
        validate_git_and_surfaces(repository_root, state, expected_head)
    )
    _, baseline_hash, source_anchors = validate_baseline(
        repository_root, planning_workspace
    )
    spec_hash, checklist_hash = validate_specification(
        repository_root, baseline_hash, source_anchors
    )
    prompt_b_hashes = {
        FEATURE_POINTER_PATH: feature_pointer_hash,
        SPEC_PATH: spec_hash,
        CHECKLIST_PATH: checklist_hash,
        VALIDATOR_PATH: sha256_file(regular_file(repository_root, VALIDATOR_PATH)),
    }
    rehash_log_hash = validate_rehash_log(
        repository_root, baseline_hash, prompt_b_hashes
    )
    validate_text_hygiene(repository_root, feature_pointer_state)
    return {
        "status": "PASS",
        "phase": "Prompt B checkpoint binding repair",
        "checkpoint_state": state,
        "checkpoint_head": head,
        "checkpoint_expected_head": expected_head,
        "checkpoint_actual_head": head,
        "feature_pointer_state": feature_pointer_state,
        "feature_pointer_expected_sha256": feature_pointer_hash,
        "runtime_paths_persisted": False,
        "prompt_a_managed_files": len(generated),
        "prompt_b_paths": len(PROMPT_B_PATHS),
        "repository_authority_and_sequencing_files": 30,
        "external_workflow_contract_files": 1,
        "anchors": 158,
        "requirements": 62,
        "source_map_rows": 62,
        "requirement_categories": EXPECTED_CATEGORY_COUNTS,
        "verifier_behaviors": [
            phrases[0].strip("`") for phrases in VERIFIER_BEHAVIORS.values()
        ],
        "mutation_ids": sorted(MUTATION_IDS),
        "baseline_sha256": baseline_hash,
        "receipt_sha256": sha256_file(regular_file(repository_root, RECEIPT_PATH)),
        "rehash_log_sha256": rehash_log_hash,
        "spec_sha256": spec_hash,
        "checklist_sha256": checklist_hash,
        "validator_sha256": prompt_b_hashes[VALIDATOR_PATH],
        "controlled_surfaces": [
            ".agents",
            ".specify",
            "docs/evidence/spec-kit",
            "specs/001-package-3-raw-observer-verifier",
        ],
        "controlled_surface_symlinks": 0,
        "prompt_b_artifact_secret_matches": 0,
        "ignored_secret_like_name_matches": 0,
        "prompt_b_placeholders": 0,
        "prompt_b_local_absolute_paths": 0,
        "forbidden_feature_files": 0,
    }


def expect_self_test_failure(name: str, action, expected: str) -> str:
    try:
        action()
    except ValidationError as exc:
        check(
            expected in str(exc),
            f"self-test {name} failed for the wrong reason: {exc}",
        )
        return name
    raise ValidationError(f"self-test did not reject: {name}")


def run_self_tests(
    repository_root: Path, planning_workspace: Path, state: str
) -> list[str]:
    passed = [
        expect_self_test_failure(
            "ordinary-duplicate-json-key",
            lambda: strict_json(
                b'{"outer":{"key":1,"key":2}' + b"}", "fixture"
            ),
            "duplicate decoded JSON key",
        ),
        expect_self_test_failure(
            "unicode-duplicate-json-key",
            lambda: strict_json(
                b'{"outer":{"key":1,"k\\u0065y":2}' + b"}", "fixture"
            ),
            "duplicate decoded JSON key",
        ),
    ]
    with tempfile.TemporaryDirectory(prefix="fcs-prompt-b-self-test-") as temporary:
        temporary_root = Path(temporary).resolve()
        fixture = temporary_root / "pristine"
        clone = subprocess.run(
            [
                "git",
                "clone",
                "--quiet",
                "--no-local",
                "--no-hardlinks",
                "--single-branch",
                "--branch",
                EXPECTED_BRANCH,
                str(repository_root),
                str(fixture),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        check(clone.returncode == 0, "self-test no-hardlinks clone failed")
        if state == "working":
            for relative in PROMPT_B_VISIBLE_PATHS:
                target = fixture / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(regular_file(repository_root, relative), target)
            add = git_result(fixture, "add", "--", *sorted(PROMPT_B_VISIBLE_PATHS))
            check(add.returncode == 0, "self-test checkpoint staging failed")
            commit = git_result(
                fixture,
                "-c",
                "user.name=Prompt B Self Test",
                "-c",
                "user.email=self-test.invalid@example.invalid",
                "-c",
                "commit.gpgsign=false",
                "commit",
                "-m",
                CHECKPOINT_COMMIT_MESSAGE,
            )
            check(commit.returncode == 0, "self-test checkpoint commit failed")

        trusted_head = git_output(fixture, "rev-parse", "HEAD")
        check(COMMIT_PATTERN.fullmatch(trusted_head) is not None, "self-test HEAD invalid")
        passed.append(
            expect_self_test_failure(
                "committed-missing-expected-head",
                lambda: validate_repository_state(fixture, "committed", None),
                "--expected-head is required for committed mode",
            )
        )
        wrong_head = "0" * 40 if trusted_head != "0" * 40 else "1" * 40
        passed.append(
            expect_self_test_failure(
                "committed-wrong-expected-head",
                lambda: validate_repository_state(
                    fixture, "committed", wrong_head
                ),
                f"expected={wrong_head}, actual={trusted_head}",
            )
        )
        passed.append(
            expect_self_test_failure(
                "working-expected-head-prohibited",
                lambda: validate_repository_state(
                    fixture, "working", trusted_head
                ),
                "--expected-head is prohibited in working mode",
            )
        )

        pristine_result = validate(
            fixture, planning_workspace, "committed", trusted_head
        )
        check(
            pristine_result["feature_pointer_state"]
            == "absent_expected_in_pristine_clone",
            "pristine committed clone did not report absent pointer state",
        )
        passed.append("pristine-committed-pointer-absent")

        pointer_path = fixture / FEATURE_POINTER_PATH
        pointer_path.write_bytes(EXPECTED_FEATURE_POINTER)
        present_result = validate(
            fixture, planning_workspace, "committed", trusted_head
        )
        check(
            present_result["feature_pointer_state"] == "present_exact_ignored",
            "present feature pointer did not report exact ignored state",
        )
        passed.append("present-exact-ignored-pointer")
        pointer_path.write_bytes(EXPECTED_FEATURE_POINTER + b" ")
        passed.append(
            expect_self_test_failure(
                "present-pointer-byte-mismatch",
                lambda: validate(
                    fixture, planning_workspace, "committed", trusted_head
                ),
                "feature pointer byte content mismatch",
            )
        )
        pointer_path.write_bytes(EXPECTED_FEATURE_POINTER)

        sibling = temporary_root / "sibling"
        sibling_clone = subprocess.run(
            [
                "git",
                "clone",
                "--quiet",
                "--no-local",
                "--no-hardlinks",
                "--single-branch",
                "--branch",
                EXPECTED_BRANCH,
                str(fixture),
                str(sibling),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        check(sibling_clone.returncode == 0, "self-test sibling clone failed")
        sibling_spec = regular_file(sibling, SPEC_PATH)
        sibling_spec_bytes = sibling_spec.read_bytes()
        weakened = sibling_spec_bytes.replace(
            b"MUST NOT be recorded as passing implementation",
            b"SHOULD NOT be recorded as passing implementation",
            1,
        )
        check(weakened != sibling_spec_bytes, "self-test weakening mutation failed")
        sibling_spec.write_bytes(weakened)
        sibling_log_path = regular_file(sibling, REHASH_LOG_PATH)
        sibling_log = strict_json(
            sibling_log_path.read_bytes(), REHASH_LOG_PATH
        )
        check(isinstance(sibling_log, dict), "self-test sibling log invalid")
        sibling_hashes = sibling_log.get("artifact_sha256")
        check(isinstance(sibling_hashes, dict), "self-test sibling hashes invalid")
        sibling_hashes[SPEC_PATH] = sha256_bytes(weakened)
        sibling_log_path.write_text(
            json.dumps(sibling_log, indent=2) + "\n", encoding="utf-8"
        )
        sibling_add = git_result(
            sibling, "add", "--", SPEC_PATH, REHASH_LOG_PATH
        )
        check(sibling_add.returncode == 0, "self-test sibling staging failed")
        sibling_commit = git_result(
            sibling,
            "-c",
            "user.name=Prompt B Self Test",
            "-c",
            "user.email=self-test.invalid@example.invalid",
            "-c",
            "commit.gpgsign=false",
            "commit",
            "--amend",
            "--no-edit",
        )
        check(sibling_commit.returncode == 0, "self-test sibling amend failed")
        sibling_head = git_output(sibling, "rev-parse", "HEAD")
        check(sibling_head != trusted_head, "self-test sibling HEAD did not change")
        validate(sibling, planning_workspace, "committed", sibling_head)
        passed.append(
            expect_self_test_failure(
                "replacement-sibling-trusted-head",
                lambda: validate(
                    sibling, planning_workspace, "committed", trusted_head
                ),
                f"expected={trusted_head}, actual={sibling_head}",
            )
        )

        _, baseline_hash, source_anchors = validate_baseline(
            fixture, planning_workspace
        )
        spec_path = regular_file(fixture, SPEC_PATH)
        checklist_path = regular_file(fixture, CHECKLIST_PATH)
        baseline_path = regular_file(fixture, BASELINE_PATH)
        spec_bytes = spec_path.read_bytes()
        checklist_bytes = checklist_path.read_bytes()
        baseline_bytes = baseline_path.read_bytes()

        decoy = (
            b"```markdown\n"
            b"## Requirements *(mandatory)*\n"
            b"- **P3-HIDDEN-001**: fenced decoy.\n"
            b"## Requirement Source Map\n"
            b"| P3-HIDDEN-001 | `AGENTS.md > Scope and authority` |\n"
            b"```\n\n"
        )
        spec_path.write_bytes(
            spec_bytes.replace(
                b"## Requirements *(mandatory)*",
                decoy + b"## Requirements *(mandatory)*",
                1,
            )
        )
        passed.append(
            expect_self_test_failure(
                "fenced-decoy-sections",
                lambda: validate_specification(
                    fixture, baseline_hash, source_anchors
                ),
                "P3 syntax is not allowed inside a Markdown fence",
            )
        )
        spec_path.write_bytes(spec_bytes)

        heading_decoy = (
            b"```markdown\n"
            b"## Requirements *(mandatory)*\n"
            b"decoy without controlled syntax\n"
            b"## Requirement Source Map\n"
            b"```\n\n"
        )
        spec_path.write_bytes(
            spec_bytes.replace(
                b"## Requirements *(mandatory)*",
                heading_decoy + b"## Requirements *(mandatory)*",
                1,
            )
        )
        validate_specification(fixture, baseline_hash, source_anchors)
        passed.append("fenced-non-P3-headings-ignored")
        spec_path.write_bytes(spec_bytes)

        spec_path.write_bytes(
            spec_bytes.replace(
                b"\n### Key Entities",
                b"\n  - **P3-HIDDEN-001**: indented hidden requirement.\n\n### Key Entities",
                1,
            )
        )
        passed.append(
            expect_self_test_failure(
                "indented-hidden-requirement",
                lambda: validate_specification(
                    fixture, baseline_hash, source_anchors
                ),
                "P3 requirement syntax must be canonical and unindented",
            )
        )
        spec_path.write_bytes(spec_bytes)

        spec_path.write_bytes(
            spec_bytes.replace(
                b"first `focusin` after `dialog_open`", b"an unrelated event", 1
            )
        )
        passed.append(
            expect_self_test_failure(
                "altered-verifier-semantics",
                lambda: validate_specification(
                    fixture, baseline_hash, source_anchors
                ),
                "verifier behavior semantics missing: P3-VER-004",
            )
        )
        spec_path.write_bytes(spec_bytes)

        extra = fixture / "docs/evidence/spec-kit/EXTRA.txt"
        extra.write_text("extra controlled file\n", encoding="utf-8")
        passed.append(
            expect_self_test_failure(
                "extra-controlled-surface-file",
                lambda: validate_evidence_surface(fixture),
                "spec-kit evidence surface differs",
            )
        )
        extra.unlink()

        for relative in (
            ".env.self-test",
            "private.pem",
            "node_modules/credentials.json",
            "node_modules/certificate.crt",
            "node_modules/id_ecdsa",
        ):
            secret_file = fixture / relative
            secret_file.parent.mkdir(parents=True, exist_ok=True)
            secret_file.write_text("not-a-secret\n", encoding="utf-8")
            check(
                git_result(fixture, "check-ignore", "-q", "--", relative).returncode
                == 0,
                f"self-test secret-like fixture is not ignored: {relative}",
            )
            expect_self_test_failure(
                "ignored-secret-like-file",
                lambda: validate_ignored_secret_files(fixture),
                "ignored secret-like file is not allowed",
            )
            secret_file.unlink()
        passed.append("ignored-secret-like-files")

        baseline = strict_json(baseline_bytes, BASELINE_PATH)
        baseline["authority_files"][0]["anchors"][0] = "body-only decoy anchor"
        baseline_path.write_text(
            json.dumps(baseline, indent=2) + "\n", encoding="utf-8"
        )
        passed.append(
            expect_self_test_failure(
                "invalid-structural-anchor",
                lambda: validate_baseline(fixture, planning_workspace),
                "missing structural anchor",
            )
        )
        baseline_path.write_bytes(baseline_bytes)

        checklist_path.write_bytes(
            checklist_bytes + b"/" + b"Users/example/private\n"
        )
        passed.append(
            expect_self_test_failure(
                "local-absolute-path",
                lambda: validate_text_hygiene(
                    fixture, "present_exact_ignored"
                ),
                "local absolute path not allowed",
            )
        )
        checklist_path.write_bytes(checklist_bytes)

        for filename, label in (("plan.md", "forbidden-plan"), ("tasks.md", "forbidden-tasks")):
            forbidden = fixture / "specs/001-package-3-raw-observer-verifier" / filename
            forbidden.write_text("forbidden\n", encoding="utf-8")
            passed.append(
                expect_self_test_failure(
                    label,
                    lambda: validate_feature_surface(fixture),
                    "specs surface differs",
                )
            )
            forbidden.unlink()

        validate_baseline(fixture, planning_workspace)
        validate_specification(fixture, baseline_hash, source_anchors)
        validate_text_hygiene(fixture, "present_exact_ignored")
    return passed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate the strict Focus Contract Studio Prompt B evidence surface."
    )
    parser.add_argument("--repository-root", required=True)
    parser.add_argument("--planning-workspace", required=True)
    parser.add_argument("--state", choices=VALIDATION_STATES, default="working")
    parser.add_argument(
        "--expected-head",
        metavar="40_HEX_SHA",
        help="Required in committed mode and prohibited in working mode.",
    )
    parser.add_argument("--self-test", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        result = validate(
            runtime_root(args.repository_root, "<REPOSITORY_ROOT>"),
            runtime_root(args.planning_workspace, "<PLANNING_WORKSPACE>"),
            args.state,
            args.expected_head,
        )
        if args.self_test:
            tests = run_self_tests(
                runtime_root(args.repository_root, "<REPOSITORY_ROOT>"),
                runtime_root(args.planning_workspace, "<PLANNING_WORKSPACE>"),
                args.state,
            )
            result["self_tests"] = tests
            result["self_test_count"] = len(tests)
    except ValidationError as exc:
        print(json.dumps({"status": "FAIL", "errors": [str(exc)]}, indent=2))
        return 1
    except Exception:
        print(
            json.dumps(
                {"status": "FAIL", "errors": ["unexpected validator error"]},
                indent=2,
            )
        )
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
