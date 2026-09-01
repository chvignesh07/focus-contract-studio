export type ApplicationCandidate = {
  status: string;
  baseImplementedRevision: number;
  activeImplementedRevision: number;
};

export function applicationCandidateError(
  candidate: ApplicationCandidate | null,
  expectedImplementedRevision: number,
): 'PROPOSAL_NOT_FOUND' | 'APPLICATION_STALE' | null {
  if (!candidate) return 'PROPOSAL_NOT_FOUND';
  if (
    candidate.status !== 'approved' ||
    candidate.baseImplementedRevision !== expectedImplementedRevision ||
    candidate.activeImplementedRevision !== expectedImplementedRevision
  ) return 'APPLICATION_STALE';
  return null;
}

export function boundedHistoryLimit(value: number | undefined): number {
  const limit = value ?? 100;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
    throw new Error('INVALID_HISTORY_LIMIT');
  }
  return limit;
}

export function auditHistoryKind(
  action: unknown,
  result: unknown,
): 'reset' | 'failure' | null {
  if (action === 'workspace.reset') return 'reset';
  if (result === 'failure') return 'failure';
  return null;
}
