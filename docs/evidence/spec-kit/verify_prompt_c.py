from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import stat
import subprocess
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path, PurePosixPath


PROMPT_B_CHECKPOINT = "f78c9d4cafa35e48172d269fe40922ffc634ddac"
PROMPT_B_PARENT = "cb75d76e0cfd91534e27ea1ce6a2f192423d99c7"
EXPECTED_BRANCH = "feat/package-3-raw-observer-verifier"
PROMPT_C_MESSAGE = "docs: complete Package 3 Prompt C planning"
FEATURE_DIR = "specs/001-package-3-raw-observer-verifier"
SPEC_PATH = f"{FEATURE_DIR}/spec.md"
REQUIREMENTS_CHECKLIST_PATH = f"{FEATURE_DIR}/checklists/requirements.md"
GATE4_PATH = f"{FEATURE_DIR}/checklists/gate4.md"
TASKS_PATH = f"{FEATURE_DIR}/tasks.md"
PLAN_PATH = f"{FEATURE_DIR}/plan.md"
TRACE_PATH = f"{FEATURE_DIR}/traceability.json"
PREFLIGHT_PATH = "docs/evidence/spec-kit/PACKAGE3_PROMPT_C_PREFLIGHTS.json"
ANALYSIS_PATH = "docs/evidence/spec-kit/PACKAGE3_PROMPT_C_ANALYSIS.md"
MANIFEST_PATH = "docs/evidence/spec-kit/PACKAGE3_PROMPT_C_MANIFEST.json"
VALIDATION_PATH = "docs/evidence/spec-kit/PACKAGE3_PROMPT_C_VALIDATION.json"
VALIDATOR_PATH = "docs/evidence/spec-kit/verify_prompt_c.py"
BASELINE_PATH = "docs/evidence/spec-kit/PACKAGE3_AUTHORITY_BASELINE.json"
GENERATED_HASHES_PATH = "docs/evidence/spec-kit/GENERATED_FILES.sha256"
FEATURE_POINTER_PATH = ".specify/feature.json"
EXPECTED_POINTER = (
    b'{\n  "feature_directory": "specs/001-package-3-raw-observer-verifier"\n}\n'
)
EXPECTED_SOURCE_SNAPSHOT = (
    "913c74105fda6ced6d2e632669890786a22591c8df3b25f4130959d5f4a54188"
)
EXPECTED_CATEGORY_COUNTS = {
    "AUT": 5,
    "OBS": 11,
    "VER": 16,
    "SEC": 10,
    "MUT": 7,
    "EVD": 13,
}
EXPECTED_SKILLS = (
    "$speckit-plan",
    "$speckit-checklist",
    "$speckit-tasks",
    "$speckit-analyze",
)
BEHAVIORS = (
    "initialFocus",
    "focusOrder",
    "trapTab",
    "trapShiftTab",
    "escapeAction",
    "returnFocus",
)
BEHAVIOR_REQUIREMENTS = dict(
    zip(BEHAVIORS, (f"P3-VER-{number:03d}" for number in range(4, 10)), strict=True)
)
MUTATION_IDS = tuple(f"P3-MUT-{number:03d}" for number in range(1, 8))
SELF_TESTS = (
    "ordinary-duplicate-json-key",
    "unicode-duplicate-json-key",
    "missing-trace-mapping",
    "duplicate-requirement-id",
    "orphan-task",
    "missing-test-predecessor",
    "checked-implementation-task",
    "missing-verifier-behavior",
    "missing-mutation-coverage",
    "authority-drift",
    "unauthorized-path",
    "forged-clean-analysis",
)

PROMPT_B_IDENTITIES = {
    "docs/evidence/spec-kit/PACKAGE3_AUTHORITY_BASELINE.json": (
        "eb2491238f82111a1cee3121a0276d2d7c748a771856659318409b57d61aaed0",
        22281,
        "34d24258ca31effda3e7c24826523ae459cbdf7c",
    ),
    "docs/evidence/spec-kit/PACKAGE3_AUTHORITY_BASELINE.sha256": (
        "4d5f2ac7da568037bf9dbe7696c7a2eab60242416ef524d765875f0c1a4cc00a",
        122,
        "d52f1de6a5c1eb12f4500021ab1979a9c51a1798",
    ),
    "docs/evidence/spec-kit/PACKAGE3_AUTHORITY_REHASH_LOG.json": (
        "d825fbe4e2fc9f8d67160496fc993461fe84dbd1cb7c407648e37f4538ccca57",
        3586,
        "c2cc54c967432e7ac90cc1e1fca4f7c716a2290f",
    ),
    SPEC_PATH: (
        "5fe820a27b5612904eaed1087eded6f6fdf6769c024aa040f32fe80c0cd72d25",
        43037,
        "c07e65b9703b7d023427d37096a2e6dd033efc35",
    ),
    REQUIREMENTS_CHECKLIST_PATH: (
        "f70b8f5decae6af5543e52fc82ec6171507e46aacc744c27d3b03b5423ffb7aa",
        3015,
        "97aa96632fcf8574ca2551fef4ed5e4f5dd1afee",
    ),
    "docs/evidence/spec-kit/verify_prompt_b.py": (
        "169a00c108509f2894919c63e302fab1ea62efe47ca3642c6a4c08802b463bd6",
        60111,
        "c026b81edb95193fe3c5507ce30630821398ea95",
    ),
    FEATURE_POINTER_PATH: (
        "0f6600dc3e0c4754d657ce7ee8997659520e40f22a7a6d78ae479767fec71869",
        71,
        "6a2c51da1ffa2e9bbaf1312f34827d9e8d48dc32",
    ),
}

