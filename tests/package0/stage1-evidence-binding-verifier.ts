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
import {
  validateStage1EvidenceManifest,
} from './stage1-evidence-validator.ts';
import {
  runLiveLocalVerification,
  validateStage1LiveReceipt,
} from './stage1-live-local-verifier.ts';
import {
  hashSanitizedReceipt,
  validateStage1SitesReceiptBundle,
} from './stage1-sites-receipt-validator.ts';

type JsonRecord = Record<string, unknown>;

export type Stage1EvidenceBindingSummary = {
  status: 'EVIDENCE_BOUND';
  evidenceRunId: string;
  actualHead: string;
  referenceCount: 6;
  allReferencesBound: true;
  hostedFactsVerified: false;
  stage1Complete: false;
};

type BindingOptions = {
  repositoryRoot: string;
  runbook: unknown;
  manifest: unknown;
  sitesReceiptBundle: unknown;
  preCreateReceipt: unknown;
  postCreateReceipt: unknown;
  now?: Date;
};

export class Stage1EvidenceBindingError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'Stage1EvidenceBindingError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new Stage1EvidenceBindingError(code);
}

function asRecord(value: unknown, code: string): JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(code);
  }
  return value as JsonRecord;
}

function epoch(value: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) fail('EVIDENCE_TIMESTAMP_INVALID');
  return timestamp;
}

function assertRunSequence(
  preCreateObservedAtUtc: string,
  postCreateObservedAtUtc: string,
  sites: ReturnType<typeof validateStage1SitesReceiptBundle>,
  now: Date,
): void {
  const pre = epoch(preCreateObservedAtUtc);
  const inventory = epoch(sites.inventoryObservedAtUtc);
  const inventoryReview = epoch(sites.inventoryReviewedAtUtc);
  const create = epoch(sites.createObservedAtUtc);
  const createReview = epoch(sites.createReviewedAtUtc);
  const post = epoch(postCreateObservedAtUtc);
  const save = epoch(sites.saveObservedAtUtc);
  const saveReview = epoch(sites.saveReviewedAtUtc);
  if (
    !(
      pre <= inventory &&
      inventory <= inventoryReview &&
      inventoryReview <= create &&
      create <= createReview &&
      createReview <= post &&
      post <= save &&
      save <= saveReview
    )
  ) {
    fail('EVIDENCE_SEQUENCE_INVALID');
  }
  if (saveReview - pre > 4 * 60 * 60 * 1000) {
    fail('EVIDENCE_RUN_WINDOW_EXCEEDED');
  }
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs) || saveReview > nowMs + 60_000) {
    fail('FINAL_BINDING_CLOCK_INVALID');
  }
  if (nowMs - saveReview > 15 * 60 * 1000) {
    fail('FINAL_BINDING_STALE');
  }
}

function assertReferences(
  manifestValue: unknown,
  sitesBundleValue: unknown,
  preCreateReceiptValue: unknown,
  postCreateReceiptValue: unknown,
): void {
  const manifest = asRecord(manifestValue, 'MANIFEST_INVALID');
  const references = asRecord(
    manifest.evidenceReferences,
    'EVIDENCE_REFERENCES_INVALID',
  );
  const sitesBundle = asRecord(
    sitesBundleValue,
    'RECEIPT_BUNDLE_INVALID',
  );
  const receipts = asRecord(sitesBundle.receipts, 'RECEIPTS_INVALID');
  const computed: Record<string, string> = {
    inventoryReceiptSha256: hashSanitizedReceipt(receipts.inventory),
    preCreationLocalReceiptSha256:
      hashSanitizedReceipt(preCreateReceiptValue),
    createAndRepositoryReceiptSha256: hashSanitizedReceipt(
      receipts.createAndRepository,
    ),
    postCreationLocalReceiptSha256:
      hashSanitizedReceipt(postCreateReceiptValue),
    saveOnlyReceiptSha256: hashSanitizedReceipt(receipts.saveOnly),
    independentReviewBundleSha256: hashSanitizedReceipt(sitesBundle.reviews),
  };
  for (const [key, actualHash] of Object.entries(computed)) {
    if (references[key] !== actualHash) {
      fail('EVIDENCE_REFERENCE_HASH_MISMATCH');
    }
  }
}

