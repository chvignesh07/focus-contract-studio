import type {
  RawRetrievalContext,
  RetrievalRecord,
  RetrievalResult,
} from './types.ts';
import { bm25Rank, structuredScore } from './bm25.ts';
import { reciprocalRankFusion } from './rrf.ts';

const closedValues = {
  product: new Set(['focus-contract-studio']),
  componentFamily: new Set(['modal-dialog']),
  useCase: new Set(['delete-account']),
  variant: new Set([
    'delete-account-standard',
    'delete-account-danger-emphasis',
  ]),
  behavior: new Set([
    'initial-focus',
    'focus-order',
    'forward-wrap',
    'backward-wrap',
    'escape',
    'return-focus',
  ]),
  intent: new Set(['destructive-confirmation']),
  risk: new Set(['irreversible']),
} as const;

const closedContextTuples = new Set([
  'delete-account-danger-emphasis|backward-wrap|delete-trigger|shift-tab-escapes-dialog|danger-copy-prominent',
  'delete-account-danger-emphasis|backward-wrap|page-body|shift-tab-escapes-dialog|danger-copy-prominent',
  'delete-account-danger-emphasis|escape|dialog-remains-open|escape-does-not-close|danger-copy-prominent',
  'delete-account-danger-emphasis|focus-order|cancel-delete-reason|focus-order-mismatch|danger-copy-prominent',
  'delete-account-danger-emphasis|focus-order|delete-cancel-reason|focus-order-mismatch|danger-copy-prominent',
  'delete-account-danger-emphasis|forward-wrap|background-control|tab-escapes-dialog|danger-copy-prominent',
  'delete-account-danger-emphasis|initial-focus|delete-button|danger-warning-unacknowledged|danger-copy-prominent',
  'delete-account-danger-emphasis|initial-focus|reason-input|danger-warning-unacknowledged|danger-copy-prominent',
  'delete-account-danger-emphasis|return-focus|page-body|return-focus-lost|trigger-remains-mounted',
  'delete-account-standard|backward-wrap|delete-trigger|shift-tab-escapes-dialog|three-tabbable-controls',
  'delete-account-standard|escape|dialog-remains-open|escape-does-not-close|no-irreversible-dispatch-yet',
  'delete-account-standard|escape|focus-remains-in-dialog|escape-does-not-close|no-irreversible-dispatch-yet',
  'delete-account-standard|focus-order|cancel-delete-reason|focus-order-mismatch|reason-input-present',
  'delete-account-standard|focus-order|delete-cancel-reason|focus-order-mismatch|reason-input-present',
  'delete-account-standard|forward-wrap|background-control|tab-escapes-dialog|three-tabbable-controls',
  'delete-account-standard|forward-wrap|delete-trigger|tab-escapes-dialog|three-tabbable-controls',
  'delete-account-standard|initial-focus|delete-button|initial-focus-destructive|reason-input-present',
  'delete-account-standard|initial-focus|delete-button|policy-exception|reason-input-present',
  'delete-account-standard|initial-focus|reason-input|initial-focus-destructive|reason-input-present',
  'delete-account-standard|return-focus|dialog-title|return-focus-lost|trigger-remains-mounted',
  'delete-account-standard|return-focus|page-body|return-focus-lost|trigger-remains-mounted',
]);

export const BEHAVIOR_OUTCOME_ALLOWLIST = {
  'initial-focus': ['cancel-button', 'delete-button', 'dialog-title'],
  escape: ['close', 'prevent-close'],
  'return-focus': ['delete-trigger', 'next-task', 'page-heading'],
  'forward-wrap': ['allow-exit', 'wrap-first'],
  'backward-wrap': ['allow-exit', 'wrap-last'],
  'focus-order': ['cancel-delete', 'delete-cancel-reason', 'reason-cancel-delete'],
} as const;

const outcomeAllowlist = new Map<string, ReadonlySet<string>>(
  Object.entries(BEHAVIOR_OUTCOME_ALLOWLIST).map(([behavior, outcomes]) => [
    behavior,
    new Set(outcomes),
  ]),
);

