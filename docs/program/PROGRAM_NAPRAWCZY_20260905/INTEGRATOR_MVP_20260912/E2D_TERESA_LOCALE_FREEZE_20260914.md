# A/E W53–W55 E2d Teresa locale — freeze receipt

**Verdict: READY_FOR_INDEPENDENT_REVIEW.** DEC-510 locale resolution and the final prompt-language instruction are implemented and rebased without conflict onto required base `08c1bb7a2614a84092b8c4ed52404df69dcfd907`; no migration or response-schema change was made.

## Seven bounded positions delivered

1. `languagePolicy.ts` owns `ResolvedLocale` and the asynchronous resolver. An explicit request locale remains a documented compatibility override; otherwise the order is exactly `users.language` → legacy `users.locale` → `organizations.default_language` → `en`. Every resolved result is retained on `req.resolvedLocale`.
2. The same module owns one idempotent prompt helper. It preserves later prompt additions, moves its own block to the end, and ends with the literal `Answer in {resolvedLocale}.` instruction.
3. Express request typing exposes `resolvedLocale` without changing any API body.
4. `AIPipeline` applies the helper after adaptive preferences and learned instructions in both standard and dedicated modes. The former earlier language block was removed.
5. Teresa `/chat/confirm` and `/chat/stream` use the asynchronous resolver. Existing explicit `body.language` behavior remains compatible; output schemas and response assembly are unchanged.
6. Five presentation calls use the same helper: brief content pack, layout director, layout variants generate, layout variants remix, and template draft. Existing system content is English; Polish user-visible input stays parameterized by the selected locale.
7. Behavioral and caller tests cover `en` with a Polish question, `pl`, idempotence, a later addon preserved and moved before the final instruction, the complete DB/request fallback order, request persistence, and presentation caller wiring.

## Evidence after required rebase

- Pre-rebase content commit: `2c52e8caf373fbfcb8f8717228244e2f9240dadb`; exact backup `backup/codex/a-e2d-teresa-locale-20260914-2c52e8caf3-20260914`.
- Rebase onto `08c1bb7a26` completed without conflicts; rebased content commit `38d98f424eb0e3173541921daa9e5b4dcfc7877d`.
- RED before implementation: language policy **10 failed / 14 passed**.
- GREEN after rebase: **5 files / 58 tests passed**, `--retry=0`.
- Covered siblings: language policy 24, deck brief 5, layout director 8, layout variants 10, presentation template draft 11.
- Server TypeScript: exact new base **1 error** (`rateLimitUserId.middleware.ts` TS2664), candidate **0 errors**.
- Original content commit hooks: Teresa contract **19/19**; artifact, labels, density and language ratchets passed.
- `git diff --check`: clean.
- RealPG: not required. Database interaction is read-only and its precedence/query contract is isolated with `DbPromise` behavior tests; no migration exists.

## Freeze identities

- Exact base: `08c1bb7a2614a84092b8c4ed52404df69dcfd907`
- Content commit: `38d98f424eb0e3173541921daa9e5b4dcfc7877d`
- Exact rebased backup: `backup/codex/a-e2d-teresa-locale-20260914-38d98f424e-20260914`
- Freeze manifest: `evidence/a-e2d-teresa-locale/freeze-manifest.json` (self-excluding)

STOP before independent review as required by W53/W55.
