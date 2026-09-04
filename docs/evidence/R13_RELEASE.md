# R13 Final Release Record

Status: **PUBLIC RELEASE — SOURCE, DEPLOYMENT, AND LIVE CHATGPT FLOW BOUND**

| Identity | Current value |
|---|---|
| Source tag | `webmcp-challenge-2026-r13` — annotated and public |
| Source commit | `3a37d92cb22d39602acbb3bd323f40a8c96e70d8` |
| Source tree | `4011d1c91b714acea84f229fc4de694df4b4c413` |
| Release branch | `release/webmcp-challenge-2026-r13` |
| GitHub release | `https://github.com/chvignesh07/focus-contract-studio/releases/tag/webmcp-challenge-2026-r13` |
| Sites project | `appgprj_6a945a8b39088191b745c2e9d5d7baa7` |
| Sites saved version | `13` (`appgprj_6a945a8b39088191b745c2e9d5d7baa7~appgver_78506b4084108191a4a3e9c9b1325924`) |
| Sites archive | 102 files; `sha256:fab0d07d6839e25e0168cf824fecab1ce43841aacb1a2626a513a75919d7523c` |
| Public URL | `https://focus-contract-studio-package-0.newmailforyouvignesh.chatgpt.site/` |
| Deployment | `PASS`; `appgdep_6a9a6f2a52d081918f5b700cecc19f78`; succeeded `2026-09-04T07:12:02Z` |
| Fresh supported-client flow | `PASS`; ChatGPT desktop in-app browser, 2026-09-04 |

## Release scope

- Keeps the exact four page-bound WebMCP tools and visible-only approval
  boundary.
- Refreshes visible review/history state after successful agent mutations.
- Distinguishes a fresh revision-changing apply from an idempotent replay.
- Corrects the judge sequence so a finalized opening observation exists before
  review.

## Verification evidence

- Canonical clean-source `npm run verify`: `PASS`
- Package 8 built-Worker browser/security/accessibility suite: `5/5 PASS`
- Package 8 release integrity: `PACKAGE8_RELEASE_PASS packages=724 checks=16`
- TypeScript, ESLint, production builds, responsive/keyboard journeys, local
  links, dependency licenses, source bindings, and Gitleaks: `PASS`
- npm audit: zero vulnerabilities
- R13 annotated-tag and runtime-source identity: `PASS`
- Sites version 13 source commit and production deployment: `PASS`

## Fresh public supported-client proof

Against the public version-13 deployment, ChatGPT's in-app browser:

1. Discovered exactly the four `fcs-webmcp-v2` tools.
2. Finalized the revision-1 opening observation as `OBSERVED DELETE`.
3. Read the bounded review and created proposal
   `6bd47b51-6bf1-4a5c-b48f-89368319dd45`; the page refreshed and remained
   revision 1 / `NOT APPLIED`.
4. Applied only after visible human approval. Receipt
   `0ad3df9b-4661-4011-91dc-c2478b52305b` advanced revision 1 to 2, and the
   page reported `revision changed: YES` without a manual reload.
5. Repeated the same idempotency key. The same receipt was recovered,
   revision remained 2, and the page truthfully reported
   `revision changed: NO`.
6. Completed revision-2 rehearsal
   `43ddfcc0-cf2f-4d2c-92c9-bbfcd9365928`; the exact page-bound target passed
   all six focus checks.

R10 remains the historical Chrome trace for the same four-tool contract. No
claim is made that Chrome reran R13. The public YouTube URL, entrant residence
answer, and final Devpost submission remain external submission steps.
