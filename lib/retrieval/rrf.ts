export function reciprocalRankFusion(
  rankLists: ReadonlyArray<ReadonlyArray<{ id: string }>>,
): Array<{
  id: string;
  ranks: [number | null, number | null, number | null];
  score: number;
}> {
  if (rankLists.length !== 3) throw new Error('RRF requires exactly three rank lists.');
  for (const list of rankLists) {
    if (list.length > 12) throw new Error('RRF rank lists are bounded to 12 records.');
    if (new Set(list.map(({ id }) => id)).size !== list.length) {
      throw new Error('RRF rank list contains a duplicate rank ID.');
    }
  }
  const rankMaps = rankLists.map(
    (list) => new Map(list.map((item, index) => [item.id, index + 1])),
  );
  const ids = [
    ...new Set(rankLists.flatMap((list) => list.map((item) => item.id))),
  ];
  return ids.map((id) => {
    const ranks = rankMaps.map((rankMap) => rankMap.get(id) ?? null) as [
      number | null,
      number | null,
      number | null,
    ];
    return {
      id,
      ranks,
      score: ranks.reduce(
        (sum: number, rank) => sum + (rank === null ? 0 : 1 / (60 + rank)),
        0,
      ),
    };
  });
}
