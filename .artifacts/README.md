# Local and release artifacts

These directories mirror `docs/delivery/EVIDENCE_REGISTRY.md`. Store only bounded, non-sensitive machine evidence. Never store credentials, cookies, raw authenticated headers, full identity values, IP addresses, private account content, or typed user data.

Package 0 commits deterministic summaries where useful. Later raw CI/live artifacts may be retained outside Git and referenced by hash under the release evidence contract.

Package 2 commits three sanitized source-bound summaries:

- `test/package2-local-gate.json` records canonical local test/build/audit totals and preserves the hosted blocker.
- `browser/package2-local-journey.json` records the real built-Worker/disposable-D1 browser journey, accessibility totals, and remote-binding state.
- `security/package2-security.json` records fail-closed proposal/tool boundaries, dependency audits, and redacted secret-scan results.

`test/package2-source-manifest.json` is the byte-level binding for those summaries. None is evidence of a Site save, deployment, hosted D1 mutation, or supported ChatGPT client execution.
