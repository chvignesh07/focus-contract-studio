import {
  buildQueryText,
  retrievePrecedent,
} from '../retrieval/active-focus';
import type {
  RankedRecord,
  RawRetrievalContext,
  RetrievalResult,
} from '../retrieval/types';
import {
  canonicalFocusConfiguration,
  implementedFocusConfigurationSchema,
  type ImplementedFocusConfiguration,
} from '../domain/focus-configuration';
import { changedFocusFields, FOCUS_FIELDS, type FocusField } from '../domain/proposal';
import { sha256Hex } from './crypto';
import { issueEvidenceToken } from './evidence-token';
import { FcsError } from './errors';
import {
  loadEligiblePrecedents,
  type LoadedPrecedent,
} from './precedent-repository';
import { resolveWorkspaceEvidenceSession } from './workspaces';

export const WEBMCP_CONTRACT_VERSION = 'fcs-webmcp-v2' as const;
export const RETRIEVAL_ALGORITHM = 'rrf-k60-v2' as const;
export const RETRIEVAL_ELIGIBILITY = 'focus-eligibility-v2' as const;

type ActiveRow = {
  variant_id: string;
  slug: 'delete-account-standard' | 'delete-account-danger-emphasis';
  implemented_revision: number;
  configuration_json: string;
};

type ObservationRow = {
  session_id: string;
  first_target_id: string;
  manifest_digest: string;
  event_digest: string;
};

type ProposalRow = {
  id: string;
  base_implemented_revision: number;
  status:
    | 'proposed'
    | 'approved'
    | 'rejected'
    | 'revoked'
    | 'superseded'
    | 'stale'
    | 'applied';
  proposal_hash: string;
  proposal_json: string;
  parent_proposal_id: string | null;
};

export type PublicPrecedentRecord = {
  recordId: string;
  outcomeKey: string;
  sourceKind: 'synthetic-seed' | 'verified-runtime';
  validFrom: string;
  validUntil: string | null;
  applicability: 'exact-context' | 'exact-variant' | 'exact-use-case';
  rationaleExcerpt: string;
  lexicalRank: number | null;
  structuredRank: number | null;
  relationshipRank: number | null;
  rrfContribution: string;
  ranks: [number | null, number | null, number | null];
  rrf: string;
};

export type ActiveFocusReviewResult = {
  ok: true;
  contractVersion: typeof WEBMCP_CONTRACT_VERSION;
  review: {
    variant: ActiveRow['slug'];
    implementedRevision: number;
    implemented: ImplementedFocusConfiguration;
    observation: null | {
      rehearsalSessionId: string;
      observedInitialFocus: string;
      manifestDigest8: string;
      eventDigest8: string;
      trust: 'untrusted-browser-telemetry';
    };
    precedentComparison: {
      label: 'ALIGNED' | 'DECISION_MISMATCH' | 'NO_PRECEDENT' | 'CONFLICT';
      behavior: 'initial-focus';
      implementedOutcome: string;
      precedentOutcome: string | null;
    };
  };
  retrieval: {
    queryToken: string;
    issuedAt: string;
    expiresAt: string;
    algorithm: typeof RETRIEVAL_ALGORITHM;
    disposition: RetrievalResult['disposition'];
    reasonCode: string;
    records: PublicPrecedentRecord[];
  };
  proposal: null | {
    proposalId: string;
    baseImplementedRevision: number;
    proposalDigest8: string;
    changedFields: FocusField[];
    fieldEvidence: Array<{
      field: FocusField;
      recordId: string;
      outcomeKey: string;
    }>;
    status: ProposalRow['status'];
    applied: boolean;
    label: 'NOT APPLIED' | 'APPLIED';
    proposalDigest: string;
    configuration: ImplementedFocusConfiguration;
    summary: string;
    authorKind: 'agent' | 'reviewer';
    createdAt: string;
    parentProposalId: string | null;
  };
};

export type ActiveReviewSnapshot = {
  workspaceId: string;
  variantId: string;
  variant: ActiveRow['slug'];
  implementedRevision: number;
  implemented: ImplementedFocusConfiguration;
  observation: ObservationRow | null;
  context: RawRetrievalContext;
  canonicalContext: string;
  contextDigest: string;
  canonicalResult: string;
  resultDigest: string;
  retrieval: RetrievalResult;
  loadedPrecedents: LoadedPrecedent[];
  sessionToken: Uint8Array;
};

function instant(seconds: number): string {
  if (!Number.isSafeInteger(seconds) || seconds < 0) {
    throw new FcsError('INVALID_TIME', 'The request time is invalid.', 500);
  }
  return new Date(seconds * 1000).toISOString().replace('.000Z', 'Z');
}

