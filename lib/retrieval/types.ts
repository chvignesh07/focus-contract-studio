export type RetrievalRecord = {
  id: string;
  workspaceKey: string;
  product: string;
  componentFamily: string;
  useCase: string;
  variants: string[];
  behavior: string;
  intent: string;
  risk: string;
  outcomeKey: string;
  status: string;
  validFrom: string;
  validTo: string | null;
  supersedes: string | null;
  hostile: boolean;
  mismatchTags: string[];
  shapeTags: string[];
  relationships: Array<{ type: string; target: string }>;
  rationale: string;
  tags: string[];
};

export type RawRetrievalContext = {
  workspaceKey: string;
  product: string;
  componentFamily: string;
  useCase: string;
  variant: string;
  behavior: string;
  intent: string;
  risk: string;
  observedOutcomeKey: string;
  mismatchTag: string;
  shapeTag: string;
  queryText: string;
  asOf: string;
};

export type RankedRecord = RetrievalRecord & {
  lexicalRank: number | null;
  structuredRank: number | null;
  relationshipRank: number | null;
  structuredScore: number;
  relationshipTier: number;
  rrfScore: number;
  rrfDisplay: string;
};

export type RetrievalResult = {
  disposition: 'results' | 'abstain' | 'conflict';
  reasonCode: string;
  eligibleIds: string[];
  lists: {
    lexical: RetrievalRecord[];
    structured: RetrievalRecord[];
    relationship: RetrievalRecord[];
  };
  returned: RankedRecord[];
};
