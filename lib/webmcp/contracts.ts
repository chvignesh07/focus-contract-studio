import { z } from 'zod';

import {
  focusTargetSchema,
  implementedFocusConfigurationSchema,
} from '../domain/focus-configuration.ts';
import { CHECK_BEHAVIORS, VERIFIER_VERSION } from '../domain/focus-event-verifier.ts';
import { rehearsalSessionIdSchema } from '../domain/focus-rehearsal.ts';
import { applyRequestSchema } from '../domain/package5.ts';
import { FOCUS_FIELDS, createProposalInputSchema } from '../domain/proposal.ts';

export const PACKAGE2_TOOL_NAMES = [
  'read_active_focus_review',
  'create_focus_contract_proposal',
] as const;

export const FCS_WEBMCP_V2_TOOL_NAMES = [
  'read_active_focus_review',
  'create_focus_contract_proposal',
  'apply_approved_focus_contract',
  'verify_focus_contract',
] as const;

type ToolName = (typeof PACKAGE2_TOOL_NAMES)[number];
type FcsWebMcpV2ToolName = (typeof FCS_WEBMCP_V2_TOOL_NAMES)[number];

type ToolInputSchema = Record<string, unknown> & {
  $schema?: string;
  additionalProperties?: boolean;
  properties?: Record<string, unknown>;
  required?: string[];
};

export type RegisteredPackage2Tool = {
  name: ToolName;
  description: string;
  inputSchema: ToolInputSchema;
  annotations: {
    readOnlyHint: boolean;
    untrustedContentHint: true;
  };
  execute: (
    input: unknown,
    context: { signal: AbortSignal },
  ) => Promise<unknown>;
};

export type RegisteredFcsWebMcpV2Tool = {
  name: FcsWebMcpV2ToolName;
  description: string;
  inputSchema: ToolInputSchema;
  annotations: {
    readOnlyHint: boolean;
    untrustedContentHint: boolean;
  };
  execute: (
    input: unknown,
    context: { signal: AbortSignal },
  ) => Promise<unknown>;
};

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const readInputSchema = z.object({}).strict();
const webMcpCreateInputSchema = createProposalInputSchema.safeExtend({
  summary: z.string().min(1).max(280),
});
const verifyInputSchema = z.object({
  rehearsalSessionId: rehearsalSessionIdSchema,
  expectedImplementedRevision: z.number().int().positive(),
}).strict();

function draft7(schema: z.ZodType): RegisteredPackage2Tool['inputSchema'] {
  return z.toJSONSchema(schema, {
    target: 'draft-07',
    io: 'input',
  }) as RegisteredPackage2Tool['inputSchema'];
}

function webMcpDraft7(schema: z.ZodType): ToolInputSchema {
  const result = draft7(schema);
  const evidenceRecordIds = result.properties?.evidenceRecordIds;
  if (evidenceRecordIds && typeof evidenceRecordIds === 'object') {
    (evidenceRecordIds as Record<string, unknown>).uniqueItems = true;
  }
  return result;
}

async function responseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length > 64 * 1024) throw new Error('TOOL_RESPONSE_TOO_LARGE');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error('TOOL_RESPONSE_INVALID');
  }
  if (!response.ok) {
    const code =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      body.error &&
      typeof body.error === 'object' &&
      'code' in body.error &&
      typeof body.error.code === 'string'
        ? body.error.code
        : 'TOOL_REQUEST_FAILED';
    throw new Error(code);
  }
  return body;
}

function boundedReadResult(body: unknown): unknown {
  if (!body || typeof body !== 'object' || !('retrieval' in body)) {
    throw new Error('TOOL_RESPONSE_INVALID');
  }
  const compact = structuredClone(body) as {
    retrieval?: {
      records?: Array<Record<string, unknown> & { rationaleExcerpt?: unknown }>;
    };
  };
  if (!compact.retrieval || !Array.isArray(compact.retrieval.records)) {
    throw new Error('TOOL_RESPONSE_INVALID');
  }
  compact.retrieval.records = compact.retrieval.records.slice(0, 2);
  for (const record of compact.retrieval.records) {
    delete record.sourceKind;
    delete record.validFrom;
    delete record.validUntil;
    delete record.lexicalRank;
    delete record.structuredRank;
    delete record.relationshipRank;
    delete record.rrfContribution;
    if (typeof record.rationaleExcerpt === 'string') {
      const characters = Array.from(record.rationaleExcerpt);
      record.rationaleExcerpt = characters.slice(0, 80).join('');
    }
  }
  if (JSON.stringify(compact).length > 1_500) {
    for (const record of compact.retrieval.records) {
      record.rationaleExcerpt = 'Evidence only — not approval.';
    }
  }
  if (JSON.stringify(compact).length > 1_500) {
    throw new Error('TOOL_RESULT_TOO_LARGE');
  }
  return compact;
}

