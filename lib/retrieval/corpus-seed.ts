import { deterministicUuid } from '../server/crypto.ts';
import { materializeCorpusV2 } from './corpus-v2.ts';
import type { RetrievalRecord } from './types.ts';

type ScopeKind = 'context' | 'variant' | 'use_case' | 'family';

type CorpusSeedEdge = {
  id: string;
  targetKind: ScopeKind;
  targetKey: string;
  edgeType: 'applies-to';
  weight: 1000;
};

export type CorpusSeedRecord = {
  source: RetrievalRecord;
  recordId: string;
  databaseStatus: 'active' | 'superseded' | 'quarantined';
  scopeKind: ScopeKind;
  scopeKey: string;
  validFrom: number;
  validUntil: number | null;
  edges: CorpusSeedEdge[];
  lineageId: string | null;
  supersededRecordId: string | null;
};

function unixSeconds(value: string | null): number | null {
  if (value === null) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || milliseconds % 1000 !== 0) {
    throw new Error(`Non-canonical corpus timestamp: ${value}`);
  }
  return milliseconds / 1000;
}

function databaseStatus(
  value: RetrievalRecord['status'],
): CorpusSeedRecord['databaseStatus'] {
  if (value === 'active' || value === 'superseded') return value;
  if (value === 'rejected' || value === 'quarantined') return 'quarantined';
  throw new Error(`Unsupported corpus status: ${value}`);
}

function strongestScope(record: RetrievalRecord): {
  kind: ScopeKind;
  key: string;
} {
  const priority: Record<string, number> = {
    context: 0,
    variant: 1,
    'use-case': 2,
    family: 3,
  };
  const relationship = [...record.relationships].sort((left, right) => {
    const leftKind = left.target.slice(0, left.target.indexOf(':'));
    const rightKind = right.target.slice(0, right.target.indexOf(':'));
    return (priority[leftKind] ?? 99) - (priority[rightKind] ?? 99);
  })[0];
  if (!relationship) throw new Error(`Corpus record ${record.id} has no scope.`);
  const separator = relationship.target.indexOf(':');
  const rawKind = relationship.target.slice(0, separator);
  const key = relationship.target.slice(separator + 1);
  const kind = rawKind === 'use-case' ? 'use_case' : rawKind;
  if (!['context', 'variant', 'use_case', 'family'].includes(kind) || key.length === 0) {
    throw new Error(`Corpus record ${record.id} has an invalid scope.`);
  }
  return { kind: kind as ScopeKind, key };
}

function parseRelationship(
  recordId: string,
  relationship: RetrievalRecord['relationships'][number],
): Omit<CorpusSeedEdge, 'id'> {
  const separator = relationship.target.indexOf(':');
  const rawKind = relationship.target.slice(0, separator);
  const targetKey = relationship.target.slice(separator + 1);
  const targetKind = rawKind === 'use-case' ? 'use_case' : rawKind;
  if (
    relationship.type !== 'applies-to' ||
    !['context', 'variant', 'use_case', 'family'].includes(targetKind) ||
    targetKey.length === 0
  ) {
    throw new Error(`Corpus record ${recordId} has an invalid relationship.`);
  }
  return {
    targetKind: targetKind as ScopeKind,
    targetKey,
    edgeType: 'applies-to',
    weight: 1000,
  };
}

export async function createWorkspaceCorpusSeed(
  workspaceId: string,
): Promise<CorpusSeedRecord[]> {
  const sources = materializeCorpusV2().records.filter(
    (record) => record.workspaceKey === 'demo-seed',
  );
  if (sources.length !== 34) {
    throw new Error('The current-workspace corpus must contain exactly 34 records.');
  }
  const ids = new Map<string, string>();
  for (const source of sources) {
    ids.set(
      source.id,
      await deterministicUuid(`fcs-seed-v2:${workspaceId}:precedent:${source.id}`),
    );
  }
  const seeded: CorpusSeedRecord[] = [];
  for (const source of sources) {
    const scope = strongestScope(source);
    const supersededRecordId = source.supersedes
      ? (ids.get(source.supersedes) ?? null)
      : null;
    seeded.push({
      source,
      recordId: ids.get(source.id)!,
      databaseStatus: databaseStatus(source.status),
      scopeKind: scope.kind,
      scopeKey: scope.key,
      validFrom: unixSeconds(source.validFrom)!,
      validUntil: unixSeconds(source.validTo),
      edges: await Promise.all(
        source.relationships.map(async (relationship, index) => ({
          id: await deterministicUuid(
            `fcs-seed-v2:${workspaceId}:edge:${source.id}:${index}:${relationship.target}`,
          ),
          ...parseRelationship(source.id, relationship),
        })),
      ),
      lineageId: supersededRecordId
        ? await deterministicUuid(
            `fcs-seed-v2:${workspaceId}:lineage:${source.id}:${source.supersedes}`,
          )
        : null,
      supersededRecordId,
    });
  }
  return seeded;
}