PROMPT_C_FEATURE_PATHS = frozenset(
    {
        PLAN_PATH,
        f"{FEATURE_DIR}/research.md",
        f"{FEATURE_DIR}/data-model.md",
        f"{FEATURE_DIR}/quickstart.md",
        f"{FEATURE_DIR}/contracts/rehearsal-api.md",
        f"{FEATURE_DIR}/contracts/verifier.md",
        f"{FEATURE_DIR}/contracts/persistence.md",
        f"{FEATURE_DIR}/contracts/result-surface.md",
        GATE4_PATH,
        TASKS_PATH,
        TRACE_PATH,
    }
)
PROMPT_C_EVIDENCE_PATHS = frozenset(
    {PREFLIGHT_PATH, ANALYSIS_PATH, MANIFEST_PATH, VALIDATION_PATH, VALIDATOR_PATH}
)
PROMPT_C_PATHS = PROMPT_C_FEATURE_PATHS | PROMPT_C_EVIDENCE_PATHS

PLANNED_TARGET_PATHS = frozenset(
    {
        "tests/package3-node/source-evidence.test.ts",
        "package.json",
        "vitest.package3-node.config.ts",
        "vitest.package3.config.ts",
        "vitest.package3-dom.config.ts",
        "wrangler.package3.jsonc",
        "playwright.config.ts",
        "tests/package3/d1-vitest-setup.ts",
        "tests/package3-node/contracts.test.ts",
        "tests/package3-node/reference-boundary.test.ts",
        "lib/domain/focus-rehearsal.ts",
        "tests/package3/focus-rehearsal.test.ts",
        "db/package3-schema.ts",
        "db/schema.ts",
        "drizzle/0003_package3_raw_observer_verifier.sql",
        "drizzle/meta/_journal.json",
        "tests/package3/routes.test.ts",
        "tests/package3-dom/focus-contract-studio.test.tsx",
        "tests/package3-browser/rehearsal.spec.ts",
        "lib/server/focus-rehearsal.ts",
        "app/api/rehearsals/start/route.ts",
        "app/api/rehearsals/[rehearsalSessionId]/finalize/route.ts",
        "app/delete-account-dialog.tsx",
        "app/focus-contract-studio.tsx",
        "tests/package3-node/focus-event-verifier.test.ts",
        "tests/package3/verification-persistence.test.ts",
        "lib/domain/focus-event-verifier.ts",
        "lib/server/verify-focus-contract.ts",
        "app/api/verifications/route.ts",
        "tests/package3-node/privacy-scan.test.ts",
        "app/globals.css",
        "scripts/package3-source-manifest.mjs",
        "scripts/package3-evidence-binding.mjs",
        ".artifacts/test/unit.json",
        ".artifacts/test/d1.json",
        ".artifacts/test/component.json",
        ".artifacts/browser/playwright.json",
        ".artifacts/accessibility/axe.json",
        ".artifacts/test/verifier-independence.json",
        ".artifacts/test/coverage-summary.json",
        "docs/evidence/PACKAGE3_VERIFICATION.md",
        "docs/evidence/PACKAGE3_ADVERSARIAL_REVIEW.md",
    }
)

HASH_RE = re.compile(r"^[0-9a-f]{64}$")
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
REQ_RE = re.compile(r"^- \*\*(P3-([A-Z]+)-[0-9]{3})\*\*:\s+.+$")
SOURCE_ROW_RE = re.compile(r"^\| (P3-[A-Z]+-[0-9]{3}) \| (.+) \|$")
PLAN_ROW_RE = re.compile(r"^\| (P3-[A-Z]+-[0-9]{3}) \| ([^|]+) \| [^|]+ \|$")
TASK_RE = re.compile(r"^- \[ \] (T[0-9]{3})(?: \[P\])?(?: \[US[1-4]\])? (.+)$")
REQ_TOKEN_RE = re.compile(r"P3-(?:AUT|OBS|VER|SEC|MUT|EVD)-[0-9]{3}")
PATH_TOKEN_RE = re.compile(r"`([^`]+)`")