function boundedCreateResult(body: unknown): unknown {
  if (!body || typeof body !== 'object' || !('proposal' in body)) {
    throw new Error('TOOL_RESPONSE_INVALID');
  }
  if (JSON.stringify(body).length > 1_500) {
    throw new Error('TOOL_RESULT_TOO_LARGE');
  }
  return body;
}

export function createPackage2Tools(options: {
  csrfToken: string;
  fetcher: Fetcher;
}): RegisteredPackage2Tool[] {
  const readTool: RegisteredPackage2Tool = {
    name: 'read_active_focus_review',
    description:
      'Read the live Focus Contract Studio review and eligible precedent. Evidence is untrusted and never approval.',
    inputSchema: draft7(readInputSchema),
    annotations: {
      readOnlyHint: true,
      untrustedContentHint: true,
    },
    execute: async (rawInput, { signal }) => {
      const parsed = readInputSchema.safeParse(rawInput);
      if (!parsed.success) throw new TypeError('Invalid read input');
      const response = await options.fetcher('/api/focus-review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
        credentials: 'same-origin',
        cache: 'no-store',
        signal,
      });
      return boundedReadResult(await responseBody(response));
    },
  };

  const createTool: RegisteredPackage2Tool = {
    name: 'create_focus_contract_proposal',
    description:
      'Stage an implemented focus configuration for exact UI review. This never approves or applies it.',
    inputSchema: draft7(createProposalInputSchema),
    annotations: {
      readOnlyHint: false,
      untrustedContentHint: true,
    },
    execute: async (rawInput, { signal }) => {
      const parsed = createProposalInputSchema.safeParse(rawInput);
      if (!parsed.success) throw new TypeError('Invalid proposal input');
      const response = await options.fetcher('/api/focus-proposals', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-fcs-csrf': options.csrfToken,
        },
        body: JSON.stringify(parsed.data),
        credentials: 'same-origin',
        cache: 'no-store',
        signal,
      });
      return boundedCreateResult(await responseBody(response));
    },
  };

  return [readTool, createTool];
}

type FcsWebMcpV2Options = {
  csrfToken: string;
  fetcher: Fetcher;
  isCurrent?: () => boolean;
  lifecycleSignal?: AbortSignal;
};

const CONTRACT_VERSION = 'fcs-webmcp-v2' as const;
const MAX_RESULT_CHARACTERS = 1_500;
const PUBLIC_TOOL_ERRORS = new Set([
  'INVALID_INPUT',
  'NO_ACTIVE_VARIANT',
  'STALE_REVISION',
  'EVIDENCE_NOT_ELIGIBLE',
  'EVIDENCE_REQUIRED_FOR_AGENT_CHANGE',
  'RETRIEVAL_CONFLICT',
  'PROPOSAL_NOT_FOUND',
  'PROPOSAL_NOT_APPROVED',
  'APPROVAL_HASH_MISMATCH',
  'IDEMPOTENCY_CONFLICT',
  'REHEARSAL_NOT_FOUND',
  'REHEARSAL_INCOMPLETE',
  'RATE_LIMITED',
  'WEBMCP_UNAVAILABLE',
  'INTERNAL_ERROR',
  'TOOL_RESPONSE_TOO_LARGE',
  'TOOL_RESPONSE_INVALID',
  'TOOL_RESULT_TOO_LARGE',
]);

function invalidResponse(): never {
  throw new Error('TOOL_RESPONSE_INVALID');
}

function publicToolError(error: unknown): Error {
  if (error instanceof DOMException && error.name === 'AbortError') return error;
  const code = error instanceof Error ? error.message : '';
  if (code === 'VERIFICATION_NOT_FOUND') return new Error('REHEARSAL_NOT_FOUND');
  if (code === 'VERIFICATION_INVALID') return new Error('REHEARSAL_INCOMPLETE');
  return new Error(PUBLIC_TOOL_ERRORS.has(code) ? code : 'INTERNAL_ERROR');
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalidResponse();
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown): string {
  if (typeof value !== 'string') invalidResponse();
  return value;
}