export function buildQueryText(context: RawRetrievalContext): string {
  return `product=${context.product} family=${context.componentFamily} use_case=${context.useCase} variant=${context.variant} behavior=${context.behavior} observed=${context.observedOutcomeKey} mismatch=${context.mismatchTag} shape=${context.shapeTag} intent=${context.intent} risk=${context.risk}`;
}

function validContext(context: RawRetrievalContext): boolean {
  const canonicalDate = (() => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(context.asOf)) {
      return false;
    }
    const milliseconds = Date.parse(context.asOf);
    return (
      Number.isFinite(milliseconds) &&
      new Date(milliseconds).toISOString().replace('.000Z', 'Z') === context.asOf
    );
  })();
  const tuple = [
    context.variant,
    context.behavior,
    context.observedOutcomeKey,
    context.mismatchTag,
    context.shapeTag,
  ].join('|');
  return (
    Object.entries(closedValues).every(([key, allowed]) =>
      allowed.has(context[key as keyof typeof closedValues] as never),
    ) &&
    context.queryText === buildQueryText(context) &&
    canonicalDate &&
    closedContextTuples.has(tuple)
  );
}

function isEligible(record: RetrievalRecord, context: RawRetrievalContext): boolean {
  return (
    record.workspaceKey === context.workspaceKey &&
    record.product === context.product &&
    record.componentFamily === context.componentFamily &&
    (record.useCase === context.useCase || record.useCase === '*') &&
    (record.variants.includes(context.variant) || record.variants.includes('both')) &&
    record.behavior === context.behavior &&
    (record.intent === context.intent || record.intent === '*') &&
    (record.risk === context.risk || record.risk === '*') &&
    (record.mismatchTags.includes(context.mismatchTag) ||
      record.mismatchTags.includes('*')) &&
    record.status === 'active' &&
    !record.hostile &&
    (outcomeAllowlist.get(record.behavior)?.has(record.outcomeKey) ?? false) &&
    record.validFrom <= context.asOf &&
    (record.validTo === null || record.validTo > context.asOf)
  );
}

function relationshipTier(
  record: RetrievalRecord,
  context: RawRetrievalContext,
): number {
  const targets = [
    `context:${context.variant}|${context.behavior}|${context.mismatchTag}|${context.shapeTag}`,
    `variant:${context.variant}`,
    `use-case:${context.useCase}`,
    `family:${context.componentFamily}`,
  ];
  const index = targets.findIndex((target) =>
    record.relationships.some(
      (relationship) =>
        relationship.type === 'applies-to' && relationship.target === target,
    ),
  );
  return index === -1 ? 4 : index;
}

function rankedRecords(
  records: RetrievalRecord[],
  ranking: Array<{ id: string }>,
): RetrievalRecord[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  return ranking.map((item) => byId.get(item.id)!);
}

