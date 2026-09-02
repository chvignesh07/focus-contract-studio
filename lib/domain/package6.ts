import { z } from 'zod';

export const PACKAGE6_VARIANTS = [
  'delete-account-standard',
  'delete-account-danger-emphasis',
] as const;

export type Package6Variant = (typeof PACKAGE6_VARIANTS)[number];

export const activeVariantRequestSchema = z
  .object({
    variant: z.enum(PACKAGE6_VARIANTS),
    expectedViewRevision: z.number().int().positive().safe(),
    idempotencyKey: z.uuid(),
  })
  .strict();

export const PACKAGE6_OPERATION_KINDS = [
  'loading',
  'empty',
  'abstention',
  'conflict',
  'validationFailure',
  'staleState',
  'rateLimit',
  'expiredSession',
  'unsupportedWebMCP',
  'uncertainNetwork',
  'recovery',
  'success',
  'verifiedFailure',
  'verifiedPass',
] as const;

export type Package6OperationKind = (typeof PACKAGE6_OPERATION_KINDS)[number];
export type RevisionChange = 'yes' | 'no' | 'unknown';

export type Package6OperationState = {
  kind: Package6OperationKind;
  happened: string;
  revisionChanged: RevisionChange;
  code: string;
  correlationId: string;
  nextAction: {
    label: string;
    target: string;
  };
};

const operationDefinitions: Record<
  Package6OperationKind,
  Omit<Package6OperationState, 'kind' | 'correlationId'>
> = {
  loading: {
    happened: 'The isolated workspace and current review are loading.',
    revisionChanged: 'no',
    code: 'FCS_LOADING',
    nextAction: { label: 'Wait for the current review', target: '#review' },
  },
  empty: {
    happened: 'No committed activity is available for this view yet.',
    revisionChanged: 'no',
    code: 'FCS_EMPTY',
    nextAction: { label: 'Observe the live dialog', target: '#observe' },
  },
  abstention: {
    happened: 'No eligible precedent supports an agent-authored proposal.',
    revisionChanged: 'no',
    code: 'NO_ELIGIBLE_PRECEDENT',
    nextAction: { label: 'Inspect the reviewer-owned novel path', target: '#proposal' },
  },
  conflict: {
    happened: 'Eligible precedent returned conflicting exact outcomes.',
    revisionChanged: 'no',
    code: 'PRECEDENT_CONFLICT',
    nextAction: { label: 'Inspect both outcomes', target: '#precedent' },
  },
  validationFailure: {
    happened: 'The request did not pass the public input boundary.',
    revisionChanged: 'no',
    code: 'INVALID_REQUEST',
    nextAction: { label: 'Review the current safe action', target: '#operation-state' },
  },
  staleState: {
    happened: 'Committed view state changed before this action completed.',
    revisionChanged: 'no',
    code: 'VIEW_STATE_STALE',
    nextAction: { label: 'Reload the active variant', target: '#variant-tabs' },
  },
  rateLimit: {
    happened: 'The bounded local operation limit was reached.',
    revisionChanged: 'no',
    code: 'RATE_LIMITED',
    nextAction: { label: 'Wait before retrying once', target: '#operation-state' },
  },
  expiredSession: {
    happened: 'The isolated anonymous session expired.',
    revisionChanged: 'no',
    code: 'SESSION_EXPIRED',
    nextAction: { label: 'Reload a new isolated workspace', target: '#review' },
  },
  unsupportedWebMCP: {
    happened: 'Site tools are unavailable; the complete human workflow remains available.',
    revisionChanged: 'no',
    code: 'WEBMCP_UNSUPPORTED',
    nextAction: { label: 'Continue with the human workflow', target: '#review' },
  },
  uncertainNetwork: {
    happened: 'The response was lost or uncertain; success has not been guessed.',
    revisionChanged: 'unknown',
    code: 'OUTCOME_UNCERTAIN',
    nextAction: { label: 'Recover with the identical key', target: '#operation-state' },
  },
  recovery: {
    happened: 'The original operation key is recovering committed truth.',
    revisionChanged: 'unknown',
    code: 'RECOVERING_RECEIPT',
    nextAction: { label: 'Wait for receipt recovery', target: '#operation-state' },
  },
  success: {
    happened: 'The requested visible operation committed.',
    revisionChanged: 'no',
    code: 'OPERATION_COMMITTED',
    nextAction: { label: 'Inspect durable history', target: '#verify-history' },
  },
  verifiedFailure: {
    happened: 'The fresh raw rehearsal did not match every rendered-revision rule.',
    revisionChanged: 'no',
    code: 'VERIFICATION_FAIL',
    nextAction: { label: 'Run a fresh rehearsal', target: '#observe' },
  },
  verifiedPass: {
    happened: 'The fresh raw rehearsal matched all six rendered-revision rules.',
    revisionChanged: 'no',
    code: 'VERIFICATION_PASS',
    nextAction: { label: 'Inspect projection and history', target: '#verify-history' },
  },
};

