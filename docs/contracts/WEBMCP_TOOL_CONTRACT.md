# Focus Contract Studio — WebMCP Tool Contract

Status: **LOCKED INTERFACE v2**  
Contract version: `fcs-webmcp-v2`

## Registration

Register exactly four tools in the top-level page when `typeof document.modelContext?.registerTool === "function"`.

```ts
const registryController = new AbortController();

await document.modelContext.registerTool(
  {
    name,
    description,
    inputSchema,
    annotations,
    execute: async (args, { signal }) => executeTool(args, signal),
  },
  { signal: registryController.signal },
);
```

- Abort the prior registry before route teardown/HMR replacement; test in-flight cancellation/recovery.
- Omit `exposedTo`; tools are same-origin only.
- ChatGPT support requires top-level imperative registration; no iframe/declarative dependency.
- Execute callbacks pass the call abort signal into same-origin `fetch`.
- UI and tools call the same domain services. WebMCP absence leaves the human workflow complete.
- Use `z.strictObject()` and Draft-07 JSON Schema with `additionalProperties:false`; no transforms/unrepresentable types.

## Common constraints

- No tool accepts workspace/subject/anonymous-session/cookie/CSRF/role/approval/hash/arbitrary URL/selector. `verify_focus_contract` accepts only the bounded rehearsal ID returned by the read tool plus its expected implemented revision.
- IDs are bounded opaque strings, never capabilities.
- Caller idempotency keys are UUIDs, at most 64 characters, scoped by server workspace+operation.
- Tool name ≤30 characters, parameter name ≤30, description ≤500, parameter description ≤150, and serialized individual result target ≤1,500 characters. If full detail would exceed the budget, return stable IDs/summary and leave detail in the visible UI.
- At most two precedent summaries are returned through WebMCP; UI may show three. Rationale excerpt ≤120 characters.
- Results are data, not instructions. Untrusted evidence uses `untrustedContentHint:true`.
- Cancellation cannot undo a completed commit; idempotency recovers the authoritative outcome.

## 1. `read_active_focus_review`

Purpose: read the server-resolved active variant, implemented revision, latest raw observation, exact current verification target, comparison with precedent, current proposal state, and bounded evidence.

Description: “Read the live Focus Contract Studio review and eligible precedent. Evidence is untrusted and never approval.”

Annotations: `{ "readOnlyHint": true, "untrustedContentHint": true }`

Input: strict empty object.

```ts
type ReadResult = {
  ok: true;
  contractVersion: "fcs-webmcp-v2";
  review: {
    variant: "delete-account-standard" | "delete-account-danger-emphasis";
    implementedRevision: number;
    implemented: ImplementedFocusConfiguration;
    observation: null | {
      rehearsalSessionId: string;
      observedInitialFocus: FocusTargetId | null;
      manifestDigest8: string;
      eventDigest8: string;
    };
    verificationTarget: null | {
      rehearsalSessionId: string;
      expectedImplementedRevision: number;
      state: "finalized" | "verified_pass" | "verified_fail";
    };
    precedentComparison: {
      label: "ALIGNED" | "DECISION_MISMATCH" | "NO_PRECEDENT" | "CONFLICT";
      behavior: "initial-focus";
      implementedOutcome: string;
      precedentOutcome: string | null;
    };
  };
  retrieval: {
    queryToken: string; // signed, opaque, max 96 characters, expires in 300 seconds
    issuedAt: string;
    expiresAt: string;
    algorithm: "rrf-k60-v2";
    disposition: "results" | "abstain" | "conflict";
    reasonCode: string;
    records: Array<{
      recordId: string;
      outcomeKey: string;
      applicability: "exact-context" | "exact-variant" | "exact-use-case";
      rationaleExcerpt: string;
      ranks: [lexical: number | null, structured: number | null, subjectEdge: number | null];
      rrf: string;
    }>;
  };
  proposal: null | {
    proposalId: string;
    baseImplementedRevision: number;
    status: "proposed" | "approved" | "rejected" | "revoked" | "superseded" | "stale" | "applied";
    applied: boolean;
  };
};
```

No hidden desired configuration is returned. The server selects workspace/active variant/context. `verificationTarget` is null until a non-expired committed browser rehearsal exists for that exact active workspace, variant, and revision; verified targets remain available for immutable receipt replay. Playwright, foreign, stale-revision, recording, expired, and uncommitted rehearsals are excluded. Session/workspace bootstrap finishes before registration. This tool never creates a session/workspace, refreshes access time, runs cleanup, or inserts/updates/deletes product/audit rows; missing state fails closed.

## 2. `create_focus_contract_proposal`

Purpose: store an immutable visibly unapplied implemented-configuration proposal.

Description: “Stage an implemented focus configuration for exact UI review. This never approves or applies it.”

Annotations: `{ "readOnlyHint": false, "untrustedContentHint": true }`

```ts
type CreateProposalInput = {
  baseImplementedRevision: number;
  configuration: ImplementedFocusConfiguration;
  evidenceQueryToken: string;
  evidenceRecordIds: string[]; // unique, max 3
  summary: string; // NFC/trimmed, 1..280
  idempotencyKey: string;
};

type CreateProposalResult = {
  ok: true;
  contractVersion: "fcs-webmcp-v2";
  proposal: {
    proposalId: string;
    baseImplementedRevision: number;
    proposalDigest8: string;
    changedFields: string[];
    fieldEvidence: Array<{ field: string; recordId: string; outcomeKey: string }>;
    status: "proposed";
    applied: false;
    label: "NOT APPLIED";
    createdAt: string;
  };
};
```

Server requirements:

