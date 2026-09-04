# Focus Contract Studio documentation

This index separates the product story, implementation contracts, verification
evidence, and historical delivery records so readers can find the right level of
detail quickly.

## Start here

| Reader | Best first document |
|---|---|
| Judge or product reviewer | [Project README](../README.md) |
| Contributor | [Contributing guide](../CONTRIBUTING.md) |
| Product or design reviewer | [Product truth](authority/PRODUCT_TRUTH.md) |
| WebMCP implementer | [WebMCP tool contract](contracts/WEBMCP_TOOL_CONTRACT.md) |
| Security reviewer | [Security policy](../SECURITY.md) and [security/privacy contract](quality/SECURITY_AND_PRIVACY.md) |
| Release operator | [Deployment and operations](delivery/DEPLOYMENT_AND_OPERATIONS.md) |

## Product and user experience

- [Product truth](authority/PRODUCT_TRUTH.md): audience, real problem, one deep
  slice, authority boundary, claims, and non-goals.
- [UX specification](product/UX_SPEC.md): visible states, review language,
  keyboard path, recovery, and responsive behavior.
- [Hackathon scope](hackathon-build/scope.md), [PRD](hackathon-build/prd.md), and
  [technical specification](hackathon-build/spec.md): build intent and
  acceptance criteria.

## Architecture and contracts

- [Architecture](architecture/ARCHITECTURE.md): runtime layers, request paths,
  D1 transactions, and trust boundaries.
- [Domain model](architecture/DOMAIN_MODEL.md): revisions, proposals, reviews,
  rehearsals, receipts, and audit records.
- [WebMCP tool contract](contracts/WEBMCP_TOOL_CONTRACT.md): the exact four tools,
  strict schemas, outputs, lifecycle, and negative authority rules.
- [Retrieval and RRF specification](retrieval/RETRIEVAL_AND_RRF_SPEC.md) and
  [benchmark](retrieval/RRF_BENCHMARK.md): deterministic evidence retrieval and
  its measured limits.

## Quality and safety

- [Accessibility and verification](quality/ACCESSIBILITY_AND_VERIFICATION.md)
- [Security and privacy contract](quality/SECURITY_AND_PRIVACY.md)
- [Test strategy](quality/TEST_STRATEGY.md)
- [Traceability matrix](quality/TRACEABILITY_MATRIX.md)
- [Third-party notices](../THIRD_PARTY_NOTICES.md)
- [Provenance ledger](evidence/PROVENANCE_LEDGER.md)

## Release and submission

- [R10 public release](https://github.com/chvignesh07/focus-contract-studio/releases/tag/webmcp-challenge-2026-r10): exact live source, screenshots, and supported-client traces.
- [Execution state](evidence/EXECUTION_STATE.md): checkpoint-by-checkpoint state;
  historical rows retain the truth known when recorded.
- [Evidence registry](delivery/EVIDENCE_REGISTRY.md): evidence ownership and
  claim boundaries.
- [Deployment and operations](delivery/DEPLOYMENT_AND_OPERATIONS.md): external
  release sequence and rollback controls.
- [Submission plan](delivery/SUBMISSION_PLAN.md) and
  [Devpost draft](../devpost-submission.md): submission material. The demo video
  and final Devpost submission remain pending.

## Historical records

Files under `evidence/` and earlier package documents are intentionally
append-only snapshots. A historical `NOT_RUN` or `BLOCKED` statement describes
that checkpoint; it does not override a later, separately evidenced public
release. Use the annotated R10 release for current deployed-source proof.