function rationaleExcerpt(value: string): string {
  const normalized = value.normalize('NFC').replace(/\s+/gu, ' ').trim();
  const suffix = ' Evidence only — not approval.';
  const maximum = 120 - Array.from(suffix).length;
  const characters = Array.from(normalized);
  const excerpt =
    characters.length <= maximum
      ? normalized
      : `${characters.slice(0, maximum - 1).join('')}…`;
  return `${excerpt}${suffix}`;
}

function applicability(record: RankedRecord): PublicPrecedentRecord['applicability'] {
  if (record.relationshipTier === 0) return 'exact-context';
  if (record.relationshipTier === 1) return 'exact-variant';
  return 'exact-use-case';
}

function publicRecord(
  record: RankedRecord,
  sourceKind: LoadedPrecedent['provenanceKind'],
): PublicPrecedentRecord {
  return {
    recordId: record.id,
    outcomeKey: record.outcomeKey,
    sourceKind,
    validFrom: record.validFrom,
    validUntil: record.validTo,
    applicability: applicability(record),
    rationaleExcerpt: rationaleExcerpt(record.rationale),
    lexicalRank: record.lexicalRank,
    structuredRank: record.structuredRank,
    relationshipRank: record.relationshipRank,
    rrfContribution: record.rrfDisplay,
    ranks: [
      record.lexicalRank,
      record.structuredRank,
      record.relationshipRank,
    ],
    rrf: record.rrfDisplay,
  };
}

export function canonicalRetrievalResult(result: RetrievalResult): string {
  return JSON.stringify({
    algorithm: RETRIEVAL_ALGORITHM,
    eligibility: RETRIEVAL_ELIGIBILITY,
    disposition: result.disposition,
    reasonCode: result.reasonCode,
    records: result.returned.slice(0, 3).map((record) => ({
      recordId: record.id,
      outcomeKey: record.outcomeKey,
      ranks: [
        record.lexicalRank,
        record.structuredRank,
        record.relationshipRank,
      ],
      structuredScore: record.structuredScore,
      relationshipTier: record.relationshipTier,
      rrf: record.rrfDisplay,
    })),
  });
}

function canonicalContext(
  workspaceId: string,
  context: RawRetrievalContext,
): string {
  return JSON.stringify({
    workspaceId,
    product: context.product,
    componentFamily: context.componentFamily,
    useCase: context.useCase,
    variant: context.variant,
    behavior: context.behavior,
    intent: context.intent,
    risk: context.risk,
    observedOutcomeKey: context.observedOutcomeKey,
    mismatchTag: context.mismatchTag,
    shapeTag: context.shapeTag,
    queryText: context.queryText,
    asOf: context.asOf,
  });
}

async function activeRow(
  db: D1Database,
  workspaceId: string,
): Promise<ActiveRow> {
  const row = await db
    .prepare(
      `SELECT v.id AS variant_id, v.slug,
              v.active_implemented_revision AS implemented_revision,
              r.configuration_json
         FROM workspace_view_state s
         JOIN component_variants v
           ON v.workspace_id = s.workspace_id AND v.id = s.active_variant_id
         JOIN implemented_focus_revisions r
           ON r.workspace_id = v.workspace_id
          AND r.variant_id = v.id
          AND r.revision = v.active_implemented_revision
        WHERE s.workspace_id = ?`,
    )
    .bind(workspaceId)
    .first<ActiveRow>();
  if (!row) {
    throw new FcsError(
      'NO_ACTIVE_VARIANT',
      'No active variant is available.',
      409,
    );
  }
  return row;
}

async function latestObservation(
  db: D1Database,
  workspaceId: string,
  variantId: string,
  implementedRevision: number,
): Promise<ObservationRow | null> {
  return db
    .prepare(
      `SELECT c.session_id, c.first_target_id,
              s.manifest_digest, s.event_digest
         FROM initial_focus_observation_commits c
         JOIN observation_sessions s
           ON s.workspace_id = c.workspace_id AND s.id = c.session_id
        WHERE c.workspace_id = ? AND s.variant_id = ?
          AND s.implemented_revision = ? AND s.state = 'finalized'
        ORDER BY c.created_at DESC, c.session_id DESC
        LIMIT 1`,
    )
    .bind(workspaceId, variantId, implementedRevision)
    .first<ObservationRow>();
}

function unsupportedRetrieval(reasonCode: string): RetrievalResult {
  return {
    disposition: 'abstain',
    reasonCode,
    eligibleIds: [],
    lists: { lexical: [], structured: [], relationship: [] },
    returned: [],
  };
}