function numberValue(value: unknown): number {
  if (!Number.isSafeInteger(value)) invalidResponse();
  return value as number;
}

function booleanValue(value: unknown): boolean {
  if (typeof value !== 'boolean') invalidResponse();
  return value;
}

function arrayValue(value: unknown): unknown[] {
  if (!Array.isArray(value)) invalidResponse();
  return value;
}

function oneOf<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
): Values[number] {
  if (typeof value !== 'string' || !values.includes(value)) invalidResponse();
  return value as Values[number];
}

function implementedConfiguration(value: unknown) {
  const parsed = implementedFocusConfigurationSchema.safeParse(value);
  if (!parsed.success) invalidResponse();
  return parsed.data;
}

function focusTarget(value: unknown) {
  const parsed = focusTargetSchema.safeParse(value);
  if (!parsed.success) invalidResponse();
  return parsed.data;
}

function bounded<T>(value: T): T {
  if (JSON.stringify(value).length > MAX_RESULT_CHARACTERS) {
    throw new Error('TOOL_RESULT_TOO_LARGE');
  }
  return value;
}

function readiness(options: FcsWebMcpV2Options, signal: AbortSignal): void {
  signal.throwIfAborted();
  if (options.isCurrent?.() === false) throw new Error('STALE_REVISION');
}

function executionSignal(
  options: FcsWebMcpV2Options,
  callSignal: unknown,
): AbortSignal {
  let normalizedSignal: AbortSignal;
  if (callSignal instanceof AbortSignal) {
    normalizedSignal = callSignal;
  } else if (typeof callSignal === 'object' && callSignal !== null) {
    const controller = new AbortController();
    try {
      const aborted = Reflect.get(callSignal, 'aborted');
      const addEventListener = Reflect.get(callSignal, 'addEventListener');
      if (typeof aborted !== 'boolean' || typeof addEventListener !== 'function') {
        return options.lifecycleSignal ?? controller.signal;
      }
      if (aborted) {
        controller.abort();
      } else {
        addEventListener.call(callSignal, 'abort', () => controller.abort(), {
          once: true,
        });
        if (Reflect.get(callSignal, 'aborted') === true) controller.abort();
      }
      normalizedSignal = controller.signal;
    } catch {
      return options.lifecycleSignal ?? controller.signal;
    }
  } else {
    return options.lifecycleSignal ?? new AbortController().signal;
  }
  return options.lifecycleSignal
    ? AbortSignal.any([normalizedSignal, options.lifecycleSignal])
    : normalizedSignal;
}

async function requestBody(
  options: FcsWebMcpV2Options,
  input: RequestInfo | URL,
  init: RequestInit,
  retryUncertainMutation = false,
): Promise<unknown> {
  const signal = init.signal as AbortSignal;
  for (let attempt = 0; ; attempt += 1) {
    readiness(options, signal);
    try {
      const response = await options.fetcher(input, init);
      readiness(options, signal);
      const body = await responseBody(response);
      readiness(options, signal);
      return body;
    } catch (error) {
      if (
        !retryUncertainMutation ||
        attempt > 0 ||
        signal.aborted ||
        !(error instanceof TypeError)
      ) {
        throw publicToolError(error);
      }
    }
  }
}

function mutationInit(
  options: FcsWebMcpV2Options,
  body: unknown,
  signal: AbortSignal,
): RequestInit {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-fcs-csrf': options.csrfToken,
    },
    body: JSON.stringify(body),
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  };
}

