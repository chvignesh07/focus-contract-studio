from __future__ import annotations

import hashlib
import json
import re
import stat
import sys
from pathlib import Path

import yaml


ROOT = Path(sys.argv[1]).resolve()
EXPECTED_SKILLS = (
    "speckit-analyze",
    "speckit-checklist",
    "speckit-clarify",
    "speckit-constitution",
    "speckit-converge",
    "speckit-implement",
    "speckit-plan",
    "speckit-specify",
    "speckit-tasks",
    "speckit-taskstoissues",
)
EXPECTED_SPECIFY_FILES = {
    ".specify/.gitignore",
    ".specify/init-options.json",
    ".specify/integration.json",
    ".specify/integrations/codex.manifest.json",
    ".specify/integrations/speckit.manifest.json",
    ".specify/memory/.constitution-template.json",
    ".specify/memory/constitution.md",
    ".specify/scripts/bash/check-prerequisites.sh",
    ".specify/scripts/bash/common.sh",
    ".specify/scripts/bash/create-new-feature.sh",
    ".specify/scripts/bash/resolve-template.sh",
    ".specify/scripts/bash/setup-plan.sh",
    ".specify/scripts/bash/setup-tasks.sh",
    ".specify/templates/checklist-template.md",
    ".specify/templates/constitution-template.md",
    ".specify/templates/plan-template.md",
    ".specify/templates/spec-template.md",
    ".specify/templates/tasks-template.md",
    ".specify/workflows/speckit/workflow.yml",
    ".specify/workflows/workflow-registry.json",
}
EXPECTED_EXECUTABLES = {
    path for path in EXPECTED_SPECIFY_FILES if path.startswith(".specify/scripts/bash/")
}
errors: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def regular_files(base: Path) -> set[str]:
    result: set[str] = set()
    for path in base.rglob("*"):
        rel = path.relative_to(ROOT).as_posix()
        if path.is_symlink():
            fail(f"symlink not allowed: {rel}")
        elif path.is_file():
            result.add(rel)
    return result


actual_specify = regular_files(ROOT / ".specify")
if actual_specify != EXPECTED_SPECIFY_FILES:
    fail(
        ".specify file mismatch: "
        f"missing={sorted(EXPECTED_SPECIFY_FILES - actual_specify)} "
        f"extra={sorted(actual_specify - EXPECTED_SPECIFY_FILES)}"
    )

expected_skill_paths = {
    f".agents/skills/{name}/SKILL.md" for name in EXPECTED_SKILLS
}
actual_agent_files = regular_files(ROOT / ".agents")
if actual_agent_files != expected_skill_paths:
    fail(
        ".agents file mismatch: "
        f"missing={sorted(expected_skill_paths - actual_agent_files)} "
        f"extra={sorted(actual_agent_files - expected_skill_paths)}"
    )

for forbidden in (
    ".codex",
    "specs",
    ".specify/extensions",
    ".specify/presets",
    ".specify/bundles",
    ".specify/extensions.yml",
    ".specify/integration-events.yml",
    ".github/hooks",
):
    if (ROOT / forbidden).exists() or (ROOT / forbidden).is_symlink():
        fail(f"forbidden path present: {forbidden}")

for rel in sorted(expected_skill_paths):
    path = ROOT / rel
    text = path.read_text(encoding="utf-8")
    match = re.match(r"\A---\n(.*?)\n---\n", text, re.DOTALL)
    if not match:
        fail(f"frontmatter missing: {rel}")
        continue
    try:
        frontmatter = yaml.safe_load(match.group(1))
    except yaml.YAMLError as exc:
        fail(f"frontmatter parse failure: {rel}: {exc}")
        continue
    expected_name = Path(rel).parent.name
    if set(frontmatter) != {"name", "description", "compatibility", "metadata"}:
        fail(f"frontmatter fields differ: {rel}: {sorted(frontmatter)}")
    if frontmatter.get("name") != expected_name:
        fail(f"skill name mismatch: {rel}: {frontmatter.get('name')!r}")
    if (
        frontmatter.get("compatibility")
        != "Requires spec-kit project structure with .specify/ directory"
    ):
        fail(f"compatibility mismatch: {rel}")
    metadata = frontmatter.get("metadata")
    expected_source = (
        f"templates/commands/{expected_name.removeprefix('speckit-')}.md"
    )
    if metadata != {"author": "github-spec-kit", "source": expected_source}:
        fail(f"metadata mismatch: {rel}: {metadata!r}")
    if not isinstance(frontmatter.get("description"), str) or not frontmatter[
        "description"
    ].strip():
        fail(f"empty description: {rel}")

for rel in (
    ".specify/init-options.json",
    ".specify/integration.json",
    ".specify/integrations/codex.manifest.json",
    ".specify/integrations/speckit.manifest.json",
    ".specify/memory/.constitution-template.json",
    ".specify/workflows/workflow-registry.json",
    "docs/evidence/spec-kit/PROVENANCE.json",
    "docs/evidence/spec-kit/INTEGRATION_STATUS_IMMEDIATE.json",
):
    try:
        json.loads((ROOT / rel).read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"JSON invalid: {rel}: {exc}")

try:
    workflow = yaml.safe_load(
        (ROOT / ".specify/workflows/speckit/workflow.yml").read_text(
            encoding="utf-8"
        )
    )
    workflow_meta = workflow.get("workflow", {}) if isinstance(workflow, dict) else {}
    if not isinstance(workflow_meta, dict) or workflow_meta.get("name") != "Full SDD Cycle":
        fail("workflow YAML shape/name mismatch")
except Exception as exc:
    fail(f"workflow YAML invalid: {exc}")

for manifest_name in ("codex", "speckit"):
    manifest_path = ROOT / f".specify/integrations/{manifest_name}.manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for rel, expected_hash in manifest.get("files", {}).items():
        path = ROOT / rel
        if not path.is_file() or path.is_symlink():
            fail(f"manifest path missing/non-regular: {rel}")
            continue
        actual_hash = sha256(path)
        if actual_hash != expected_hash:
            fail(f"managed hash mismatch: {rel}: {actual_hash} != {expected_hash}")

actual_exec: set[str] = set()
for rel in sorted(actual_specify | actual_agent_files):
    mode = (ROOT / rel).stat().st_mode
    if mode & (stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH):
        actual_exec.add(rel)
if actual_exec != EXPECTED_EXECUTABLES:
    fail(
        "executable mismatch: "
        f"expected={sorted(EXPECTED_EXECUTABLES)} actual={sorted(actual_exec)}"
    )

lock_path = ROOT / "docs/evidence/spec-kit/spec-kit-v1.0.1.uv.lock"
if sha256(lock_path) != (
    "64b7fbf776403c947c2cce2eba8647fa3ef741995e429de0ea83ed5f03d8cb85"
):
    fail("preserved lock hash mismatch")

if errors:
    print(json.dumps({"status": "FAIL", "errors": errors}, indent=2))
    raise SystemExit(1)

print(
    json.dumps(
        {
            "status": "PASS",
            "specify_files": len(actual_specify),
            "skills": list(EXPECTED_SKILLS),
            "skill_files": len(actual_agent_files),
            "managed_file_modifications": 0,
            "bridge_constitution_managed_by_upstream_manifest": False,
            "executables": sorted(actual_exec),
            "forbidden_paths": 0,
            "json_yaml_frontmatter_errors": 0,
            "symlinks": 0,
            "lock_sha256": sha256(lock_path),
        },
        indent=2,
    )
)