export async function resolveActiveReviewSnapshot(input: {
  db: D1Database;
  cookieHeader: string | null;
  now: number;
  asOf?: number;
  sessionSecret: string;
}): Promise<ActiveReviewSnapshot> {
  const asOf = input.asOf ?? input.now;
  const session = await resolveWorkspaceEvidenceSession({
    db: input.db,
    cookieHeader: input.cookieHeader,
    now: input.now,
    sessionSecret: input.sessionSecret,
  });
  const active = await activeRow(input.db, session.workspace.id);
  let implemented: ImplementedFocusConfiguration;
  try {
    implemented = implementedFocusConfigurationSchema.parse(
      JSON.parse(active.configuration_json),
    );
  } catch {
    throw new FcsError(
      'NO_ACTIVE_VARIANT',
      'No active variant is available.',
      409,
    );
  }
  const observation = await latestObservation(
    input.db,
    session.workspace.id,
    active.variant_id,
    active.implemented_revision,
  );
  const danger = active.slug === 'delete-account-danger-emphasis';
  const context: RawRetrievalContext = {
    workspaceKey: session.workspace.id,
    product: 'focus-contract-studio',
    componentFamily: 'modal-dialog',
    useCase: 'delete-account',
    variant: active.slug,
    behavior: 'initial-focus',
    intent: 'destructive-confirmation',
    risk: 'irreversible',
    observedOutcomeKey: implemented.initialFocus,
    mismatchTag: danger
      ? 'danger-warning-unacknowledged'
      : 'initial-focus-destructive',
    shapeTag: danger ? 'danger-copy-prominent' : 'reason-input-present',
    queryText: '',
    asOf: instant(asOf),
  };
  context.queryText = buildQueryText(context);

  let loadedPrecedents: LoadedPrecedent[] = [];
  let retrieval: RetrievalResult;
  try {
    loadedPrecedents = await loadEligiblePrecedents(
      input.db,
      session.workspace.id,
      context,
      asOf,
    );
    retrieval = retrievePrecedent(
      loadedPrecedents.map(({ record }) => record),
      context,
    );
  } catch {
    retrieval = unsupportedRetrieval('ELIGIBILITY_DATA_INVALID');
  }
  const contextJson = canonicalContext(session.workspace.id, context);
  const resultJson = canonicalRetrievalResult(retrieval);
  return {
    workspaceId: session.workspace.id,
    variantId: active.variant_id,
    variant: active.slug,
    implementedRevision: active.implemented_revision,
    implemented,
    observation,
    context,
    canonicalContext: contextJson,
    contextDigest: await sha256Hex(contextJson),
    canonicalResult: resultJson,
    resultDigest: await sha256Hex(resultJson),
    retrieval,
    loadedPrecedents,
    sessionToken: session.sessionToken,
  };
}

async function latestProposal(
  db: D1Database,
  workspaceId: string,
  variantId: string,
): Promise<ProposalRow | null> {
  return db
    .prepare(
      `SELECT id, base_implemented_revision, status, proposal_hash, proposal_json,
              parent_proposal_id
         FROM proposals
        WHERE workspace_id = ? AND variant_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1`,
    )
    .bind(workspaceId, variantId)
    .first<ProposalRow>();
}