function readResult(body: unknown): unknown {
  const root = objectValue(body);
  const review = objectValue(root.review);
  const comparison = objectValue(review.precedentComparison);
  const retrieval = objectValue(root.retrieval);
  const observation = review.observation === null
    ? null
    : objectValue(review.observation);
  const proposal = root.proposal === null ? null : objectValue(root.proposal);
  const records = arrayValue(retrieval.records).slice(0, 2).map((value) => {
    const record = objectValue(value);
    const ranks = arrayValue(record.ranks);
    if (ranks.length !== 3 || ranks.some((rank) => rank !== null && !Number.isSafeInteger(rank))) {
      invalidResponse();
    }
    return {
      recordId: stringValue(record.recordId),
      outcomeKey: stringValue(record.outcomeKey),
      applicability: oneOf(record.applicability, [
        'exact-context',
        'exact-variant',
        'exact-use-case',
      ] as const),
      rationaleExcerpt: Array.from(stringValue(record.rationaleExcerpt)).slice(0, 120).join(''),
      ranks,
      rrf: stringValue(record.rrf),
    };
  });
  const result = {
    ok: true,
    contractVersion: CONTRACT_VERSION,
    review: {
      variant: oneOf(review.variant, [
        'delete-account-standard',
        'delete-account-danger-emphasis',
      ] as const),
      implementedRevision: numberValue(review.implementedRevision),
      implemented: implementedConfiguration(review.implemented),
      observation: observation && {
        rehearsalSessionId: stringValue(observation.rehearsalSessionId),
        observedInitialFocus: observation.observedInitialFocus === null
          ? null
          : focusTarget(observation.observedInitialFocus),
        manifestDigest8: stringValue(observation.manifestDigest8),
        eventDigest8: stringValue(observation.eventDigest8),
      },
      precedentComparison: {
        label: oneOf(comparison.label, [
          'ALIGNED',
          'DECISION_MISMATCH',
          'NO_PRECEDENT',
          'CONFLICT',
        ] as const),
        behavior: oneOf(comparison.behavior, ['initial-focus'] as const),
        implementedOutcome: stringValue(comparison.implementedOutcome),
        precedentOutcome: comparison.precedentOutcome === null
          ? null
          : stringValue(comparison.precedentOutcome),
      },
    },
    retrieval: {
      queryToken: stringValue(retrieval.queryToken),
      issuedAt: stringValue(retrieval.issuedAt),
      expiresAt: stringValue(retrieval.expiresAt),
      algorithm: oneOf(retrieval.algorithm, ['rrf-k60-v2'] as const),
      disposition: oneOf(retrieval.disposition, ['results', 'abstain', 'conflict'] as const),
      reasonCode: stringValue(retrieval.reasonCode),
      records,
    },
    proposal: proposal && {
      proposalId: stringValue(proposal.proposalId),
      baseImplementedRevision: numberValue(proposal.baseImplementedRevision),
      status: oneOf(proposal.status, [
        'proposed',
        'approved',
        'rejected',
        'revoked',
        'superseded',
        'stale',
        'applied',
      ] as const),
      applied: booleanValue(proposal.applied),
    },
  };
  if (JSON.stringify(result).length > MAX_RESULT_CHARACTERS) {
    for (const record of result.retrieval.records) {
      record.rationaleExcerpt = Array.from(record.rationaleExcerpt).slice(0, 60).join('');
    }
  }
  return bounded(result);
}

function createResult(body: unknown): unknown {
  const proposal = objectValue(objectValue(body).proposal);
  return bounded({
    ok: true,
    contractVersion: CONTRACT_VERSION,
    proposal: {
      proposalId: stringValue(proposal.proposalId),
      baseImplementedRevision: numberValue(proposal.baseImplementedRevision),
      proposalDigest8: stringValue(proposal.proposalDigest8),
      changedFields: arrayValue(proposal.changedFields).map((field) => oneOf(field, FOCUS_FIELDS)),
      fieldEvidence: arrayValue(proposal.fieldEvidence).map((value) => {
        const evidence = objectValue(value);
        return {
          field: oneOf(evidence.field, FOCUS_FIELDS),
          recordId: stringValue(evidence.recordId),
          outcomeKey: stringValue(evidence.outcomeKey),
        };
      }),
      status: oneOf(proposal.status, ['proposed'] as const),
      applied: proposal.applied === false ? false : invalidResponse(),
      label: oneOf(proposal.label, ['NOT APPLIED'] as const),
      createdAt: stringValue(proposal.createdAt),
    },
  });
}

function applyResult(body: unknown): unknown {
  const receipt = objectValue(objectValue(body).receipt);
  return bounded({
    ok: true,
    contractVersion: CONTRACT_VERSION,
    application: {
      receiptId: stringValue(receipt.receiptId),
      proposalId: stringValue(receipt.proposalId),
      fromImplementedRevision: numberValue(receipt.fromRevision),
      toImplementedRevision: numberValue(receipt.toRevision),
      proposalDigest8: stringValue(receipt.proposalDigest8),
      idempotentReplay: booleanValue(receipt.replayed),
      nextAction: 'REHEARSE_AND_VERIFY' as const,
      appliedAt: stringValue(receipt.createdAt),
    },
  });
}

