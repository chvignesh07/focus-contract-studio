import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
export type Stage1LivePhase = 'POST_CREATE' | 'PRE_CREATE';

export type Stage1LiveReceipt = {
  schemaVersion: 2;
  status: 'LOCAL_VERIFICATION_PASS';
  evidenceRunId: string;
  phase: Stage1LivePhase;
  observedAtUtc: string;
  observedHead: string;
  branch: 'main';
  workingTreeClean: true;
  remoteCount: 0;
  hostingProjectIdState: 'ABSENT' | 'PRESENT_REDACTED';
  package0Verification: {
    command: 'npm run verify:package0';
    result: 'PASS';
  };
  containsSensitiveOrPrivateValues: false;
};

type LiveVerificationOptions = {
  repositoryRoot: string;
  expectedHead: string;
  phase: Stage1LivePhase;
  evidenceRunId?: string;
};

type RepositoryObservation = {
  branch: string;
  head: string;
  hostingProjectIdState: 'ABSENT' | 'PRESENT_INVALID' | 'PRESENT_VALID';
  remoteCount: number;
  status: string;
};

export class Stage1LiveVerificationError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'Stage1LiveVerificationError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new Stage1LiveVerificationError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertFullSha(value: unknown, code: string): asserts value is string {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) {
    fail(code);
  }
}

function assertEvidenceRunId(
  value: unknown,
  code: string,
): asserts value is string {
  if (typeof value !== 'string' || !/^[0-9a-f]{32}$/.test(value)) {
    fail(code);
  }
}

function assertTimestamp(
  value: unknown,
  code: string,
): asserts value is string {
  if (typeof value !== 'string') fail(code);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    fail(code);
  }
}

function assertExactKeys(
  record: Record<string, unknown>,
  expectedKeys: string[],
  code: string,
): void {
  const actual = Object.keys(record).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail(code);
  }
}

async function run(
  repositoryRoot: string,
  command: string,
  args: string[],
): Promise<string> {
  const { stdout } = await execFileAsync(command, args, {
    cwd: repositoryRoot,
    maxBuffer: 20 * 1024 * 1024,
  });
  return stdout.trim();
}

async function observeRepository(
  repositoryRoot: string,
): Promise<RepositoryObservation> {
  let topLevel: string;
  try {
    topLevel = await run(repositoryRoot, 'git', [
      'rev-parse',
      '--show-toplevel',
    ]);
  } catch {
    fail('NOT_A_GIT_REPOSITORY');
  }
  const resolvedTopLevel = await realpath(topLevel);
  if (resolvedTopLevel !== repositoryRoot) {
    fail('REPOSITORY_ROOT_MISMATCH');
  }

  const [head, branch, status, remotes, hostingText] = await Promise.all([
    run(repositoryRoot, 'git', ['rev-parse', 'HEAD']),
    run(repositoryRoot, 'git', ['branch', '--show-current']),
    run(repositoryRoot, 'git', [
      'status',
      '--porcelain=v1',
      '--untracked-files=all',
    ]),
    run(repositoryRoot, 'git', ['remote']),
    readFile(resolve(repositoryRoot, '.openai', 'hosting.json'), 'utf8'),
  ]);

  let hosting: unknown;
  try {
    hosting = JSON.parse(hostingText);
  } catch {
    fail('HOSTING_JSON_INVALID');
  }
  if (!isRecord(hosting)) fail('HOSTING_JSON_INVALID');

  const hasProjectId = Object.prototype.hasOwnProperty.call(
    hosting,
    'project_id',
  );
  const projectId = hosting.project_id;
  const hostingProjectIdState = !hasProjectId
    ? 'ABSENT'
    : typeof projectId === 'string' && projectId.trim().length > 0
      ? 'PRESENT_VALID'
      : 'PRESENT_INVALID';

  return {
    branch,
    head,
    hostingProjectIdState,
    remoteCount: remotes === '' ? 0 : remotes.split('\n').length,
    status,
  };
}

