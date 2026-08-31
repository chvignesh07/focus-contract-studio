import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../..',
);
const sensitiveMarker = 'P3_PRIVATE_MARKER_DO_NOT_PERSIST_9f31';
const productionPaths = [
  'app/delete-account-dialog.tsx',
  'app/focus-contract-studio.tsx',
  'app/api/rehearsals/start/route.ts',
  'app/api/rehearsals/[rehearsalSessionId]/finalize/route.ts',
  'app/api/verifications/route.ts',
  'lib/domain/focus-rehearsal.ts',
  'lib/domain/focus-event-verifier.ts',
  'lib/server/focus-rehearsal.ts',
  'lib/server/verify-focus-contract.ts',
] as const;
const evidencePaths = [
  '.artifacts/accessibility/axe.json',
  '.artifacts/browser/playwright.json',
  '.artifacts/test/component.json',
  '.artifacts/test/coverage-summary.json',
  '.artifacts/test/d1.json',
  '.artifacts/test/unit.json',
  '.artifacts/test/verifier-independence.json',
  'docs/evidence/PACKAGE3_ADVERSARIAL_REVIEW.md',
  'docs/evidence/PACKAGE3_VERIFICATION.md',
] as const;

test('observer never reads typed values or serializes DOM/text/private browser surfaces', () => {
  const observer = readFileSync(
    path.join(repositoryRoot, 'app/delete-account-dialog.tsx'),
    'utf8',
  );
  assert.doesNotMatch(
    observer,
    /\.value\b|innerHTML|outerHTML|clipboard|localStorage|sessionStorage|document\.cookie/iu,
  );
  assert.match(observer, /event\.key !== 'Tab' && event\.key !== 'Escape'/u);
  assert.doesNotMatch(observer, /console\.|sendBeacon|analytics|telemetry/iu);
});

test('Package 3 server and route code have no raw-payload logging or unsafe public reflection', () => {
  for (const relativePath of productionPaths) {
    const source = readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
    assert.doesNotMatch(source, /console\.|JSON\.stringify\(input\.input\)|error\.stack/u, relativePath);
    assert.doesNotMatch(source, /reasonText|typedValue|rawIdentity|rawCookie|domSnapshot/iu, relativePath);
  }
  const verification = readFileSync(
    path.join(repositoryRoot, 'lib/server/verify-focus-contract.ts'),
    'utf8',
  );
  const resultType = verification.match(
    /export type VerificationResult = \{([\s\S]*?)\n\};/u,
  )?.[1];
  assert.ok(resultType);
  assert.doesNotMatch(resultType, /workspaceId|rehearsalSessionId|events|configuration/u);
});

test('bound Package 3 evidence contains no marker, local path, secret, symlink, or prohibited payload label', () => {
  for (const relativePath of evidencePaths) {
    const absolutePath = path.join(repositoryRoot, relativePath);
    assert.ok(existsSync(absolutePath), `missing evidence: ${relativePath}`);
    const source = readFileSync(absolutePath, 'utf8');
    assert.doesNotMatch(source, new RegExp(sensitiveMarker, 'u'), relativePath);
    assert.doesNotMatch(source, /\/Users\/|\/private\/tmp|__Host-fcs_session|x-fcs-csrf/iu, relativePath);
    assert.doesNotMatch(source, /textarea[_ -]?value|raw[_ -]?(?:event|identity|cookie|csrf)|DOM snapshot/iu, relativePath);
  }
});