class ValidationError(RuntimeError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def strict_pairs(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValidationError(f"duplicate decoded JSON key: {key}")
        result[key] = value
    return result


def strict_json_text(text: str, label: str) -> object:
    try:
        return json.loads(text, object_pairs_hook=strict_pairs)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ValidationError(f"invalid JSON in {label}: {error}") from error


def strict_json(path: Path) -> object:
    return strict_json_text(path.read_text(encoding="utf-8"), str(path))


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob(data: bytes) -> str:
    header = f"blob {len(data)}\0".encode()
    return hashlib.sha1(header + data, usedforsecurity=False).hexdigest()


def git(repository: Path, *arguments: str, binary: bool = False) -> str | bytes:
    result = subprocess.run(
        ["git", "-C", str(repository), *arguments],
        capture_output=True,
        text=not binary,
        check=False,
    )
    if result.returncode != 0:
        error = result.stderr.decode() if binary else result.stderr
        raise ValidationError(f"git {' '.join(arguments)} failed: {error.strip()}")
    return result.stdout


def safe_relative_path(value: str) -> PurePosixPath:
    path = PurePosixPath(value)
    require(value and not path.is_absolute() and ".." not in path.parts, f"unsafe path: {value}")
    require("\\" not in value and "\x00" not in value, f"non-portable path: {value}")
    return path


def read_regular(repository: Path, relative: str) -> bytes:
    safe_relative_path(relative)
    path = repository / relative
    require(path.exists(), f"missing file: {relative}")
    require(not path.is_symlink() and path.is_file(), f"not a regular file: {relative}")
    return path.read_bytes()


def identity(data: bytes) -> tuple[str, int, str]:
    return sha256(data), len(data), git_blob(data)


def parse_requirements(specification: str) -> tuple[list[str], dict[str, list[str]]]:
    requirements: list[str] = []
    categories: Counter[str] = Counter()
    source_map: dict[str, list[str]] = {}
    for line in specification.splitlines():
        match = REQ_RE.match(line)
        if match:
            requirements.append(match.group(1))
            categories[match.group(2)] += 1
        source_match = SOURCE_ROW_RE.match(line)
        if source_match:
            source_map[source_match.group(1)] = [
                anchor.strip().strip("`") for anchor in source_match.group(2).split("; ")
            ]
    require(len(requirements) == 62, "specification must contain 62 requirement definitions")
    require(len(set(requirements)) == 62, "duplicate specification requirement ID")
    require(dict(categories) == EXPECTED_CATEGORY_COUNTS, "requirement category count drift")
    require(list(source_map) == requirements, "source map must have one ordered row per requirement")
    return requirements, source_map


def parse_plan(plan: str, requirements: list[str]) -> dict[str, str]:
    rows: dict[str, str] = {}
    for line in plan.splitlines():
        match = PLAN_ROW_RE.match(line)
        if match:
            require(match.group(1) not in rows, "duplicate plan mapping")
            rows[match.group(1)] = match.group(2).strip().strip("`")
    require(list(rows) == requirements, "plan mappings must be exactly 62/62 in specification order")
    require("NEEDS " + "CLARIFICATION" not in plan, "plan contains unresolved clarification")
    return rows


def parse_tasks(tasks_text: str, requirements: list[str]) -> dict[str, dict[str, object]]:
    tasks: dict[str, dict[str, object]] = {}
    requirement_set = set(requirements)
    require(re.search(r"^- \[[xX]\] T", tasks_text, re.M) is None, "implementation task is marked complete")
    for line in tasks_text.splitlines():
        if not line.startswith("- [ ] T"):
            continue
        match = TASK_RE.match(line)
        require(match is not None, f"non-canonical task: {line}")
        task_id, body = match.groups()
        require(task_id not in tasks, f"duplicate task: {task_id}")
        requirement_ids = list(dict.fromkeys(REQ_TOKEN_RE.findall(body)))
        path_tokens = PATH_TOKEN_RE.findall(body)
        paths = [token for token in path_tokens if token in PLANNED_TARGET_PATHS]
        unknown_paths = [
            token
            for token in path_tokens
            if token not in PLANNED_TARGET_PATHS
            and ("/" in token or re.search(r"\.(?:ts|tsx|js|mjs|json|jsonc|md|sql)$", token))
        ]
        require(requirement_ids and set(requirement_ids) <= requirement_set, f"orphan task: {task_id}")
        require(paths and not unknown_paths, f"invalid target path in {task_id}")
        tasks[task_id] = {
            "line": line,
            "requirements": requirement_ids,
            "paths": paths,
            "test": "[TEST]" in body,
        }
    expected_ids = [f"T{number:03d}" for number in range(1, len(tasks) + 1)]
    require(list(tasks) == expected_ids and len(tasks) == 46, "tasks must be T001..T046")
    for task_id, task in tasks.items():
        line = str(task["line"])
        marker = re.search(r"\[IMPL tests=([^\]]+)\]", line)
        if not marker:
            continue
        predecessors = marker.group(1).split(",")
        require(predecessors, f"missing test predecessor: {task_id}")
        for predecessor in predecessors:
            require(predecessor in tasks, f"unknown test predecessor for {task_id}")
            require(int(predecessor[1:]) < int(task_id[1:]), f"late test predecessor for {task_id}")
            require(bool(tasks[predecessor]["test"]), f"non-test predecessor for {task_id}")
    for requirement in requirements:
        matching = [task for task in tasks.values() if requirement in task["requirements"]]
        require(matching, f"unmapped requirement in tasks: {requirement}")
        require(any(bool(task["test"]) for task in matching), f"no failing test task: {requirement}")
    return tasks


def expected_evidence(requirement: str) -> list[dict[str, str]]:
    category = requirement.split("-")[1]
    paths = {
        "E-006": ".artifacts/test/unit.json",
        "E-007": ".artifacts/test/d1.json",
        "E-008": ".artifacts/test/component.json",
        "E-009": ".artifacts/browser/playwright.json",
        "E-010": ".artifacts/accessibility/axe.json",
        "E-011": ".artifacts/test/verifier-independence.json",
        "E-014": ".artifacts/test/coverage-summary.json",
        "PROMPT-C": VALIDATION_PATH,
        "REVIEW": "docs/evidence/PACKAGE3_ADVERSARIAL_REVIEW.md",
    }
    if category == "AUT":
        ids = ("PROMPT-C", "E-011")
    elif category == "OBS":
        ids = ("E-006", "E-007", "E-009", "E-011")
    elif category == "VER":
        ids = ("E-006", "E-007", "E-011", "E-014")
    elif category == "SEC":
        ids = ("E-007", "E-011")
    elif category == "MUT":
        ids = ("E-006", "E-011")
    else:
        number = int(requirement.rsplit("-", 1)[1])
        mapping = {
            1: ("E-006", "E-011"),
            2: ("E-006", "E-011"),
            3: ("E-007",),
            4: ("E-011",),
            5: ("E-011",),
            6: ("E-009", "E-010"),
            7: ("E-008", "E-009"),
            8: ("E-014",),
            9: ("E-006", "E-007", "E-008", "E-009", "E-010", "E-011", "E-014"),
            10: ("REVIEW",),
            11: ("PROMPT-C",),
            12: ("E-006", "E-007"),
            13: ("E-007",),
        }
        ids = mapping[number]
    return [{"id": evidence_id, "path": paths[evidence_id]} for evidence_id in ids]


def validate_trace_data(
    trace: object,
    requirements: list[str],
    source_map: dict[str, list[str]],
    plan_map: dict[str, str],
    tasks: dict[str, dict[str, object]],
) -> None:
    require(isinstance(trace, dict), "traceability must be an object")
    require(trace.get("requirement_count") == 62, "trace requirement count")
    require(trace.get("requirement_category_counts") == EXPECTED_CATEGORY_COUNTS, "trace category counts")
    require(trace.get("verifier_behaviors") == list(BEHAVIORS), "missing verifier behavior")
    require(trace.get("mutation_ids") == list(MUTATION_IDS), "missing mutation coverage")
    rows = trace.get("rows")
    require(isinstance(rows, list) and len(rows) == 62, "trace must have 62 rows")
    row_ids = [row.get("requirement_id") if isinstance(row, dict) else None for row in rows]
    require(row_ids == requirements and len(set(row_ids)) == 62, "duplicate or missing trace ID")
    task_union: set[str] = set()
    for row in rows:
        requirement = row["requirement_id"]
        expected_tasks = [task_id for task_id, task in tasks.items() if requirement in task["requirements"]]
        expected_tests = [task_id for task_id in expected_tasks if tasks[task_id]["test"]]
        expected_targets: list[str] = []
        for task_id in expected_tasks:
            if not tasks[task_id]["test"]:
                expected_targets.extend(str(path) for path in tasks[task_id]["paths"])
        expected_targets = list(dict.fromkeys(expected_targets))
        require(row.get("authority_anchors") == source_map[requirement], f"authority anchor drift: {requirement}")
        require(row.get("spec_ref") == f"{SPEC_PATH} > Requirements > {requirement}", f"spec ref drift: {requirement}")
        require(row.get("design_refs") == [plan_map[requirement]], f"design ref drift: {requirement}")
        require(row.get("task_ids") == expected_tasks, f"task mapping drift: {requirement}")
        require(row.get("failing_test_task_ids") == expected_tests and expected_tests, f"test mapping drift: {requirement}")
        require(row.get("implementation_targets") == expected_targets and expected_targets, f"target mapping drift: {requirement}")
        require(row.get("verification_evidence") == expected_evidence(requirement), f"evidence mapping drift: {requirement}")
        task_union.update(expected_tasks)
    require(task_union == set(tasks), "orphan task outside traceability")


def validate_coverage(repository: Path, trace: dict[str, object]) -> None:
    verifier = read_regular(repository, f"{FEATURE_DIR}/contracts/verifier.md").decode()
    quickstart = read_regular(repository, f"{FEATURE_DIR}/quickstart.md").decode()
    rehearsal = read_regular(repository, f"{FEATURE_DIR}/contracts/rehearsal-api.md").decode()
    persistence = read_regular(repository, f"{FEATURE_DIR}/contracts/persistence.md").decode()
    result = read_regular(repository, f"{FEATURE_DIR}/contracts/result-surface.md").decode()
    for behavior in BEHAVIORS:
        require(behavior in verifier, f"verifier contract omits {behavior}")
        require(BEHAVIOR_REQUIREMENTS[behavior] in {row["requirement_id"] for row in trace["rows"]}, f"trace omits {behavior}")
    for mutation in MUTATION_IDS:
        require(mutation in verifier and mutation in trace["mutation_ids"], f"mutation omitted: {mutation}")
    for token in (
        "foreign and nonexistent",
        "response-size class",
        "timing budget",
        "CSRF",
        "no-store",
    ):
        require(token in rehearsal, f"request/isolation coverage missing: {token}")
    for token in ("guard", "finalizer", "rollback", "exactly six", "natural key"):
        require(token.lower() in persistence.lower(), f"atomicity coverage missing: {token}")
    for token in ("320 px", "375 px", "200% zoom", "axe", "background", "not_observed"):
        require(token in result or token in quickstart, f"accessibility coverage missing: {token}")
    for evidence_id in ("E-006", "E-007", "E-008", "E-009", "E-010", "E-011", "E-014"):
        require(evidence_id in quickstart, f"evidence destination missing: {evidence_id}")


def analysis_digest(repository: Path) -> str:
    paths = (
        ".specify/memory/constitution.md",
        SPEC_PATH,
        PLAN_PATH,
        TASKS_PATH,
    )
    content = "".join(
        f"{path}\0{sha256(read_regular(repository, path))}\n" for path in paths
    ).encode()
    return sha256(content)


def validate_analysis_text(text: str, expected_digest: str) -> None:
    require(text.startswith("## Specification Analysis Report\n"), "analysis header")
    require(f"**Analysis input SHA-256**: `{expected_digest}`" in text, "analysis input digest")
    require("- Total stable requirements: 62" in text, "analysis requirement count")
    require("- Buildable success criteria covered: 8/8" in text, "analysis success criteria")
    require("- Plan mappings: 62/62" in text, "analysis plan coverage")
    require("- Total tasks: 46" in text, "analysis task count")
    require("- Requirements with one or more tasks: 62/62 (100%)" in text, "analysis task coverage")
    require("- Unmapped tasks: 0" in text, "analysis orphan count")
    for severity in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
        require(f"- {severity} issues: 0" in text, f"analysis unresolved {severity}")
    require("No remediation is warranted." in text, "analysis still requests remediation")


def authority_path(repository: Path, planning: Path, persisted: str) -> Path:
    if persisted.startswith("<REPOSITORY_ROOT>/"):
        return repository / str(safe_relative_path(persisted.removeprefix("<REPOSITORY_ROOT>/")))
    if persisted.startswith("<PLANNING_WORKSPACE>/"):
        return planning / str(safe_relative_path(persisted.removeprefix("<PLANNING_WORKSPACE>/")))
    return repository / str(safe_relative_path(persisted))


def authority_snapshot(
    repository: Path,
    planning: Path,
    baseline: dict[str, object],
    overrides: dict[str, bytes] | None = None,
) -> tuple[str, int, int]:
    authority_files = baseline.get("authority_files")
    sequencing = baseline.get("sequencing_context_files")
    workflow = baseline.get("workflow_contract")
    require(isinstance(authority_files, list) and isinstance(sequencing, list), "baseline lists")
    require(isinstance(workflow, dict), "baseline workflow contract")
    entries = [*authority_files, *sequencing, workflow]
    require(len(entries) == 31, "authority source count")
    canonical: list[dict[str, object]] = []
    anchor_count = 0
    for entry in entries:
        require(isinstance(entry, dict), "authority entry")
        persisted = entry.get("path")
        require(isinstance(persisted, str), "authority path")
        data = (overrides or {}).get(persisted)
        if data is None:
            data = authority_path(repository, planning, persisted).read_bytes()
        require(sha256(data) == entry.get("sha256"), f"authority hash drift: {persisted}")
        require(len(data) == entry.get("bytes"), f"authority byte drift: {persisted}")
        expected_blob = entry.get("git_blob_id")
        blob = None if expected_blob is None else git_blob(data)
        require(blob == expected_blob, f"authority blob drift: {persisted}")
        anchors = entry.get("anchors")
        require(isinstance(anchors, list) and anchors, f"authority anchors missing: {persisted}")
        anchor_count += len(anchors)
        canonical.append(
            {"path": persisted, "sha256": sha256(data), "bytes": len(data), "git_blob_id": blob}
        )
    digest = sha256(
        json.dumps(canonical, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    )
    require(digest == EXPECTED_SOURCE_SNAPSHOT, "authority aggregate drift")
    require(anchor_count == 158, "authority anchor count drift")
    return digest, len(entries), anchor_count


def validate_prompt_a(repository: Path) -> int:
    manifest = read_regular(repository, GENERATED_HASHES_PATH)
    trusted = git(repository, "show", f"{PROMPT_B_CHECKPOINT}:{GENERATED_HASHES_PATH}", binary=True)
    require(manifest == trusted, "Prompt A hash manifest drift")
    entries: dict[str, str] = {}
    for line in manifest.decode().splitlines():
        match = re.fullmatch(r"([0-9a-f]{64})  (.+)", line)
        require(match is not None, "malformed Prompt A hash line")
        digest, path = match.groups()
        safe_relative_path(path)
        require(path not in entries, "duplicate Prompt A managed path")
        entries[path] = digest
    require(len(entries) == 30, "Prompt A managed file count")
    for path, digest in entries.items():
        require(sha256(read_regular(repository, path)) == digest, f"Prompt A drift: {path}")
    return len(entries)


def validate_prompt_b(repository: Path, state: str) -> str:
    parent = str(git(repository, "show", "-s", "--format=%P", PROMPT_B_CHECKPOINT)).strip()
    message = str(git(repository, "show", "-s", "--format=%s", PROMPT_B_CHECKPOINT)).strip()
    require(parent == PROMPT_B_PARENT, "Prompt B parent drift")
    require(message == "docs: complete Package 3 Prompt B specification", "Prompt B message drift")
    for path, expected in PROMPT_B_IDENTITIES.items():
        if path == FEATURE_POINTER_PATH and not (repository / path).exists():
            require(state == "committed", "working state requires feature pointer")
            continue
        data = read_regular(repository, path)
        require(identity(data) == expected, f"Prompt B identity drift: {path}")
        if path != FEATURE_POINTER_PATH:
            trusted = git(repository, "show", f"{PROMPT_B_CHECKPOINT}:{path}", binary=True)
            require(data == trusted, f"Prompt B checkpoint byte drift: {path}")
    pointer = repository / FEATURE_POINTER_PATH
    if pointer.exists():
        require(pointer.read_bytes() == EXPECTED_POINTER, "feature pointer content drift")
        ignored = subprocess.run(
            ["git", "-C", str(repository), "check-ignore", "-q", FEATURE_POINTER_PATH],
            check=False,
        )
        require(ignored.returncode == 0, "feature pointer is not ignored")
        return "present_exact_ignored"
    return "absent_pristine_committed_clone"


def validate_preflights(data: object, snapshot: str) -> None:
    require(isinstance(data, dict), "preflights must be an object")
    require(data.get("trusted_prompt_b_checkpoint") == PROMPT_B_CHECKPOINT, "preflight checkpoint")
    require(data.get("trusted_prompt_b_parent") == PROMPT_B_PARENT, "preflight parent")
    recorded = data.get("prompt_b_artifacts")
    require(isinstance(recorded, dict) and set(recorded) == set(PROMPT_B_IDENTITIES), "preflight Prompt B identities")
    for path, expected in PROMPT_B_IDENTITIES.items():
        require(
            recorded[path]
            == {"sha256": expected[0], "bytes": expected[1], "git_blob_id": expected[2]},
            f"preflight identity drift: {path}",
        )
    records = data.get("records")
    require(isinstance(records, list) and len(records) == 4, "four preflight records required")
    times: list[datetime] = []
    for index, (record, skill) in enumerate(zip(records, EXPECTED_SKILLS, strict=True), 1):
        require(isinstance(record, dict), "preflight record")
        require(record.get("sequence") == index and record.get("before_skill") == skill, "preflight order")
        require(record.get("git_head") == PROMPT_B_CHECKPOINT, "preflight head")
        require(record.get("baseline_sha256") == PROMPT_B_IDENTITIES[BASELINE_PATH][0], "preflight baseline")
        require(record.get("source_files_checked") == 31, "preflight source count")
        require(record.get("source_snapshot_sha256") == snapshot, "preflight source snapshot")
        require(record.get("prompt_b_artifact_identities_checked") == 7, "preflight artifact count")
        require(record.get("prompt_b_validator") == "PASS_19_OF_19", "preflight Prompt B validator")
        require(record.get("extensions_hooks_presets_bundles") == "ABSENT", "preflight extension state")
        require(record.get("result") == "PASS", "preflight failed")
        checked_at = record.get("checked_at")
        require(isinstance(checked_at, str) and checked_at.endswith("Z"), "preflight timestamp")
        times.append(datetime.fromisoformat(checked_at.removesuffix("Z") + "+00:00"))
    require(times == sorted(times) and len(set(times)) == 4, "preflight timestamps not strictly ordered")


def controlled_ignored(repository: Path) -> set[str]:
    output = str(
        git(
            repository,
            "ls-files",
            "--others",
            "--ignored",
            "--exclude-standard",
            "--",
            ".specify",
            FEATURE_DIR,
            "docs/evidence/spec-kit",
        )
    )
    return {line for line in output.splitlines() if line}


def require_prompt_c_surface(paths: set[str]) -> None:
    require(paths == set(PROMPT_C_PATHS), "Prompt C surface mismatch")


def validate_surface(repository: Path, state: str, expected_head: str | None) -> tuple[str, str]:
    top = Path(str(git(repository, "rev-parse", "--show-toplevel")).strip()).resolve()
    require(top == repository, "repository root argument is not the Git top level")
    head = str(git(repository, "rev-parse", "HEAD")).strip()
    branch = str(git(repository, "branch", "--show-current")).strip()
    if state == "working":
        require(expected_head is None, "working mode forbids --expected-head")
        require(head == PROMPT_B_CHECKPOINT and branch == EXPECTED_BRANCH, "working custody drift")
        require(str(git(repository, "diff", "--name-only")).strip() == "", "tracked working-tree drift")
        require(str(git(repository, "diff", "--cached", "--name-only")).strip() == "", "staged changes forbidden")
        untracked = set(str(git(repository, "ls-files", "--others", "--exclude-standard")).splitlines())
        require_prompt_c_surface(untracked)
    else:
        require(expected_head is not None and COMMIT_RE.fullmatch(expected_head), "committed mode requires literal --expected-head")
        require(head == expected_head, "committed head differs from explicit expected head")
        require(str(git(repository, "status", "--porcelain=v1", "--untracked-files=all")).strip() == "", "committed worktree not clean")
        parent = str(git(repository, "show", "-s", "--format=%P", "HEAD")).strip()
        message = str(git(repository, "show", "-s", "--format=%s", "HEAD")).strip()
        require(parent == PROMPT_B_CHECKPOINT and message == PROMPT_C_MESSAGE, "Prompt C commit ancestry/message")
        changed = set(str(git(repository, "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD")).splitlines())
        statuses = str(git(repository, "diff-tree", "--no-commit-id", "--name-status", "-r", "HEAD")).splitlines()
        require_prompt_c_surface(changed)
        require(all(line.startswith("A\t") for line in statuses), "Prompt C commit must only add files")
    require(controlled_ignored(repository) in ({FEATURE_POINTER_PATH}, set()), "unexpected ignored controlled-surface file")
    for forbidden in (
        ".specify/extensions.yml",
        ".specify/extensions",
        ".specify/presets",
        ".specify/bundles",
        ".specify/hooks",
        ".specify/event-hooks",
    ):
        require(not (repository / forbidden).exists(), f"extension/hook/preset/bundle present: {forbidden}")
    return head, branch or "DETACHED"


def validate_hygiene(repository: Path) -> None:
    private_tmp = "/private/" + "tmp"
    user_root = "/" + "Users/"
    file_scheme = "file:" + "//"
    placeholder_tokens = ("TO" + "DO", "TKT" + "K", "?" * 3, "NEEDS " + "CLARIFICATION")
    secret_patterns = (
        re.compile("-" * 5 + "BEGIN " + ".*PRIVATE KEY" + "-" * 5),
        re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
        re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"),
        re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    )
    for relative in PROMPT_C_PATHS:
        path = repository / relative
        require(path.exists() and path.is_file() and not path.is_symlink(), f"invalid Prompt C file: {relative}")
        require(not (path.stat().st_mode & (stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)), f"unexpected executable: {relative}")
        text = path.read_text(encoding="utf-8")
        require("\x00" not in text, f"control content: {relative}")
        require(user_root not in text and private_tmp not in text and file_scheme not in text, f"local absolute path: {relative}")
        require(not any(token in text for token in placeholder_tokens), f"placeholder: {relative}")
        require(not any(pattern.search(text) for pattern in secret_patterns), f"secret-like content: {relative}")
    secret_name = re.compile(r"(^|/)(\.env|credentials?|certificates?|id_(?:rsa|dsa|ecdsa|ed25519))(?:\.|$)|\.(?:pem|key|crt|cer|der|p12|pfx)$", re.I)
    require(not any(secret_name.search(path) for path in controlled_ignored(repository)), "ignored secret-like file")


def validate_checklist(text: str) -> int:
    items = re.findall(r"^- \[([ xX])\] (CHK[0-9]{3}) ", text, re.M)
    require(len(items) == 46, "Gate 4 checklist item count")
    require([item_id for _, item_id in items] == [f"CHK{number:03d}" for number in range(1, 47)], "Gate 4 checklist IDs")
    require(all(marker.lower() == "x" for marker, _ in items), "Gate 4 reviewer item remains unchecked")
    for role in ("architecture/code-path", "contract/security/privacy", "accessibility/testing/evidence"):
        require(f"{role} — final disposition: PASS; evidence:" in text, f"missing final PASS evidence: {role}")
    require("unresolved critical/high: 0" in text and "missing controlling requirements: 0" in text, "review reconciliation incomplete")
    return len(items)


def validate_validation_receipt(data: object) -> None:
    require(isinstance(data, dict), "validation receipt object")
    expected = {
        "schema_version": "fcs-package3-prompt-c-validation-v1",
        "phase": "PROMPT_C_GATE_4_PLANNING_ONLY",
        "trusted_prompt_b_checkpoint": PROMPT_B_CHECKPOINT,
        "commit_binding": "CALLER_SUPPLIED_EXPECTED_HEAD_NO_SELF_REFERENCE",
        "working_state": "PASS",
        "committed_state": "REQUIRES_CLEAN_HEAD_AND_LITERAL_EXPECTED_HEAD",
        "requirements": 62,
        "plan_mappings": 62,
        "trace_rows": 62,
        "tasks": 46,
        "checklist_items": 46,
        "analysis_critical": 0,
        "analysis_high": 0,
        "self_tests": list(SELF_TESTS),
        "product_implementation": "NOT_STARTED",
        "external_actions": "NONE",
        "result": "PASS",
    }
    require(data == expected, "validation receipt content drift")


def validate_manifest(repository: Path, data: object) -> None:
    require(isinstance(data, dict), "manifest object")
    require(data.get("schema_version") == "fcs-package3-prompt-c-manifest-v1", "manifest schema")
    require(data.get("trusted_prompt_b_checkpoint") == PROMPT_B_CHECKPOINT, "manifest checkpoint")
    artifacts = data.get("artifacts")
    expected_paths = set(PROMPT_C_PATHS) - {MANIFEST_PATH}
    require(isinstance(artifacts, dict) and set(artifacts) == expected_paths, "manifest path set")
    require(data.get("artifact_count") == len(expected_paths), "manifest artifact count")
    for relative in sorted(expected_paths):
        raw = read_regular(repository, relative)
        expected = {"sha256": sha256(raw), "bytes": len(raw), "git_blob_id": git_blob(raw)}
        require(artifacts[relative] == expected, f"manifest identity mismatch: {relative}")


def run_self_tests(
    repository: Path,
    planning: Path,
    baseline: dict[str, object],
    requirements: list[str],
    source_map: dict[str, list[str]],
    plan_map: dict[str, str],
    tasks_text: str,
    tasks: dict[str, dict[str, object]],
    trace: dict[str, object],
    analysis: str,
    digest: str,
) -> list[str]:
    passed: list[str] = []

    def rejected(name: str, operation) -> None:
        try:
            operation()
        except (ValidationError, json.JSONDecodeError):
            passed.append(name)
            return
        raise ValidationError(f"self-test did not fail closed: {name}")

    rejected("ordinary-duplicate-json-key", lambda: strict_json_text('{"a":1,"a":2}', "ordinary"))
    rejected("unicode-duplicate-json-key", lambda: strict_json_text('{"a":1,"\\u0061":2}', "unicode"))

    missing = copy.deepcopy(trace)
    missing["rows"].pop()
    missing["requirement_count"] = 61
    rejected(
        "missing-trace-mapping",
        lambda: validate_trace_data(missing, requirements, source_map, plan_map, tasks),
    )

    duplicate = copy.deepcopy(trace)
    duplicate["rows"][-1] = copy.deepcopy(duplicate["rows"][0])
    rejected(
        "duplicate-requirement-id",
        lambda: validate_trace_data(duplicate, requirements, source_map, plan_map, tasks),
    )

    orphan = copy.deepcopy(trace)
    orphan_row = next(row for row in orphan["rows"] if row["requirement_id"] == "P3-EVD-010")
    orphan_row["task_ids"].remove("T046")
    rejected(
        "orphan-task",
        lambda: validate_trace_data(orphan, requirements, source_map, plan_map, tasks),
    )

    predecessor_text = tasks_text.replace("[IMPL tests=T003,T004]", "[IMPL tests=T999]", 1)
    rejected("missing-test-predecessor", lambda: parse_tasks(predecessor_text, requirements))

    checked_text = tasks_text.replace("- [ ] T005", "- [x] T005", 1)
    rejected("checked-implementation-task", lambda: parse_tasks(checked_text, requirements))

    behavior = copy.deepcopy(trace)
    behavior["verifier_behaviors"].remove(BEHAVIORS[0])
    rejected(
        "missing-verifier-behavior",
        lambda: validate_trace_data(behavior, requirements, source_map, plan_map, tasks),
    )

    mutation = copy.deepcopy(trace)
    mutation["mutation_ids"].remove(MUTATION_IDS[-1])
    rejected(
        "missing-mutation-coverage",
        lambda: validate_trace_data(mutation, requirements, source_map, plan_map, tasks),
    )

    first_entry = baseline["authority_files"][0]
    first_path = first_entry["path"]
    altered = authority_path(repository, planning, first_path).read_bytes() + b"\n"
    rejected(
        "authority-drift",
        lambda: authority_snapshot(repository, planning, baseline, {first_path: altered}),
    )

    rejected(
        "unauthorized-path",
        lambda: require_prompt_c_surface(set(PROMPT_C_PATHS) | {"app/forbidden.ts"}),
    )

    forged = analysis.replace(digest, "0" * 64, 1)
    rejected("forged-clean-analysis", lambda: validate_analysis_text(forged, digest))
    require(tuple(passed) == SELF_TESTS, "self-test order/count drift")
    return passed


def validate(repository: Path, planning: Path, state: str, expected_head: str | None, self_test: bool) -> dict[str, object]:
    head, branch = validate_surface(repository, state, expected_head)
    pointer_state = validate_prompt_b(repository, state)
    prompt_a_count = validate_prompt_a(repository)
    baseline = strict_json(repository / BASELINE_PATH)
    require(isinstance(baseline, dict), "baseline object")
    snapshot, source_count, anchor_count = authority_snapshot(repository, planning, baseline)
    validate_preflights(strict_json(repository / PREFLIGHT_PATH), snapshot)

    specification = read_regular(repository, SPEC_PATH).decode()
    requirements, source_map = parse_requirements(specification)
    plan_text = read_regular(repository, PLAN_PATH).decode()
    plan_map = parse_plan(plan_text, requirements)
    tasks_text = read_regular(repository, TASKS_PATH).decode()
    tasks = parse_tasks(tasks_text, requirements)
    trace = strict_json(repository / TRACE_PATH)
    require(isinstance(trace, dict), "trace object")
    validate_trace_data(trace, requirements, source_map, plan_map, tasks)
    validate_coverage(repository, trace)
    checklist_count = validate_checklist(read_regular(repository, GATE4_PATH).decode())
    digest = analysis_digest(repository)
    analysis = read_regular(repository, ANALYSIS_PATH).decode()
    validate_analysis_text(analysis, digest)
    validate_validation_receipt(strict_json(repository / VALIDATION_PATH))
    validate_manifest(repository, strict_json(repository / MANIFEST_PATH))
    validate_hygiene(repository)

    self_tests = (
        run_self_tests(
            repository,
            planning,
            baseline,
            requirements,
            source_map,
            plan_map,
            tasks_text,
            tasks,
            trace,
            analysis,
            digest,
        )
        if self_test
        else []
    )
    hashes = {
        path: sha256(read_regular(repository, path)) for path in sorted(PROMPT_C_PATHS)
    }
    return {
        "status": "PASS",
        "phase": "Prompt C Gate 4 planning",
        "state": state,
        "head": head,
        "branch": branch,
        "prompt_b_checkpoint": PROMPT_B_CHECKPOINT,
        "prompt_b_parent": PROMPT_B_PARENT,
        "feature_pointer_state": pointer_state,
        "prompt_a_managed_files": prompt_a_count,
        "authority_sources": source_count,
        "authority_anchors": anchor_count,
        "authority_snapshot_sha256": snapshot,
        "preflight_records": 4,
        "requirements": len(requirements),
        "requirement_categories": EXPECTED_CATEGORY_COUNTS,
        "plan_mappings": len(plan_map),
        "trace_rows": len(trace["rows"]),
        "tasks": len(tasks),
        "test_tasks": sum(bool(task["test"]) for task in tasks.values()),
        "implementation_tasks": sum("[IMPL tests=" in str(task["line"]) for task in tasks.values()),
        "checklist_items_reviewed": checklist_count,
        "verifier_behaviors": list(BEHAVIORS),
        "mutation_ids": list(MUTATION_IDS),
        "analysis": {"critical": 0, "high": 0, "medium": 0, "low": 0},
        "prompt_c_paths": len(PROMPT_C_PATHS),
        "product_implementation": "NOT_STARTED",
        "external_actions": "NONE",
        "self_tests": self_tests,
        "self_test_count": len(self_tests),
        "artifact_sha256": hashes,
    }


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate Focus Contract Studio Prompt C Gate 4 artifacts")
    parser.add_argument("--repository-root", required=True)
    parser.add_argument("--planning-workspace", required=True)
    parser.add_argument("--state", choices=("working", "committed"), required=True)
    parser.add_argument("--expected-head")
    parser.add_argument("--self-test", action="store_true")
    return parser.parse_args()


def main() -> int:
    arguments = parse_arguments()
    try:
        repository = Path(arguments.repository_root).resolve(strict=True)
        planning = Path(arguments.planning_workspace).resolve(strict=True)
        result = validate(
            repository,
            planning,
            arguments.state,
            arguments.expected_head,
            arguments.self_test,
        )
    except (OSError, ValidationError, ValueError) as error:
        print(json.dumps({"status": "FAIL", "error": str(error)}, indent=2), file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