const publicCodeKinds: Record<string, Package6OperationKind> = {
  ...Object.fromEntries(
    Object.entries(operationDefinitions).map(([kind, value]) => [value.code, kind]),
  ) as Record<string, Package6OperationKind>,
  APPLICATION_IN_PROGRESS: 'recovery',
  PROPOSAL_IN_PROGRESS: 'recovery',
  RESET_IN_PROGRESS: 'recovery',
  REVIEW_IN_PROGRESS: 'recovery',
  UNDO_IN_PROGRESS: 'recovery',
  APPLICATION_STALE: 'staleState',
  STALE_REVISION: 'staleState',
  UNDO_STALE: 'staleState',
  IDEMPOTENCY_CONFLICT: 'staleState',
  APPLICATION_WRITE_FAILED: 'uncertainNetwork',
  PROPOSAL_WRITE_FAILED: 'uncertainNetwork',
  REVIEW_WRITE_FAILED: 'uncertainNetwork',
  UNDO_WRITE_FAILED: 'uncertainNetwork',
  INVALID_INPUT: 'validationFailure',
  INVALID_JSON: 'validationFailure',
  UNSUPPORTED_MEDIA_TYPE: 'validationFailure',
  BODY_TOO_LARGE: 'validationFailure',
  PROPOSAL_NOT_APPROVED: 'validationFailure',
  CSRF_REJECTED: 'validationFailure',
  ORIGIN_REJECTED: 'validationFailure',
  VARIANT_NOT_FOUND: 'validationFailure',
  SESSION_INVALID: 'expiredSession',
};

export function stateKindForPublicCode(code: string): Package6OperationKind {
  return publicCodeKinds[code] ?? 'uncertainNetwork';
}

export function operationState(
  kind: Package6OperationKind,
  override: Partial<Pick<
    Package6OperationState,
    'happened' | 'revisionChanged' | 'code' | 'correlationId'
  >> = {},
): Package6OperationState {
  const base = operationDefinitions[kind];
  return {
    kind,
    happened: override.happened ?? base.happened,
    revisionChanged: override.revisionChanged ?? base.revisionChanged,
    code: override.code ?? base.code,
    correlationId:
      override.correlationId ??
      `local-${kind.replace(/[A-Z]/gu, (value) => `-${value.toLowerCase()}`)}`,
    nextAction: { ...base.nextAction },
  };
}

export type Package6Stage = {
  id:
    | 'observe'
    | 'precedent'
    | 'proposal'
    | 'review'
    | 'apply'
    | 'verify-history';
  label: string;
  href: string;
  state: 'complete' | 'current' | 'available';
};

export function derivePackage6Stages(input: {
  observed: boolean;
  retrievalResolved: boolean;
  proposalStatus: string | null;
  applied: boolean;
  verified: boolean;
  historyKinds: string[];
}): Package6Stage[] {
  const history = new Set(input.historyKinds);
  const reviewed =
    input.proposalStatus !== null && input.proposalStatus !== 'proposed';
  const applied =
    input.applied || input.proposalStatus === 'applied' || history.has('application');
  const verified = input.verified || history.has('verification');
  const definitions = [
    ['observe', 'Observe', '#observe', input.observed],
    ['precedent', 'Precedent', '#precedent', input.retrievalResolved],
    ['proposal', 'Proposal', '#proposal', input.proposalStatus !== null],
    ['review', 'Review', '#review-authority', reviewed],
    ['apply', 'Apply', '#apply', applied],
    ['verify-history', 'Verify & history', '#verify-history', verified],
  ] as const;
  const current = definitions.findIndex((entry) => !entry[3]);
  return definitions.map(([id, label, href, complete], index) => ({
    id,
    label,
    href,
    state: complete ? 'complete' : index === current ? 'current' : 'available',
  }));
}
