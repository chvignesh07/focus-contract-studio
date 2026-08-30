import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import {
  assertLiveReceiptPathIsOutsideRepository,
  runLiveLocalVerification,
} from './stage1-live-local-verifier.ts';

const execFileAsync = promisify(execFile);
const syntheticSha = 'a'.repeat(40);
const evidenceRunId = '1'.repeat(32);

type TempRepository = {
  head: string;
  root: string;
};

async function git(root: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: root });
  return stdout.trim();
}

async function createRepository(
  t: test.TestContext,
  options: {
    gateExitCode?: number;
    gateScript?: string;
    includeCliModule?: boolean;
    projectIdPresent?: boolean;
    projectIdValue?: unknown;
  } = {},
): Promise<TempRepository> {
  const root = await mkdtemp(join(tmpdir(), 'fcs-live-verifier-'));
  t.after(async () => {
    await rm(root, { force: true, recursive: true });
  });
  await mkdir(join(root, '.openai'));
  await writeFile(
    join(root, '.openai', 'hosting.json'),
    JSON.stringify({
      ...(options.projectIdPresent
        ? {
            project_id: Object.prototype.hasOwnProperty.call(
              options,
              'projectIdValue',
            )
              ? options.projectIdValue
              : 'opaque-test-project-id',
          }
        : {}),
      d1: 'DB',
      r2: null,
    }) + '\n',
  );
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      scripts: {
        'verify:package0':
          options.gateScript ??
          'node -e "process.exit(' + (options.gateExitCode ?? 0) + ')"',
      },
    }) + '\n',
  );
  await writeFile(join(root, 'source.txt'), 'sealed\n');
  if (options.includeCliModule) {
    const moduleDirectory = join(root, 'tests', 'package0');
    await mkdir(moduleDirectory, { recursive: true });
    await copyFile(
      fileURLToPath(
        new URL('./stage1-live-local-verifier.ts', import.meta.url),
      ),
      join(moduleDirectory, 'stage1-live-local-verifier.ts'),
    );
  }
  await git(root, 'init', '-b', 'main');
  await git(root, 'config', 'user.name', 'Package 0 Test');
  await git(root, 'config', 'user.email', 'package0-test@example.invalid');
  await git(root, 'add', '.');
  await git(root, 'commit', '-m', 'fixture');
  return { root, head: await git(root, 'rev-parse', 'HEAD') };
}

