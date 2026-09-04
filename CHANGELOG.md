# Changelog

This file records public product releases and later repository-only changes.
The live deployment remains bound to its named annotated release unless a newer
release explicitly replaces it.

## [webmcp-challenge-2026-r11] - 2026-09-04

### Product presentation

- Rebuilt the first-screen narrative around the concrete Delete-versus-Cancel
  decision and the line: “The agent can propose. Only you can approve.”
- Added a compact Browser → Agent → Reviewer → Browser authority map, a sticky
  six-step protocol rail, denser evidence hierarchy, and responsive editorial
  layout without adding a runtime dependency.
- Added purposeful scroll progress and depth transitions with a complete
  reduced-motion path.
- Re-ran the current-schema full browser journey at desktop, 320 px, 375 px,
  and 640 CSS px at DPR 2, including keyboard flow and serious/critical Axe
  checks.

### Repository presentation

- Reframed the README around the Delete-versus-Cancel user story and the
  page-bound human-agent workflow.
- Added first-party R10 screenshots with byte-level provenance.
- Added reproducible environment guidance, contributor documentation, security
  reporting, a code of conduct, a documentation index, and a structured bug
  report form.
- Reconciled repository copy with the already-public R10 release while keeping
  the demo video and final Devpost submission pending.
- Corrected the canonical binding gate so the historical R10 assertion remains
  fixed to the immutable R10 tag while post-R10 paths are explicit and the R11
  visual source receives its own immutable tag binding.

The R10 source and evidence remain immutable. R11 is published at commit
`cc9fd46f92cc51445d9d2b9ee36ff6f3300242e5`, saved as ChatGPT Sites version
11, and deployed successfully to the public Site.

## [webmcp-challenge-2026-r10] - 2026-09-03

- Published the exact source for the live Focus Contract Studio Site.
- Exposed exactly four page-bound `fcs-webmcp-v2` tools.
- Preserved visible human approval while enabling agent read, proposal, guarded
  apply, and verification.
- Published ChatGPT and Chrome WebMCP traces plus judge-facing screenshots.
- Passed the canonical local release gate and exact R10 source binding.

[webmcp-challenge-2026-r10]: https://github.com/chvignesh07/focus-contract-studio/releases/tag/webmcp-challenge-2026-r10
[webmcp-challenge-2026-r11]: https://github.com/chvignesh07/focus-contract-studio/releases/tag/webmcp-challenge-2026-r11
