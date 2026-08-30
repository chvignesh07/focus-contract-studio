import { tokenize, uniqueQueryTokens } from './tokenize.ts';
import type { RawRetrievalContext, RetrievalRecord } from './types.ts';

type WeightedField = readonly [value: string, weight: number];

function weightedFields(record: RetrievalRecord): WeightedField[] {
  return [
    [record.rationale, 2],
    [record.tags.join(' '), 1.5],
    [record.behavior, 1],
    [record.useCase, 1],
    [record.intent, 1],
    [record.risk, 1],
    [record.variants.join(' '), 1],
    [record.mismatchTags.join(' '), 1],
    [record.shapeTags.join(' '), 1],
  ];
}

export function bm25Rank(
  records: RetrievalRecord[],
  queryText: string,
): Array<{ id: string; score: number }> {
  const queryTokens = uniqueQueryTokens(queryText);
  if (records.length === 0 || queryTokens.length === 0) return [];
  const documents = records.map((record) => {
    const termFrequency = new Map<string, number>();
    let length = 0;
    for (const [value, weight] of weightedFields(record)) {
      for (const token of tokenize(value)) {
        termFrequency.set(token, (termFrequency.get(token) ?? 0) + weight);
        length += weight;
      }
    }
    return { record, termFrequency, length };
  });
  const averageLength =
    documents.reduce((sum, document) => sum + document.length, 0) /
    documents.length;
  const k1 = 1.2;
  const b = 0.75;
  return documents
    .map((document) => {
      let score = 0;
      for (const token of queryTokens) {
        const documentFrequency = documents.filter(
          (candidate) => (candidate.termFrequency.get(token) ?? 0) > 0,
        ).length;
        const inverseDocumentFrequency = Math.log(
          1 +
            (documents.length - documentFrequency + 0.5) /
              (documentFrequency + 0.5),
        );
        const frequency = document.termFrequency.get(token) ?? 0;
        if (frequency === 0) continue;
        score +=
          inverseDocumentFrequency *
          ((frequency * (k1 + 1)) /
            (frequency +
              k1 *
                (1 - b + (b * document.length) / averageLength)));
      }
      return { id: document.record.id, score };
    })
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id, 'en'))
    .slice(0, 12);
}

export function structuredScore(
  record: RetrievalRecord,
  context: RawRetrievalContext,
): number {
  return (
    40 +
    (record.useCase === context.useCase ? 20 : 4) +
    (record.variants.includes(context.variant) ? 12 : 6) +
    (record.intent === context.intent ? 8 : 2) +
    (record.risk === context.risk ? 5 : 1) +
    (record.mismatchTags.includes(context.mismatchTag) ? 5 : 0) +
    (record.shapeTags.includes(context.shapeTag) ? 4 : 0)
  );
}