test('pre-create verification reads the real checkout and runs the real Package 0 command', async (t) => {
  const repository = await createRepository(t);
  const receipt = await runLiveLocalVerification({
    repositoryRoot: repository.root,
    expectedHead: repository.head,
    phase: 'PRE_CREATE',
  });

  assert.deepEqual(
    {
      status: receipt.status,
      phase: receipt.phase,
      observedHead: receipt.observedHead,
      branch: receipt.branch,
      workingTreeClean: receipt.workingTreeClean,
      remoteCount: receipt.remoteCount,
      hostingProjectIdState: receipt.hostingProjectIdState,
      package0Verification: receipt.package0Verification,
      containsSensitiveOrPrivateValues:
        receipt.containsSensitiveOrPrivateValues,
    },
    {
      status: 'LOCAL_VERIFICATION_PASS',
      phase: 'PRE_CREATE',
      observedHead: repository.head,
      branch: 'main',
      workingTreeClean: true,
      remoteCount: 0,
      hostingProjectIdState: 'ABSENT',
      package0Verification: {
        command: 'npm run verify:package0',
        result: 'PASS',
      },
      containsSensitiveOrPrivateValues: false,
    },
  );
  assert.match(receipt.observedAtUtc, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(receipt.evidenceRunId, /^[0-9a-f]{32}$/);
});

test('a synthetic expected SHA cannot qualify as live checkout proof', async (t) => {
  const preCreate = await createRepository(t);
  await assert.rejects(
    runLiveLocalVerification({
      repositoryRoot: preCreate.root,
      expectedHead: syntheticSha,
      phase: 'PRE_CREATE',
    }),
    { code: 'EXPECTED_HEAD_MISMATCH' },
  );

  const postCreate = await createRepository(t, { projectIdPresent: true });
  const receipt = await runLiveLocalVerification({
    repositoryRoot: postCreate.root,
    expectedHead: postCreate.head,
    phase: 'POST_CREATE',
    evidenceRunId,
  });
  assert.equal(receipt.observedHead, postCreate.head);
  assert.equal(receipt.hostingProjectIdState, 'PRESENT_REDACTED');
  assert.doesNotMatch(JSON.stringify(receipt), /opaque-test-project-id/);
});

test('dirty state, persisted remotes, wrong project phase, and a failed gate all fail closed', async (t) => {
  const dirty = await createRepository(t);
  await writeFile(join(dirty.root, 'source.txt'), 'dirty\n');
  await assert.rejects(
    runLiveLocalVerification({
      repositoryRoot: dirty.root,
      expectedHead: dirty.head,
      phase: 'PRE_CREATE',
    }),
    { code: 'WORKING_TREE_DIRTY' },
  );

  const remote = await createRepository(t);
  await git(
    remote.root,
    'remote',
    'add',
    'origin',
    'https://example.invalid/private.git',
  );
  await assert.rejects(
    runLiveLocalVerification({
      repositoryRoot: remote.root,
      expectedHead: remote.head,
      phase: 'PRE_CREATE',
    }),
    { code: 'UNEXPECTED_GIT_REMOTE' },
  );

  const wrongBranch = await createRepository(t);
  await git(wrongBranch.root, 'switch', '-c', 'feature');
  await assert.rejects(
    runLiveLocalVerification({
      repositoryRoot: wrongBranch.root,
      expectedHead: wrongBranch.head,
      phase: 'PRE_CREATE',
    }),
    { code: 'BRANCH_NOT_MAIN' },
  );

  const wrongPhase = await createRepository(t, { projectIdPresent: true });
  await assert.rejects(
    runLiveLocalVerification({
      repositoryRoot: wrongPhase.root,
      expectedHead: wrongPhase.head,
      phase: 'PRE_CREATE',
    }),
    { code: 'PROJECT_ID_STATE_MISMATCH' },
  );

  const gateFailure = await createRepository(t, { gateExitCode: 7 });
  await assert.rejects(
    runLiveLocalVerification({
      repositoryRoot: gateFailure.root,
      expectedHead: gateFailure.head,
      phase: 'PRE_CREATE',
    }),
    { code: 'PACKAGE0_VERIFICATION_FAILED' },
  );

  const gateDrift = await createRepository(t, {
    gateScript:
      'node -e "require(\'node:fs\').writeFileSync(\'gate-drift.txt\',\'drift\')"',
  });
  await assert.rejects(
    runLiveLocalVerification({
      repositoryRoot: gateDrift.root,
      expectedHead: gateDrift.head,
      phase: 'PRE_CREATE',
    }),
    { code: 'WORKING_TREE_DIRTY' },
  );
});

test('post-create verification requires a non-empty opaque project ID string', async (t) => {
  for (const projectIdValue of [null, '', '   ', 7, {}]) {
    const repository = await createRepository(t, {
      projectIdPresent: true,
      projectIdValue,
    });
    await assert.rejects(
      runLiveLocalVerification({
        repositoryRoot: repository.root,
        expectedHead: repository.head,
        phase: 'POST_CREATE',
        evidenceRunId,
      }),
      { code: 'PROJECT_ID_VALUE_INVALID' },
    );
  }
});

test('a live verification receipt must be written outside the checkout', () => {
  assert.throws(
    () =>
      assertLiveReceiptPathIsOutsideRepository(
        '/work/repository/evidence.json',
        '/work/repository',
      ),
    { code: 'LIVE_RECEIPT_MUST_BE_OUTSIDE_REPOSITORY' },
  );
  assert.doesNotThrow(() =>
    assertLiveReceiptPathIsOutsideRepository(
      '<TEMP_DIRECTORY>/fcs-stage1/live-receipt.json',
      '/work/repository',
    ),
  );
});

test('the CLI rejects an in-repository receipt path with sanitized output', async () => {
  const modulePath = fileURLToPath(
    new URL('./stage1-live-local-verifier.ts', import.meta.url),
  );
  const inRepositoryReceipt = fileURLToPath(
    new URL('./forbidden-live-receipt.json', import.meta.url),
  );
  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        '--experimental-strip-types',
        modulePath,
        '--phase',
        'PRE_CREATE',
        '--expected-head',
        syntheticSha,
        '--receipt',
        inRepositoryReceipt,
      ],
      { cwd: fileURLToPath(new URL('../../', import.meta.url)) },
    ),
    (error: unknown) => {
      assert.ok(error && typeof error === 'object' && 'stderr' in error);
      const stderr = String((error as { stderr: unknown }).stderr);
      assert.equal(
        stderr,
        '{"status":"LOCAL_VERIFICATION_FAIL","code":"LIVE_RECEIPT_MUST_BE_OUTSIDE_REPOSITORY"}\n',
      );
      assert.doesNotMatch(stderr, /project_id|credential|opaque/i);
      return true;
    },
  );
});