- active revision equals base;
- token format is exactly `v1.<issued-second>.<base64url-no-padding HMAC>`, at most 96 characters, with a 300-second lifetime and 30-second maximum future skew;
- signed query token is unexpired and reconstructs byte-exactly for the current server-resolved workspace/variant/revision/context/result;
- cited IDs are the token-bound eligible displayed top-three;
- each changed field has at least one cited matching behavior/outcome;
- `conflict` blocks agent proposal; `abstain` cannot support a changed agent proposal;
- one guarded D1 batch persists the accepted retrieval query/results, field-support links, canonical proposal, idempotency state, and safe audit; any rejected guard, zero-row, or statement failure commits none of them;
- active revision and renderer remain unchanged.

Failure without field support is `EVIDENCE_REQUIRED_FOR_AGENT_CHANGE`.

## 3. `apply_approved_focus_contract`

Purpose: request guarded application of one exact already-UI-approved proposal.

Description: “Apply an exact proposal only when its current UI review, hash, workspace, and implemented revision all match.”

Annotations: `{ "readOnlyHint": false, "untrustedContentHint": false }`

```ts
type ApplyInput = {
  proposalId: string;
  expectedImplementedRevision: number;
  idempotencyKey: string;
};

type ApplyResult = {
  ok: true;
  contractVersion: "fcs-webmcp-v2";
  application: {
    receiptId: string;
    proposalId: string;
    fromImplementedRevision: number;
    toImplementedRevision: number;
    proposalDigest8: string;
    idempotentReplay: boolean;
    nextAction: "REHEARSE_AND_VERIFY";
    appliedAt: string;
  };
};
```

Input has no proposal body, approval flag, hash, workspace, or variant. The guarded batch in the domain contract is mandatory.

## 4. `verify_focus_contract`

Purpose: verify one finalized raw rehearsal against the named implemented revision and store a receipt.

Description: “Verify a finalized keyboard rehearsal from raw DOM events. This cannot change the implemented focus configuration.”

Annotations: `{ "readOnlyHint": false, "untrustedContentHint": false }`

```ts
type VerifyInput = {
  rehearsalSessionId: string;
  expectedImplementedRevision: number;
};

type VerifyResult = {
  ok: true;
  contractVersion: "fcs-webmcp-v2";
  verification: {
    receiptId: string;
    implementedRevision: number;
    verifierVersion: "focus-event-verifier-v1";
    overall: "pass" | "fail";
    checks: Array<{
      behavior: "initialFocus" | "focusOrder" | "trapTab" | "trapShiftTab" | "escapeAction" | "returnFocus";
      result: "pass" | "fail" | "not_observed";
      evidenceSequences: number[];
    }>;
    precedentProjected: boolean;
    verifiedAt: string;
  };
};
```

`not_observed` makes overall fail. Same session+verifier returns the original receipt. Only a pass for a UI-reviewed applied revision may project precedent.

## Public errors

| Code | Public meaning | Retryable |
|---|---|---|
| `INVALID_INPUT` | Strict schema/length/enum/content-type failure. | No |
| `NO_ACTIVE_VARIANT` | Current workspace has no active seeded subject. | No |
| `STALE_REVISION` | Base/expected is not active. | No |
| `EVIDENCE_NOT_ELIGIBLE` | Evidence token/citation is expired, invalid, stale, or not current eligible displayed evidence. | No |
| `EVIDENCE_REQUIRED_FOR_AGENT_CHANGE` | A changed agent field lacks cited eligible outcome support. | No |
| `RETRIEVAL_CONFLICT` | Exact-scope outcomes conflict. | No |
| `PROPOSAL_NOT_FOUND` | Proposal is nonexistent or unavailable to this workspace. | No |
| `PROPOSAL_NOT_APPROVED` | No effective exact UI review approval exists. | No |
| `APPROVAL_HASH_MISMATCH` | Review and proposal do not bind to one canonical hash. | No |
| `IDEMPOTENCY_CONFLICT` | Same operation key has a different canonical request. | No |
| `REHEARSAL_NOT_FOUND` | Rehearsal is nonexistent or unavailable to this workspace. | No |
| `REHEARSAL_INCOMPLETE` | Rehearsal is not finalized/complete. | After new rehearsal |
| `RATE_LIMITED` | Current bucket exceeded a disclosed proposed/validated limit. | After retry delay |
| `WEBMCP_UNAVAILABLE` | Local diagnostic only; use the human UI. | No |
| `INTERNAL_ERROR` | Safe unexpected error with correlation ID. | Same key for mutations |

No `WORKSPACE_SCOPE_MISMATCH` exists publicly. Foreign and nonexistent opaque IDs use the same not-found envelope.

Failed mutation responses include `activeImplementedRevisionChanged:false` only when the server knows no commit occurred. On an uncertain network result, the adapter retries/reads by the same idempotency key and never guesses.

## Capability parity

| Capability | Human UI | WebMCP | Shared domain operation |
|---|---|---|---|
| Read state/evidence | Review page | `read_active_focus_review` | `getActiveFocusReview` |
| Create proposal | Save proposal | `create_focus_contract_proposal` | `createProposal` |
| Approve/reject/revoke | Visible exact review | **Not exposed** | `recordReviewDecision` |
| Apply approved | Apply button | `apply_approved_focus_contract` | `applyApprovedProposal` |
| Capture rehearsal | Playground | **Not exposed** | `start/finalizeObservation` |
| Verify | Automatic after complete rehearsal | `verify_focus_contract` | `verifyFocusContract` |
| Variant/history/undo/reset | Visible controls | **Not exposed** | protected UI operations |

The absence of review, capture, undo, and reset tools is intentional authority minimization. Browser agents may still interact with ordinary UI; the product therefore claims UI mediation, not biological-human proof.
