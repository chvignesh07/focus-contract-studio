# Focus Contract Studio — Provenance, AI Disclosure, and Licensing

Status: **RELEASE CONTRACT**

## Original work boundary

Focus Contract Studio is a new isolated project. Its product code, synthetic corpus, benchmark judgments, UI, tests, diagrams, and documentation are created for this challenge.

No Clivus source code, data, database files, embeddings, graph data, prompts, models, secrets, repository history, or technical identifiers are copied. The only reused idea is independently restated: retrieved memory is evidence and cannot authorize a mutation.

## Algorithm provenance

RRF is implemented clean-room from the published formula and this pack's frozen specification/tests:

- Gordon V. Cormack, Charles L. A. Clarke, and Stefan Büttcher, “Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods,” SIGIR 2009. [DOI page](https://dl.acm.org/doi/10.1145/1571941.1572114).

The implementation uses no copied reference code. The report attributes the paper and distinguishes the published method from our eligibility, rankers, conflicts, benchmark, and authorization boundary.

## Official implementation references

Use and cite current primary sources:

- [ChatGPT Sites documentation](https://learn.chatgpt.com/docs/sites)
- [ChatGPT Site tools/WebMCP documentation](https://learn.chatgpt.com/docs/webmcp)
- [WebMCP draft specification](https://webmachinelearning.github.io/webmcp/)
- [Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp)
- [Chrome secure WebMCP tools](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [Cloudflare D1 documentation](https://developers.cloudflare.com/d1/)
- [Zod JSON Schema documentation](https://zod.dev/json-schema)
- [WAI-ARIA dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing)

Research notes may inform decisions, but implementation claims cite primary sources or current test evidence.

## Repository license

The new public repository uses Apache License 2.0 with a root `LICENSE` file and concise notice in the README. Copyright line uses the actual individual entrant name and 2026.

Do not claim that Apache-2.0 relicenses dependencies, generated third-party code, fonts, logos, or external documentation. Preserve generated notices and licenses.

## Dependency policy

- Use only necessary packages from the selected stack.
- Commit lockfile and exact-pin direct additions.
- Generate a dependency/license inventory on the release commit.
- Allowed by default: permissive licenses compatible with Apache-2.0, subject to actual text and obligations.
- GPL/AGPL/SSPL, source-available, noncommercial, unknown, or custom licenses require explicit review before introduction; the default action is exclusion.
- Include required notices/attribution in `THIRD_PARTY_NOTICES.md`.
- Do not copy code from snippets, tutorials, repositories, Claude/ChatGPT outputs with uncertain source provenance, or old local projects merely because it is convenient.

## Assets and branding

- Use original CSS/vector primitives or assets whose license and source are recorded.
- Prefer no external illustrations, stock photos, icon pack, web font, audio, or video clip.
- Do not use OpenAI, ChatGPT, Devpost, Chrome, or sponsor logos in a way that implies endorsement. Follow published brand rules if a mark is used.
- Screenshots show our product and permitted browser/client UI only.
- Demo narration/music is original or separately licensed and attributed; safest release uses original voice narration without background music.

## Synthetic data statement

The 36 precedent records and 30 benchmark queries are synthetic. They do not contain customer, employee, Clivus, or private conversation data. Record rationales are examples for a bounded evaluation, not published accessibility policy or legal advice.

## AI usage disclosure

Devpost disclosure states truthfully:

- ChatGPT/Codex helped research current official documentation, refine product/architecture, create code/tests/documentation, and review the release.
- Claude supplied an advisory plan review; its suggestions were not treated as decisions.
- ChatGPT is also the runtime reasoning client through WebMCP.
- The Site itself does not call a hidden model API; deterministic application code performs persistence, ranking, authorization, application, and verification.
- The founder selected the product scope and reviews the exact release. Inside the product, mutation approval is an explicit UI-mediated reviewer decision; no claim is made that the platform can attest a biological human.

Do not imply that AI output was independently verified unless the relevant test/review evidence exists.

## Provenance ledger

The Site repository must maintain `docs/evidence/PROVENANCE_LEDGER.md` with:

| Item | Origin | License/terms | Modification | Release path |
|---|---|---|---|---|
| Sites generated scaffold | exact generator/version/command | generated package terms | documented | repository paths |
| Direct dependencies | package/version/source | detected license | configuration only | lockfile/notices |
| RRF formula | 2009 paper | bibliographic method | clean-room code/spec | retrieval module/docs |
| Product corpus | original synthetic | Apache-2.0 repository content | n/a | fixtures |
| Visual assets | original or named source | named license | named | public assets |
| AI-assisted files | Codex/Claude role | entrant-reviewed original output | reviewed/edited | named paths |

## Release checks

- public repository contains `LICENSE`, README, notices, provenance ledger, AI disclosure, and source/build instructions;
- dependency/license scanner has no unresolved prohibited/unknown package;
- secret scanner and Git history scan pass;
- no Clivus path, identifier, private data, or copied source appears;
- no unlicensed media appears in product, video, or submission;
- repository history begins within the challenge period or clearly documents any permitted preexisting scaffold and all challenge-period work, per official rules.
- benchmark v1 remains preserved and labeled invalid; v2 inputs/evaluator/calibration match `SHA256SUMS-v2`; release claims cite only the independently reproduced exact-source report.