export async function verifyStage1EvidenceBinding(
  options: BindingOptions,
): Promise<Stage1EvidenceBindingSummary> {
  const manifestSummary = validateStage1EvidenceManifest(
    options.runbook,
    options.manifest,
  );
  const sitesSummary = validateStage1SitesReceiptBundle(
    options.sitesReceiptBundle,
  );
  const preCreateReceipt = validateStage1LiveReceipt(
    options.preCreateReceipt,
    'PRE_CREATE',
  );
  const postCreateReceipt = validateStage1LiveReceipt(
    options.postCreateReceipt,
    'POST_CREATE',
  );

  const runIds = [
    manifestSummary.evidenceRunId,
    sitesSummary.evidenceRunId,
    preCreateReceipt.evidenceRunId,
    postCreateReceipt.evidenceRunId,
  ];
  if (runIds.some((runId) => runId !== runIds[0])) {
    fail('EVIDENCE_RUN_ID_MISMATCH');
  }

  assertReferences(
    options.manifest,
    options.sitesReceiptBundle,
    options.preCreateReceipt,
    options.postCreateReceipt,
  );

  if (
    preCreateReceipt.observedHead === postCreateReceipt.observedHead ||
    manifestSummary.sourceSha !== postCreateReceipt.observedHead ||
    manifestSummary.sourceSha !== sitesSummary.savedVersionCommitSha
  ) {
    fail('CROSS_PLANE_SHA_MISMATCH');
  }

  assertRunSequence(
    preCreateReceipt.observedAtUtc,
    postCreateReceipt.observedAtUtc,
    sitesSummary,
    options.now ?? new Date(),
  );

  let finalLiveObservation;
  try {
    finalLiveObservation = await runLiveLocalVerification({
      repositoryRoot: options.repositoryRoot,
      expectedHead: manifestSummary.sourceSha,
      phase: 'POST_CREATE',
      evidenceRunId: manifestSummary.evidenceRunId,
    });
  } catch {
    fail('FINAL_LIVE_CHECKOUT_VERIFICATION_FAILED');
  }
  if (
    finalLiveObservation.observedHead !== postCreateReceipt.observedHead ||
    finalLiveObservation.evidenceRunId !== manifestSummary.evidenceRunId
  ) {
    fail('FINAL_LIVE_CHECKOUT_BINDING_MISMATCH');
  }

  return {
    status: 'EVIDENCE_BOUND',
    evidenceRunId: manifestSummary.evidenceRunId,
    actualHead: finalLiveObservation.observedHead,
    referenceCount: 6,
    allReferencesBound: true,
    hostedFactsVerified: false,
    stage1Complete: false,
  };
}

export function assertBindingEvidencePathIsOutsideRepository(
  evidencePath: string,
  repositoryRoot: string,
): void {
  const relativePath = relative(resolve(repositoryRoot), resolve(evidencePath));
  if (
    relativePath === '' ||
    (relativePath !== '..' && !relativePath.startsWith(`..${sep}`))
  ) {
    fail('BINDING_EVIDENCE_MUST_BE_OUTSIDE_REPOSITORY');
  }
}

async function writeBindingReceiptExclusive(
  receiptPath: string,
  summary: Stage1EvidenceBindingSummary,
): Promise<void> {
  try {
    await writeFile(receiptPath, JSON.stringify(summary, null, 2) + '\n', {
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
      fail('BINDING_RECEIPT_ALREADY_EXISTS');
    }
    throw error;
  }
}

type CliArguments = {
  manifestPath: string;
  sitesReceiptsPath: string;
  preCreateReceiptPath: string;
  postCreateReceiptPath: string;
  outputReceiptPath: string;
};

function parseCliArguments(args: string[]): CliArguments {
  if (args.length !== 10) fail('CLI_ARGUMENTS_INVALID');
  const values = new Map<string, string>();
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
  const keys = [
    '--manifest',
    '--sites-receipts',
    '--pre-create-receipt',
    '--post-create-receipt',
    '--receipt',
  ];
  if (
    values.size !== keys.length ||
    keys.some((key) => !values.has(key)) ||
    [...values.values()].some((value) => !isAbsolute(value))
  ) {
    fail('CLI_ARGUMENTS_INVALID');
  }
  return {
    manifestPath: values.get('--manifest') as string,
    sitesReceiptsPath: values.get('--sites-receipts') as string,
    preCreateReceiptPath: values.get('--pre-create-receipt') as string,
    postCreateReceiptPath: values.get('--post-create-receipt') as string,
    outputReceiptPath: values.get('--receipt') as string,
  };
}

async function readExternalJson(
  path: string,
  repositoryRoot: string,
): Promise<unknown> {
  const resolvedPath = await realpath(path);
  assertBindingEvidencePathIsOutsideRepository(resolvedPath, repositoryRoot);
  return JSON.parse(await readFile(resolvedPath, 'utf8')) as unknown;
}

async function runCli(): Promise<void> {
  try {
    const args = parseCliArguments(process.argv.slice(2));
    const repositoryRoot = await realpath(
      fileURLToPath(new URL('../../', import.meta.url)),
    );
    const outputParent = await realpath(dirname(args.outputReceiptPath));
    const outputPath = resolve(
      outputParent,
      basename(args.outputReceiptPath),
    );
    assertBindingEvidencePathIsOutsideRepository(outputPath, repositoryRoot);
    const [runbook, manifest, sitesReceiptBundle, preCreateReceipt, postCreateReceipt] =
      await Promise.all([
        readFile(
          new URL(
            '../../docs/evidence/PACKAGE0_EXTERNAL_RUNBOOK.json',
            import.meta.url,
          ),
          'utf8',
        ).then((text) => JSON.parse(text) as unknown),
        readExternalJson(args.manifestPath, repositoryRoot),
        readExternalJson(args.sitesReceiptsPath, repositoryRoot),
        readExternalJson(args.preCreateReceiptPath, repositoryRoot),
        readExternalJson(args.postCreateReceiptPath, repositoryRoot),
      ]);
    const summary = await verifyStage1EvidenceBinding({
      repositoryRoot,
      runbook,
      manifest,
      sitesReceiptBundle,
      preCreateReceipt,
      postCreateReceipt,
    });
    await writeBindingReceiptExclusive(outputPath, summary);
    process.stdout.write(
      JSON.stringify({
        status: summary.status,
        actualHead: summary.actualHead,
        receiptWritten: true,
      }) + '\n',
    );
  } catch (error) {
    const code =
      error instanceof Stage1EvidenceBindingError
        ? error.code
        : 'EVIDENCE_BINDING_FAILED';
    process.stderr.write(
      JSON.stringify({ status: 'EVIDENCE_NOT_BOUND', code }) + '\n',
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