test('the live CLI writes sanitized 0600 PRE/POST receipts and never overwrites one', async (t) => {
  const repository = await createRepository(t, { includeCliModule: true });
  const modulePath = join(
    repository.root,
    'tests',
    'package0',
    'stage1-live-local-verifier.ts',
  );
  const evidenceDirectory = await mkdtemp(
    join(tmpdir(), 'fcs-live-cli-evidence-'),
  );
  t.after(async () => {
    await rm(evidenceDirectory, { force: true, recursive: true });
  });
  const preReceiptPath = join(evidenceDirectory, 'pre-create.json');
  const pre = await execFileAsync(
    process.execPath,
    [
      '--experimental-strip-types',
      modulePath,
      '--phase',
      'PRE_CREATE',
      '--expected-head',
      repository.head,
      '--receipt',
      preReceiptPath,
    ],
    { cwd: repository.root },
  );
  assert.equal(pre.stderr, '');
  assert.doesNotMatch(pre.stdout, /project_id|credential|opaque/i);
  const preReceipt = JSON.parse(await readFile(preReceiptPath, 'utf8')) as {
    evidenceRunId: string;
    hostingProjectIdState: string;
    observedHead: string;
    status: string;
  };
  assert.equal(preReceipt.status, 'LOCAL_VERIFICATION_PASS');
  assert.equal(preReceipt.observedHead, repository.head);
  assert.equal(preReceipt.hostingProjectIdState, 'ABSENT');
  assert.match(preReceipt.evidenceRunId, /^[0-9a-f]{32}$/);
  assert.equal((await stat(preReceiptPath)).mode & 0o777, 0o600);

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        '--experimental-strip-types',
        modulePath,
        '--phase',
        'PRE_CREATE',
        '--expected-head',
        repository.head,
        '--receipt',
        preReceiptPath,
      ],
      { cwd: repository.root },
    ),
    (error: unknown) => {
      assert.ok(error && typeof error === 'object' && 'stderr' in error);
      assert.match(
        String((error as { stderr: unknown }).stderr),
        /"code":"LIVE_RECEIPT_ALREADY_EXISTS"/,
      );
      return true;
    },
  );

  await writeFile(
    join(repository.root, '.openai', 'hosting.json'),
    JSON.stringify({
      project_id: 'opaque-test-project-id',
      d1: 'DB',
      r2: null,
    }) + '\n',
  );
  await git(repository.root, 'add', '.openai/hosting.json');
  await git(repository.root, 'commit', '-m', 'persist project id');
  const postHead = await git(repository.root, 'rev-parse', 'HEAD');
  const postReceiptPath = join(evidenceDirectory, 'post-create.json');
  const post = await execFileAsync(
    process.execPath,
    [
      '--experimental-strip-types',
      modulePath,
      '--phase',
      'POST_CREATE',
      '--expected-head',
      postHead,
      '--evidence-run-id',
      preReceipt.evidenceRunId,
      '--receipt',
      postReceiptPath,
    ],
    { cwd: repository.root },
  );
  assert.equal(post.stderr, '');
  assert.doesNotMatch(post.stdout, /project_id|credential|opaque/i);
  const postReceipt = JSON.parse(await readFile(postReceiptPath, 'utf8')) as {
    evidenceRunId: string;
    hostingProjectIdState: string;
    observedHead: string;
    status: string;
  };
  assert.deepEqual(
    {
      status: postReceipt.status,
      run: postReceipt.evidenceRunId,
      head: postReceipt.observedHead,
      project: postReceipt.hostingProjectIdState,
      mode: (await stat(postReceiptPath)).mode & 0o777,
    },
    {
      status: 'LOCAL_VERIFICATION_PASS',
      run: preReceipt.evidenceRunId,
      head: postHead,
      project: 'PRESENT_REDACTED',
      mode: 0o600,
    },
  );
  assert.doesNotMatch(JSON.stringify(postReceipt), /opaque-test-project-id/);
});