function assertExpectedState(
  observation: RepositoryObservation,
  expectedHead: string,
  phase: Stage1LivePhase,
): void {
  assertFullSha(expectedHead, 'EXPECTED_HEAD_INVALID');
  if (observation.head !== expectedHead) fail('EXPECTED_HEAD_MISMATCH');
  if (observation.branch !== 'main') fail('BRANCH_NOT_MAIN');
  if (observation.status !== '') fail('WORKING_TREE_DIRTY');
  if (observation.remoteCount !== 0) fail('UNEXPECTED_GIT_REMOTE');
  if (observation.hostingProjectIdState === 'PRESENT_INVALID') {
    fail('PROJECT_ID_VALUE_INVALID');
  }
  const expectedProjectIdState =
    phase === 'POST_CREATE' ? 'PRESENT_VALID' : 'ABSENT';
  if (observation.hostingProjectIdState !== expectedProjectIdState) {
    fail('PROJECT_ID_STATE_MISMATCH');
  }
}

function observationsMatch(
  before: RepositoryObservation,
  after: RepositoryObservation,
): boolean {
  return (
    before.branch === after.branch &&
    before.head === after.head &&
    before.hostingProjectIdState === after.hostingProjectIdState &&
    before.remoteCount === after.remoteCount &&
    before.status === after.status
  );
}

export function assertLiveReceiptPathIsOutsideRepository(
  receiptPath: string,
  repositoryRoot: string,
): void {
  const resolvedReceipt = resolve(receiptPath);
  const resolvedRepository = resolve(repositoryRoot);
  const pathFromRepository = relative(resolvedRepository, resolvedReceipt);
  if (
    pathFromRepository === '' ||
    (pathFromRepository !== '..' &&
      !pathFromRepository.startsWith('..' + sep))
  ) {
    fail('LIVE_RECEIPT_MUST_BE_OUTSIDE_REPOSITORY');
  }
}

async function writeLiveReceiptExclusive(
  receiptPath: string,
  receipt: Stage1LiveReceipt,
): Promise<void> {
  try {
    await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
  } catch (error) {
    if (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'EEXIST'
    ) {
      fail('LIVE_RECEIPT_ALREADY_EXISTS');
    }
    throw error;
  }
}

export async function runLiveLocalVerification(
  options: LiveVerificationOptions,
): Promise<Stage1LiveReceipt> {
  const repositoryRoot = await realpath(options.repositoryRoot);
  const evidenceRunId =
    options.phase === 'PRE_CREATE' && options.evidenceRunId === undefined
      ? randomBytes(16).toString('hex')
      : options.evidenceRunId;
  assertEvidenceRunId(evidenceRunId, 'EVIDENCE_RUN_ID_REQUIRED');
  const before = await observeRepository(repositoryRoot);
  assertExpectedState(before, options.expectedHead, options.phase);

  try {
    await run(repositoryRoot, 'npm', ['run', 'verify:package0']);
  } catch {
    fail('PACKAGE0_VERIFICATION_FAILED');
  }

  const after = await observeRepository(repositoryRoot);
  assertExpectedState(after, options.expectedHead, options.phase);
  if (!observationsMatch(before, after)) {
    fail('CHECKOUT_CHANGED_DURING_VERIFICATION');
  }

  return {
    schemaVersion: 2,
    status: 'LOCAL_VERIFICATION_PASS',
    evidenceRunId,
    phase: options.phase,
    observedAtUtc: new Date().toISOString(),
    observedHead: after.head,
    branch: 'main',
    workingTreeClean: true,
    remoteCount: 0,
    hostingProjectIdState:
      options.phase === 'POST_CREATE' ? 'PRESENT_REDACTED' : 'ABSENT',
    package0Verification: {
      command: 'npm run verify:package0',
      result: 'PASS',
    },
    containsSensitiveOrPrivateValues: false,
  };
}