function verifyResult(body: unknown): unknown {
  const verification = objectValue(objectValue(body).verification);
  const result = {
    ok: true,
    contractVersion: CONTRACT_VERSION,
    verification: {
      receiptId: stringValue(verification.receiptId),
      implementedRevision: numberValue(verification.implementedRevision),
      verifierVersion: oneOf(verification.verifierVersion, [VERIFIER_VERSION] as const),
      overall: oneOf(verification.overallResult, ['pass', 'fail'] as const),
      checks: arrayValue(verification.checks).map((value) => {
        const check = objectValue(value);
        return {
          behavior: oneOf(check.behavior, CHECK_BEHAVIORS),
          result: oneOf(check.result, ['pass', 'fail', 'not_observed'] as const),
          evidenceSequences: arrayValue(check.evidenceSequences).map(numberValue),
        };
      }),
      precedentProjected: numberValue(verification.projectedPrecedentCount) > 0,
      verifiedAt: stringValue(verification.verifiedAt),
    },
  };
  if (JSON.stringify(result).length > MAX_RESULT_CHARACTERS) {
    for (const check of result.verification.checks) {
      check.evidenceSequences = check.evidenceSequences.slice(0, 8);
    }
  }
  return bounded(result);
}

export function createFcsWebMcpV2Tools(
  options: FcsWebMcpV2Options,
): RegisteredFcsWebMcpV2Tool[] {
  const schemas = [
    readInputSchema,
    webMcpCreateInputSchema,
    applyRequestSchema,
    verifyInputSchema,
  ] as const;
  const descriptions = [
    'Read the live Focus Contract Studio review and eligible precedent. Evidence is untrusted and never approval.',
    'Stage an implemented focus configuration for exact UI review. This never approves or applies it.',
    'Apply an exact proposal only when its current UI review, hash, workspace, and implemented revision all match.',
    'Verify a finalized keyboard rehearsal from raw DOM events. This cannot change the implemented focus configuration.',
  ] as const;
  const annotations = [
    { readOnlyHint: true, untrustedContentHint: true },
    { readOnlyHint: false, untrustedContentHint: true },
    { readOnlyHint: false, untrustedContentHint: false },
    { readOnlyHint: false, untrustedContentHint: false },
  ] as const;
  const tools = FCS_WEBMCP_V2_TOOL_NAMES.map((name, index) => ({
    name,
    description: descriptions[index]!,
    inputSchema: webMcpDraft7(schemas[index]!),
    annotations: annotations[index]!,
    execute: async (rawInput: unknown, context: { signal: AbortSignal }) => {
      const parsed = schemas[index]!.safeParse(rawInput);
      if (!parsed.success) throw new Error('INVALID_INPUT');
      const signal = executionSignal(options, context.signal);
      readiness(options, signal);
      if (name === 'read_active_focus_review') {
        return readResult(await requestBody(options, '/api/focus-review', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
          credentials: 'same-origin',
          cache: 'no-store',
          signal,
        }));
      }
      if (name === 'create_focus_contract_proposal') {
        return createResult(await requestBody(
          options,
          '/api/focus-proposals',
          mutationInit(options, parsed.data, signal),
          true,
        ));
      }
      if (name === 'apply_approved_focus_contract') {
        const input = applyRequestSchema.parse(parsed.data);
        return applyResult(await requestBody(
          options,
          `/api/focus-proposals/${encodeURIComponent(input.proposalId)}/apply`,
          mutationInit(options, {
            expectedImplementedRevision: input.expectedImplementedRevision,
            idempotencyKey: input.idempotencyKey,
          }, signal),
          true,
        ));
      }
      const input = verifyInputSchema.parse(parsed.data);
      return verifyResult(await requestBody(
        options,
        '/api/verifications',
        mutationInit(options, {
          rehearsalSessionId: input.rehearsalSessionId,
          implementedRevision: input.expectedImplementedRevision,
        }, signal),
        true,
      ));
    },
  }));
  return tools;
}
