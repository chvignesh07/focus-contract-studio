# Release Client Matrix

Release target: `webmcp-challenge-2026-r13`
Application: [Focus Contract Studio](https://focus-contract-studio-package-0.newmailforyouvignesh.chatgpt.site/)

Historical package checkpoints retain their original `NOT_RUN` boundaries. This matrix is the executable judge-facing release contract; immutable post-deploy traces and exact client versions are attached to the matching GitHub release after qualification.

| Client / surface | Setup | Release acceptance |
|---|---|---|
| ChatGPT/Codex desktop in-app browser | Open the public application URL; WebMCP is available in the supported in-app surface | Discover exactly four tools; finalized opening observation → read → create → visible UI approval → apply → complete browser rehearsal → read exact `verificationTarget` → verify six checks |
| Google Chrome 152.0.7977.66 | Enable `chrome://flags/#enable-webmcp-testing`, restart, then open the public URL | Same four-tool journey in two isolated signed-out profiles; each begins with a distinct anonymous workspace |
| Ordinary browser without WebMCP | Open the public URL | Complete keyboard-accessible human workflow remains usable; this is fallback evidence, not a WebMCP-client claim |

## Exact in-app judge sequence

1. Choose **Reset demo** if the page is not at implemented revision 1.
2. Choose **Run opening rehearsal**, confirm focus lands on **Delete**, then close with **Cancel**. Wait for `OBSERVED DELETE` so the baseline observation is finalized.
3. Ask the agent to read the active focus review and create the evidence-backed Cancel-first proposal.
4. Confirm the proposal is visibly `NOT APPLIED`; check the exact-review acknowledgement and approve it in the page.
5. Ask the agent to apply the exact approved proposal.
6. Run the complete keyboard rehearsal shown by the page.
7. Ask the agent to read again and verify the exact returned `verificationTarget`.
8. Confirm implemented revision 2 and six passing checks: initial focus, focus order, forward wrap, backward wrap, Escape, and return focus.

No database console, API client, developer tools, credentials, workspace ID, cookie, CSRF value, or manually copied rehearsal ID belongs in the judge path.
