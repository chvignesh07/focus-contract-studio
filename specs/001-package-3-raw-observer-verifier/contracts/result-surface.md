# Accessible Result Surface Contract

## Accessible result contract

After a finalized rehearsal is verified, the page exposes:

- named implemented revision and bounded environment;
- captured dialog role/open/modal/name/description facts;
- manifest and event digest abbreviations without raw session/workspace material;
- overall `pass` or `fail` in text, not color alone;
- exactly six named result rows in canonical order;
- each row's `pass | fail | not_observed` text and raw event sequence references;
- a plain-language boundary: verification compares one new raw rehearsal with the named implemented revision; it does not prove approval, general conformance, or human operation.

The result is a semantic heading plus list/table whose names and status text remain keyboard/screen-reader accessible. Sequence references are copyable text. Icons/color may reinforce but never replace status words.

## Interaction and announcements

- Start/finalize/verify controls have visible focus and stable disabled/busy text.
- One restrained status region announces operation-level transitions and the final overall result.
- Raw events and individual sequence changes are not live-announced.
- Errors are associated with the relevant control and use the safe public message.
- Closing the rehearsal dialog returns focus to `delete-trigger`; results do not steal focus unless explicit error recovery requires it.

## Dialog/browser evidence

The actual browser journey asserts the open dialog's accessible name, description, modal semantics, and blocked background pointer/keyboard focus. It completes forward order/wrap, backward wrap, Escape close before destructive dispatch, and return focus from user/browser events. Desktop, 320 px, 375 px, and 200% zoom keep every actionable focused control visible, within viewport, and unobscured without two-dimensional scrolling. Reduced-motion behavior and zero critical/serious axe findings are separate checks.

## Privacy and evidence status

The UI never displays typed values, arbitrary DOM text, raw event arrays, cookies/tokens/CSRF, workspace IDs, or private identity. Planning/mock/local HTTP/screenshot output cannot mark browser, accessibility, privacy, security, or verifier evidence `PASS`. Founder Safari/Chrome/VoiceOver and exact hosted-release checks remain later evidence with named operator/runtime/source identity.
