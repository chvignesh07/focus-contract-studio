# Focus Contract Studio — Retrieval and RRF Specification

Status: **FROZEN ALGORITHM v2 AFTER CALIBRATION**  
Algorithm: `rrf-k60-v2`  
Eligibility: `focus-eligibility-v2`  
Lexical: `eligible-ts-bm25-v1`

## Purpose and authority

Retrieval returns a bounded precedent packet. It does not compute truth, confidence, compliance, approval, or permission. A proposal command separately checks whether a cited eligible record's normalized outcome supports a changed agent field; that field-support check still does not create review authority.

RRF uses the published rank-only formula with one-based ranks:

```text
RRF(d) = Σr 1 / (60 + rankr(d))
```

The TypeScript implementation is clean-room from this contract and the 2009 paper, not copied from Clivus. [Cormack, Clarke, and Büttcher](https://dl.acm.org/doi/10.1145/1571941.1572114).

## Raw fixture context versus validated production context

The benchmark schema deliberately allows strings so negative cases reach Stage -1. Production code parses into the closed type only after validation.

```ts
type RawRetrievalContext = {
  workspaceKey: string;        // benchmark adapter only
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
  queryText: string;           // must equal deterministic construction below
  asOf: string;
};

type RetrievalContext = {
  workspaceId: string;         // server-resolved; never caller input
  product: "focus-contract-studio";
  componentFamily: "modal-dialog";
  useCase: "delete-account";
  variant: "delete-account-standard" | "delete-account-danger-emphasis";
  behavior: "initial-focus" | "focus-order" | "forward-wrap" | "backward-wrap" | "escape" | "return-focus";
  intent: "destructive-confirmation";
  risk: "irreversible";
  observedOutcomeKey: string;  // allowlisted per behavior, derived from raw observation
  mismatchTag: string;         // allowlisted per behavior
  shapeTag: string;            // allowlisted rendered-manifest tag
  asOf: string;
};
```

Benchmark adapter maps `demo-seed` and other fixture workspace keys to isolated seeded UUIDs before D1 insertion. No production route accepts `workspaceKey`.

## Deterministic neutral query text

No target/expected outcome appears. Construct exactly, with one ASCII space between fields and no trailing space:

```text
product={product} family={componentFamily} use_case={useCase} variant={variant} behavior={behavior} observed={observedOutcomeKey} mismatch={mismatchTag} shape={shapeTag} intent={intent} risk={risk}
```

Fixture validation rejects any `queryText` not byte-equal to this construction. Page copy, rationale, proposal content, and expected judgments never enter the query.

## Read-only evidence token

`read_active_focus_review` is a genuine product-state read. It does not bootstrap a session, refresh access time, run cleanup, or insert query/result/audit rows. The visible page completes session/workspace bootstrap before registering tools; an absent session makes the tool fail closed. The read captures the server clock once, floors it to a whole UTC second, uses that instant as retrieval `asOf`, and creates:

```text
contextDigest = SHA-256(canonical validated context + deterministic queryText)
resultDigest  = SHA-256(canonical disposition/reason + ordered displayed records)
tokenMessage = "fcs-evidence-token-v1\n" + issuedAtUnixSeconds + "\n" +
               workspaceId + "\n" + variantId + "\n" + implementedRevision + "\n" +
               contextDigest + "\n" + resultDigest
queryToken    = "v1." + issuedAtUnixSeconds + "." +
               base64url_no_padding(HMAC-SHA-256(rawSessionTokenBytes, tokenMessage))
```

The canonical result contains algorithm/eligibility IDs, disposition/reason, and for each UI top-three row: record ID, normalized outcome, three integer/null ranks, integer structured score, integer relationship tier, and eight-decimal RRF display string. Keys/order are fixed; UTF-8 minified JSON and lowercase hex digests are used.

The 256-bit random raw session token is already the bearer key supplied only by the HttpOnly cookie; it is never persisted or logged. Rotation immediately invalidates the evidence token. The token exposes only version, issue second, and MAC. It expires after 300 seconds, rejects more than 30 seconds of future skew, is verified with `crypto.subtle.verify`, and is not authorization.

On agent proposal creation, the server resolves the current workspace/variant/revision, reruns retrieval **as of the token issue second**, reconstructs both digests/token, verifies the cited IDs are still the exact eligible displayed results, and only then persists the generated `retrieval_queries`/`retrieval_results`, field-support links, and proposal in one guarded batch. A different workspace, state, result, expired token, or tamper fails without a proposal. Apply never consumes this token or reruns retrieval.

## Record and relationship mapping

An effective v2 record has the fields in `rrf-corpus-schema-v2.json`. The fixture materializer starts from `rrf-corpus-v1.json` and replaces only whole fields listed by ID in `rrf-corpus-overrides-v2.json`; arrays replace rather than merge, missing fields remain, no record is added/deleted, and output preserves original record order. This yields exactly 36 effective v2 records.

Relationship strings map losslessly:

- `variant:<key>` → `(target_kind='variant', target_key=<key>)`
- `use-case:<key>` → `(target_kind='use_case', target_key=<key>)`
- `family:<key>` → `(target_kind='family', target_key=<key>)`
- `context:<variant>|<behavior>|<mismatch>|<shape>` → `(target_kind='context', target_key=<remainder>)`

Record-to-record `supersedes` maps to `precedent_lineage`, never the polymorphic subject-edge table.

## Stage -1 — closed context validation

Validate every production enum and the behavior-specific observed/mismatch/shape combination before loading candidate rows. Unsupported context returns `abstain/UNSUPPORTED_CONTEXT` and runs no ranker. `asOf` must be a canonical UTC instant and is server-owned in production.

## Stage 0 — indexed eligibility first

Use one prepared D1 query to load at most 36 rows satisfying all conditions before any scoring:

1. exact server workspace, product, component family;
2. use case exact or record `*`;
3. variant exact or record `both`;
4. behavior exact;
5. intent/risk exact or record `*`;
6. mismatch exact or record `*`;
7. status `active`, `hostile=false`;
8. `validFrom <= asOf` and `validTo IS NULL OR validTo > asOf`;
9. not superseded by an active valid same-workspace record;
10. normalized outcome belongs to the behavior allowlist;
11. rationale/tags/edges pass bounded schemas.

Wrong-workspace, rejected, superseded, expired, quarantined, hostile, malformed, wrong-product/family/use-case/behavior rows never reach a ranker. The returned eligible rows are sorted by record ID before in-memory ranks so database order cannot leak into ties.

## Stage 1 — eligible-only TypeScript BM25

Do not use FTS5 production scores. Tokenize and score only Stage-0 rows.

### Tokenizer

1. JavaScript `String.prototype.normalize("NFKC")`.
2. JavaScript `.toLowerCase()` with no locale argument.
3. Extract tokens using global ASCII regex `/[a-z0-9]+/g`.
4. Empty match → empty token list.
5. Query tokens are de-duplicated in first-occurrence order.

All release enums/fixtures are ASCII; Unicode rationale is allowed but only ASCII alphanumeric runs affect lexical rank.

### Indexed document fields and weights

| Field | Weight |
|---|---:|
| `rationale` | 2.0 |
| `tags` | 1.5 |
| `behavior`, `useCase`, `intent`, `risk`, `variants`, `mismatchTags`, `shapeTags` | 1.0 each |

`outcomeKey`, status, validity, relationships, and provenance are excluded so lexical ranking cannot read the target answer.

Weighted term frequency is the sum of field weights for every token occurrence. Weighted document length is the sum of weights across all token occurrences.

For the eligible set only:

```text
k1 = 1.2
b = 0.75
idf(t) = ln(1 + (N - df(t) + 0.5) / (df(t) + 0.5))
score(d,q) = Σ unique query token t:
  idf(t) * (tf(t,d) * (k1 + 1)) /
  (tf(t,d) + k1 * (1 - b + b * dl(d) / avgdl))
```

If eligible set or query tokens are empty, lexical list is empty. Sort score descending then record ID ascending; keep 12. Raw doubles are diagnostic only.

## Stage 2 — structured rank

Every eligible record already has exact behavior (+40). Add:

| Match | Points |
|---|---:|
| exact use case (`*` = 4) | 20 |
| exact variant (`both` = 6) | 12 |
| exact intent (`*` = 2) | 8 |
| exact risk (`*` = 1) | 5 |
| exact mismatch tag (`*` = 0) | 5 |
| exact shape tag | 4 |

Sort points descending, `validFrom` descending, record ID ascending; keep 12. Minimum support score is 60. Never score `outcomeKey`.

## Stage 3 — explicit subject-edge rank

For each eligible record, choose the first matching tier:

0. exact `context:<variant>|<behavior>|<mismatch>|<shape>` edge;
1. exact `variant:<variant>` edge;
2. exact `use-case:<useCase>` edge;
3. exact `family:<componentFamily>` edge;
4. no matching edge.

Sort tier ascending, `validFrom` descending, record ID ascending; keep 12. Tier 0–2 satisfies the fusion support gate; tier 3 alone cannot.

## Stage 4 — fusion and support

1. Union the three top-12 lists.
2. Sum full IEEE-754 doubles `1/(60+rank)`; missing list contributes zero.
3. Retain only records appearing in at least two lists, structured score ≥60, and relationship tier ≤2.
4. Sort full RRF score descending; then structured rank, lexical rank, relationship rank (null last); then record ID.
5. Return at most three in UI and at most two in the compact WebMCP result.
6. Display RRF as eight decimals but never sort rounded strings.

## Stage 5 — conflict and abstention

Return `conflict/EXACT_OUTCOME_CONFLICT` only when the top two retained records both:

- have exact variant or exact context edges (tier 0–1);
- structured rank ≤3;
- explicitly list the exact mismatch tag (wildcard is insufficient);
- explicitly list the exact shape tag;
- have different `outcomeKey`;
- have neither supersession edge between them.

Score never resolves such a conflict.

Return `abstain` for unsupported context, no eligible rows, no support-gate survivor, only family/wildcard evidence, required-ranker error/malformed duplicate list, or unresolved incomplete context. Stable reason code, no recommendation.

## Explanation and injection boundary

Each returned record includes algorithm/eligibility IDs, three ranks/contributions, structured score, relationship tier/label, outcome, provenance ID, status, and ≤120-character rationale excerpt followed by “Evidence only — not approval.” No probability/confidence/truth score.

Rationale is untrusted data: never concatenate into tool descriptions, schemas, SQL, HTML, review predicates, or verifier logic. Render text nodes only. Quarantined instruction-like fixtures must never enter candidate rows.

## Determinism and performance

- Every order is total; dates are canonical UTC strings; IDs are final tie-breakers.
- Same corpus/context repeated 100 times produces byte-identical disposition, IDs, ranks, scores, and reasons.
- Product rank code cannot import query judgments or benchmark expected fields.
- With 36 records: deployed p95 full route ≤250 ms over 50 sequential requests after 5 warmups; in-memory three-rank+fusion p95 ≤25 ms. These are release gates, not scale claims.