export function retrievePrecedent(
  records: RetrievalRecord[],
  context: RawRetrievalContext,
): RetrievalResult {
  const emptyLists = { lexical: [], structured: [], relationship: [] };
  if (!validContext(context)) {
    return {
      disposition: 'abstain',
      reasonCode: 'UNSUPPORTED_CONTEXT',
      eligibleIds: [],
      lists: emptyLists,
      returned: [],
    };
  }
  const activelySuperseded = new Set(
    records
      .filter(
        (record) =>
          record.workspaceKey === context.workspaceKey &&
          record.status === 'active' &&
          !record.hostile &&
          record.validFrom <= context.asOf &&
          (record.validTo === null || record.validTo > context.asOf) &&
          (outcomeAllowlist.get(record.behavior)?.has(record.outcomeKey) ?? false),
      )
      .map((record) => record.supersedes)
      .filter((recordId): recordId is string => recordId !== null),
  );
  const eligible = records
    .filter(
      (record) =>
        isEligible(record, context) && !activelySuperseded.has(record.id),
    )
    .sort((left, right) => left.id.localeCompare(right.id, 'en'));
  if (eligible.length === 0) {
    return {
      disposition: 'abstain',
      reasonCode: 'NO_ELIGIBLE_PRECEDENT',
      eligibleIds: [],
      lists: emptyLists,
      returned: [],
    };
  }
  const lexicalRanking = bm25Rank(eligible, buildQueryText(context));
  const structuredRanking = eligible
    .map((record) => ({
      id: record.id,
      score: structuredScore(record, context),
      validFrom: record.validFrom,
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.validFrom.localeCompare(left.validFrom, 'en') ||
        left.id.localeCompare(right.id, 'en'),
    )
    .slice(0, 12);
  const relationshipRanking = eligible
    .map((record) => ({
      id: record.id,
      tier: relationshipTier(record, context),
      validFrom: record.validFrom,
    }))
    .sort(
      (left, right) =>
        left.tier - right.tier ||
        right.validFrom.localeCompare(left.validFrom, 'en') ||
        left.id.localeCompare(right.id, 'en'),
    )
    .slice(0, 12);
  const lists = {
    lexical: rankedRecords(eligible, lexicalRanking),
    structured: rankedRecords(eligible, structuredRanking),
    relationship: rankedRecords(eligible, relationshipRanking),
  };
  const structuredById = new Map(
    structuredRanking.map((item) => [item.id, item.score]),
  );
  const relationshipById = new Map(
    relationshipRanking.map((item) => [item.id, item.tier]),
  );
  const recordById = new Map(eligible.map((record) => [record.id, record]));
  const fused = reciprocalRankFusion([
    lexicalRanking,
    structuredRanking,
    relationshipRanking,
  ])
    .map((item) => ({
      ...recordById.get(item.id)!,
      lexicalRank: item.ranks[0],
      structuredRank: item.ranks[1],
      relationshipRank: item.ranks[2],
      structuredScore: structuredById.get(item.id) ?? -1,
      relationshipTier: relationshipById.get(item.id) ?? 4,
      rrfScore: item.score,
      rrfDisplay: item.score.toFixed(8),
    }))
    .filter(
      (item) =>
        [item.lexicalRank, item.structuredRank, item.relationshipRank].filter(
          (rank) => rank !== null,
        ).length >= 2 &&
        item.structuredScore >= 60 &&
        item.relationshipTier <= 2,
    )
    .sort(
      (left, right) =>
        right.rrfScore - left.rrfScore ||
        (left.structuredRank ?? Number.POSITIVE_INFINITY) -
          (right.structuredRank ?? Number.POSITIVE_INFINITY) ||
        (left.lexicalRank ?? Number.POSITIVE_INFINITY) -
          (right.lexicalRank ?? Number.POSITIVE_INFINITY) ||
        (left.relationshipRank ?? Number.POSITIVE_INFINITY) -
          (right.relationshipRank ?? Number.POSITIVE_INFINITY) ||
        left.id.localeCompare(right.id, 'en'),
    );
  if (fused.length === 0) {
    return {
      disposition: 'abstain',
      reasonCode: 'NO_SUPPORTED_PRECEDENT',
      eligibleIds: eligible.map((record) => record.id),
      lists,
      returned: [],
    };
  }
  const [first, second] = fused;
  const hasLineage = (left: RetrievalRecord, right: RetrievalRecord) =>
    left.supersedes === right.id || right.supersedes === left.id;
  if (
    first &&
    second &&
    first.relationshipTier <= 1 &&
    second.relationshipTier <= 1 &&
    (first.structuredRank ?? Number.POSITIVE_INFINITY) <= 3 &&
    (second.structuredRank ?? Number.POSITIVE_INFINITY) <= 3 &&
    first.mismatchTags.includes(context.mismatchTag) &&
    second.mismatchTags.includes(context.mismatchTag) &&
    first.shapeTags.includes(context.shapeTag) &&
    second.shapeTags.includes(context.shapeTag) &&
    first.outcomeKey !== second.outcomeKey &&
    !hasLineage(first, second)
  ) {
    return {
      disposition: 'conflict',
      reasonCode: 'EXACT_OUTCOME_CONFLICT',
      eligibleIds: eligible.map((record) => record.id),
      lists,
      returned: fused.slice(0, 2),
    };
  }
  return {
    disposition: 'results',
    reasonCode: 'SUPPORTED_PRECEDENT',
    eligibleIds: eligible.map((record) => record.id),
    lists,
    returned: fused.slice(0, 3),
  };
}