export function validateStage1LiveReceipt(
  value: unknown,
  expectedPhase: Stage1LivePhase,
): Stage1LiveReceipt {
  if (!isRecord(value)) fail('LIVE_RECEIPT_INVALID');
  assertExactKeys(
    value,
    [
      'schemaVersion',
      'status',
      'evidenceRunId',
      'phase',
      'observedAtUtc',
      'observedHead',
      'branch',
      'workingTreeClean',
      'remoteCount',
      'hostingProjectIdState',
      'package0Verification',
      'containsSensitiveOrPrivateValues',
    ],
    'LIVE_RECEIPT_SCHEMA_NOT_ALLOWLISTED',
  );
  if (
    value.schemaVersion !== 2 ||
    value.status !== 'LOCAL_VERIFICATION_PASS' ||
    value.phase !== expectedPhase
  ) {
    fail('LIVE_RECEIPT_IDENTITY_INVALID');
  }
  assertEvidenceRunId(value.evidenceRunId, 'EVIDENCE_RUN_ID_INVALID');
  assertTimestamp(value.observedAtUtc, 'LIVE_RECEIPT_TIMESTAMP_INVALID');
  assertFullSha(value.observedHead, 'LIVE_RECEIPT_HEAD_INVALID');
  if (
    value.branch !== 'main' ||
    value.workingTreeClean !== true ||
    value.remoteCount !== 0 ||
    value.containsSensitiveOrPrivateValues !== false
  ) {
    fail('LIVE_RECEIPT_CHECKOUT_STATE_INVALID');
  }
  const expectedProjectState =
    expectedPhase === 'POST_CREATE' ? 'PRESENT_REDACTED' : 'ABSENT';
  if (value.hostingProjectIdState !== expectedProjectState) {
    fail('LIVE_RECEIPT_PROJECT_STATE_INVALID');
  }
  if (!isRecord(value.package0Verification)) {
    fail('LIVE_RECEIPT_GATE_INVALID');
  }
  assertExactKeys(
    value.package0Verification,
    ['command', 'result'],
    'LIVE_RECEIPT_GATE_SCHEMA_NOT_ALLOWLISTED',
  );
  if (
    value.package0Verification.command !== 'npm run verify:package0' ||
    value.package0Verification.result !== 'PASS'
  ) {
    fail('LIVE_RECEIPT_GATE_INVALID');
  }
  return value as Stage1LiveReceipt;
}

type CliArguments = {
  evidenceRunId?: string;
  expectedHead: string;
  phase: Stage1LivePhase;
  receiptPath: string;
};

function parseCliArguments(args: string[]): CliArguments {
  const values = new Map<string, string>();
  if (args.length % 2 !== 0) fail('CLI_ARGUMENTS_INVALID');
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (
      typeof key !== 'string' ||
      typeof value !== 'string' ||
      !key.startsWith('--') ||
      values.has(key)
    ) {
      fail('CLI_ARGUMENTS_INVALID');
    }
    values.set(key, value);
  }
  const allowed = new Set([
    '--phase',
    '--expected-head',
    '--receipt',
    '--evidence-run-id',
  ]);
  if ([...values.keys()].some((key) => !allowed.has(key))) {
    fail('CLI_ARGUMENTS_INVALID');
  }
  const phase = values.get('--phase');
  const expectedHead = values.get('--expected-head');
  const receiptPath = values.get('--receipt');
  if (
    (phase !== 'PRE_CREATE' && phase !== 'POST_CREATE') ||
    typeof expectedHead !== 'string' ||
    typeof receiptPath !== 'string' ||
    !isAbsolute(receiptPath)
  ) {
    fail('CLI_ARGUMENTS_INVALID');
  }
  const evidenceRunId = values.get('--evidence-run-id');
  if (
    (phase === 'POST_CREATE' && typeof evidenceRunId !== 'string') ||
    (phase === 'PRE_CREATE' && evidenceRunId !== undefined)
  ) {
    fail('CLI_ARGUMENTS_INVALID');
  }
  return { phase, expectedHead, receiptPath, evidenceRunId };
}

async function runCli(): Promise<void> {
  try {
    const args = parseCliArguments(process.argv.slice(2));
    const repositoryRoot = await realpath(
      fileURLToPath(new URL('../../', import.meta.url)),
    );
    const receiptParent = await realpath(dirname(args.receiptPath));
    const receiptPath = resolve(receiptParent, basename(args.receiptPath));
    assertLiveReceiptPathIsOutsideRepository(receiptPath, repositoryRoot);
    const receipt = await runLiveLocalVerification({
      repositoryRoot,
      expectedHead: args.expectedHead,
      phase: args.phase,
      evidenceRunId: args.evidenceRunId,
    });
    await writeLiveReceiptExclusive(receiptPath, receipt);
    process.stdout.write(
      JSON.stringify({
        status: receipt.status,
        phase: receipt.phase,
        observedHead: receipt.observedHead,
        receiptWritten: true,
      }) + '\n',
    );
  } catch (error) {
    const code =
      error instanceof Stage1LiveVerificationError
        ? error.code
        : 'LIVE_VERIFICATION_FAILED';
    process.stderr.write(
      JSON.stringify({ status: 'LOCAL_VERIFICATION_FAIL', code }) + '\n',
    );
    process.exitCode = 1;
  }
}

const modulePath = fileURLToPath(import.meta.url);
if (
  process.argv[1] &&
  realpathSync(resolve(process.argv[1])) === realpathSync(modulePath)
) {
  void runCli();
}
