# Data Model: Package 6 Premium Accessible Product Surface

## Migration decision

No migration is required. Package 6 reads existing Package 5 committed records and reuses the existing `workspace_view_state` compare-and-swap update. Presentation state is derived and never persisted.

## Existing durable entities reused

| Entity | Package 6 use | Invariant |
|---|---|---|
| `workspace_view_state` | Active variant and view revision | CAS requires the expected view revision and increments exactly once. |
| `component_variants` | Resolve either allowlisted slug inside the current workspace | Caller never supplies a private variant or workspace ID. |
| Package 5 proposal/review/application entities | Derive Proposal, Review, and Apply stage state | No mutation or authority rule changes. |
| Rehearsal/verification/projection entities | Derive Observe and Verify & history state | Raw events remain private; safe verification/projection DTOs remain bounded. |
| Existing audit/history facts | Render chronological timeline and public operation truth | Append-only records remain authoritative and allowlisted. |

## Derived view models

```ts
type Package6Stage = {
  id: 'observe' | 'precedent' | 'proposal' | 'review' | 'apply' | 'verify-history';
  label: string;
  href: string;
  state: 'complete' | 'current' | 'available';
};

type Package6OperationState = {
  code: Package6PublicCode;
  happened: string;
  revisionChanged: 'yes' | 'no' | 'unknown';
  correlationId: string;
  nextAction: { label: string; target: string };
};

type PublicPrecedentDetail = {
  recordId: string;
  outcomeKey: string;
  sourceKind: 'synthetic-seed' | 'verified-runtime';
  validFrom: string;
  applicability: string;
  lexicalRank: number;
  structuredRank: number;
  relationshipRank: number;
  rrfContribution: string;
  rationaleExcerpt: string;
};
```

## Privacy and authority boundary

- Public variant slugs are allowlisted; private IDs remain server-side.
- Public precedent detail excludes raw source content, workspace/session/identity data, SQL, file paths, and private provenance identifiers.
- Stage and operation state never authorize mutation.
- Receipt presentation reuses an existing committed receipt and does not create a second receipt store.
- WebMCP continues to receive its exact frozen Package 5 bounded projection.
