import baseCorpus from '../../docs/retrieval/fixtures/rrf/rrf-corpus-v1.json' with {
  type: 'json',
};
import corpusOverrides from '../../docs/retrieval/fixtures/rrf/rrf-corpus-overrides-v2.json' with {
  type: 'json',
};

import type { RetrievalRecord } from './types.ts';

type CorpusOverride = {
  id: string;
  replace: Partial<Omit<RetrievalRecord, 'id'>>;
};

export function materializeCorpusV2(): {
  schemaVersion: 2;
  corpusId: 'fcs-rrf-corpus-v2';
  asOf: string;
  records: RetrievalRecord[];
} {
  if (
    baseCorpus.corpusId !== corpusOverrides.baseCorpusId ||
    corpusOverrides.effectiveCorpusId !== 'fcs-rrf-corpus-v2' ||
    corpusOverrides.materializer !== 'whole-field-replace-v1'
  ) {
    throw new Error('The sealed corpus materialization contract is invalid.');
  }
  const records = structuredClone(baseCorpus.records) as RetrievalRecord[];
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const seen = new Set<string>();
  for (const entry of corpusOverrides.overrides as CorpusOverride[]) {
    if (seen.has(entry.id) || !recordsById.has(entry.id) || 'id' in entry.replace) {
      throw new Error(`The sealed corpus override ${entry.id} is invalid.`);
    }
    seen.add(entry.id);
    Object.assign(recordsById.get(entry.id)!, structuredClone(entry.replace));
  }
  if (records.length !== 36 || new Set(records.map((record) => record.id)).size !== 36) {
    throw new Error('The sealed corpus must contain exactly 36 unique records.');
  }
  return {
    schemaVersion: 2,
    corpusId: 'fcs-rrf-corpus-v2',
    asOf: baseCorpus.asOf,
    records,
  };
}
