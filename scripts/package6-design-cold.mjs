import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parseStrictJson } from './package3-evidence-binding.mjs';

const paths = {
  baseline: 'specs/004-package-6-premium-accessible-surface/design-review.json',
  resolution: 'specs/004-package-6-premium-accessible-surface/design-resolution.json',
  cold: 'docs/evidence/PACKAGE6_COLD_EVALUATION.json',
  visual: 'docs/evidence/PACKAGE6_VISUAL_MANIFEST.json',
};

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(repositoryRoot, relativePath) {
  const absolutePath = path.join(repositoryRoot, relativePath);
  const stat = lstatSync(absolutePath);
  requireCondition(stat.isFile() && !stat.isSymbolicLink(), `invalid design/cold file: ${relativePath}`);
  return parseStrictJson(readFileSync(absolutePath, 'utf8'), relativePath);
}

export function validatePackage6DesignCold(repositoryRoot) {
  const baseline = readJson(repositoryRoot, paths.baseline);
  requireCondition(baseline.review_invocations === 1, 'design review invocation count drift');
  requireCondition(Object.keys(baseline.checklist ?? {}).length === 80, 'design checklist count drift');
  requireCondition(baseline.verdict === 'REJECT', 'baseline design verdict drift');
  requireCondition(
    baseline.slop_matches?.includes('decorative violet radial gradient'),
    'baseline violet gap missing',
  );

  const resolution = readJson(repositoryRoot, paths.resolution);
  requireCondition(
    resolution.schema_version === 'fcs-package6-design-resolution-v1' && resolution.status === 'PASS',
    'design resolution status drift',
  );
  requireCondition(resolution.design_review_rerun === false, 'design review was rerun');
  requireCondition(resolution.baseline_review_invocations === 1, 'baseline invocation binding drift');
  requireCondition(resolution.unresolved_material_gaps === 0, 'material design gap remains');
  requireCondition(
    Array.isArray(resolution.resolved_gaps) && resolution.resolved_gaps.length >= 7,
    'design resolution inventory incomplete',
  );

  const cold = readJson(repositoryRoot, paths.cold);
  requireCondition(
    cold.schema_version === 'fcs-package6-cold-evaluation-v1' && cold.status === 'PASS',
    'cold evaluation status drift',
  );
  requireCondition(
    cold.context === 'FINAL_BUILT_SCREENSHOT_ONLY_NO_REPOSITORY_HISTORY',
    'cold evaluator context drift',
  );
  requireCondition(
    Number.isFinite(cold.elapsed_seconds) && cold.elapsed_seconds >= 0 && cold.elapsed_seconds <= 15,
    'cold evaluator exceeded 15 seconds',
  );
  requireCondition(
    Array.isArray(cold.answers) && cold.answers.length === 5 &&
      cold.answers.every((answer, index) => answer.question === index + 1 && answer.correct === true),
    'cold evaluator answers incomplete',
  );
  requireCondition(cold.deployed_cold_evaluator === 'NOT_RUN', 'deployed cold row drift');

  const visual = readJson(repositoryRoot, paths.visual);
  requireCondition(
    visual.schema_version === 'fcs-package6-visual-manifest-v1' && visual.status === 'PASS',
    'visual manifest status drift',
  );
  requireCondition(visual.images_committed === false, 'large visual artifacts must not be committed');
  requireCondition(visual.temporary_collection_removed === true, 'temporary visual collection remains');
  requireCondition(
    Array.isArray(visual.screenshots) && visual.screenshots.length >= 19 &&
      visual.screenshots.every((entry) => /^[0-9a-f]{64}$/u.test(entry.sha256) && entry.inspection === 'PASS'),
    'visual screenshot evidence incomplete',
  );
  for (const profile of ['desktop', '320px', '375px', 'true-200-page-zoom']) {
    requireCondition(
      visual.screenshots.some(({ name }) => name.startsWith(profile)),
      `visual profile missing: ${profile}`,
    );
  }
  return { baseline, resolution, cold, visual };
}

function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const result = validatePackage6DesignCold(repositoryRoot);
    process.stdout.write(
      `PACKAGE6_DESIGN_COLD_PASS screenshots=${result.visual.screenshots.length} elapsed=${result.cold.elapsed_seconds}s\n`,
    );
  } catch (error) {
    process.stderr.write(
      `PACKAGE6_DESIGN_COLD_FAIL ${error instanceof Error ? error.message : 'unknown error'}\n`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