function publicProposal(
  proposal: ProposalRow,
  implemented: ImplementedFocusConfiguration,
): NonNullable<ActiveFocusReviewResult['proposal']> {
  let document: unknown;
  try {
    document = JSON.parse(proposal.proposal_json);
  } catch {
    throw new Error('Stored proposal is malformed.');
  }
  if (!document || typeof document !== 'object' || !('fieldEvidence' in document)) {
    throw new Error('Stored proposal is malformed.');
  }
  const fieldEvidence = (document as { fieldEvidence?: unknown }).fieldEvidence;
  if (
    !Array.isArray(fieldEvidence) ||
    fieldEvidence.some(
      (entry) =>
        !entry ||
        typeof entry !== 'object' ||
        !('field' in entry) ||
        typeof entry.field !== 'string' ||
        !FOCUS_FIELDS.includes(entry.field as FocusField) ||
        !('recordId' in entry) ||
        typeof entry.recordId !== 'string' ||
        !/^[A-Z][0-9]{3}$/u.test(entry.recordId) ||
        !('normalizedOutcomeKey' in entry) ||
        typeof entry.normalizedOutcomeKey !== 'string' ||
        entry.normalizedOutcomeKey.length < 1 ||
        entry.normalizedOutcomeKey.length > 120,
    )
  ) {
    throw new Error('Stored proposal is malformed.');
  }
  const publicEvidence = fieldEvidence as Array<{
    field: FocusField;
    recordId: string;
    normalizedOutcomeKey: string;
  }>;
  const stored = document as {
    configuration?: unknown;
    summary?: unknown;
    authorKind?: unknown;
    createdAt?: unknown;
  };
  const configuration = implementedFocusConfigurationSchema.safeParse(stored.configuration);
  if (
    !configuration.success ||
    typeof stored.summary !== 'string' ||
    !['agent', 'reviewer'].includes(String(stored.authorKind)) ||
    typeof stored.createdAt !== 'string'
  ) {
    throw new Error('Stored proposal is malformed.');
  }
  if (stored.authorKind === 'agent' && publicEvidence.length < 1) {
    throw new Error('Stored proposal is malformed.');
  }
  const applied = proposal.status === 'applied';
  return {
    proposalId: proposal.id,
    baseImplementedRevision: proposal.base_implemented_revision,
    proposalDigest8: proposal.proposal_hash.slice(0, 8),
    changedFields: changedFocusFields(implemented, configuration.data),
    fieldEvidence: publicEvidence.map(({ field, recordId, normalizedOutcomeKey }) => ({
      field,
      recordId,
      outcomeKey: normalizedOutcomeKey,
    })),
    status: proposal.status,
    applied,
    label: applied ? 'APPLIED' : 'NOT APPLIED',
    proposalDigest: proposal.proposal_hash,
    configuration: configuration.data,
    summary: stored.summary,
    authorKind: stored.authorKind as 'agent' | 'reviewer',
    createdAt: stored.createdAt,
    parentProposalId: proposal.parent_proposal_id,
  };
}

export async function getActiveFocusReview(input: {
  db: D1Database;
  cookieHeader: string | null;
  now: number;
  sessionSecret: string;
}): Promise<ActiveFocusReviewResult> {
  const snapshot = await resolveActiveReviewSnapshot(input);
  const queryToken = await issueEvidenceToken({
    sessionToken: snapshot.sessionToken,
    issuedAt: input.now,
    workspaceId: snapshot.workspaceId,
    variantId: snapshot.variantId,
    implementedRevision: snapshot.implementedRevision,
    contextDigest: snapshot.contextDigest,
    resultDigest: snapshot.resultDigest,
  });
  const proposal = await latestProposal(
    input.db,
    snapshot.workspaceId,
    snapshot.variantId,
  );
  const precedentOutcome = snapshot.retrieval.returned[0]?.outcomeKey ?? null;
  const precedentSources = new Map(
    snapshot.loadedPrecedents.map(({ provenanceKind, record }) => [
      record.id,
      provenanceKind,
    ]),
  );
  const label =
    snapshot.retrieval.disposition === 'conflict'
      ? 'CONFLICT'
      : precedentOutcome === null
        ? 'NO_PRECEDENT'
        : precedentOutcome === snapshot.implemented.initialFocus
          ? 'ALIGNED'
          : 'DECISION_MISMATCH';
  return {
    ok: true,
    contractVersion: WEBMCP_CONTRACT_VERSION,
    review: {
      variant: snapshot.variant,
      implementedRevision: snapshot.implementedRevision,
      implemented: JSON.parse(
        canonicalFocusConfiguration(snapshot.implemented),
      ) as ImplementedFocusConfiguration,
      observation: snapshot.observation
        ? {
            rehearsalSessionId: snapshot.observation.session_id,
            observedInitialFocus: snapshot.observation.first_target_id,
            manifestDigest8: snapshot.observation.manifest_digest.slice(0, 8),
            eventDigest8: snapshot.observation.event_digest.slice(0, 8),
            trust: 'untrusted-browser-telemetry',
          }
        : null,
      precedentComparison: {
        label,
        behavior: 'initial-focus',
        implementedOutcome: snapshot.implemented.initialFocus,
        precedentOutcome,
      },
    },
    retrieval: {
      queryToken,
      issuedAt: instant(input.now),
      expiresAt: instant(input.now + 300),
      algorithm: RETRIEVAL_ALGORITHM,
      disposition: snapshot.retrieval.disposition,
      reasonCode: snapshot.retrieval.reasonCode,
      records: snapshot.retrieval.returned.slice(0, 3).map((record) => {
        const sourceKind = precedentSources.get(record.id);
        if (!sourceKind) {
          throw new Error('Public precedent provenance is unavailable.');
        }
        return publicRecord(record, sourceKind);
      }),
    },
    proposal: proposal ? publicProposal(proposal, snapshot.implemented) : null,
  };
}
