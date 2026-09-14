# A/E W53–W56 E2d Teresa locale — freeze receipt

**Verdict: READY_FOR_INDEPENDENT_REVIEW.** DEC-510 locale resolution and the final prompt-language instruction are implemented and rebased without conflict onto required base `19b633c81e262b9f3c2f25b0555b2dfceab8b42e`; no migration or response-schema change was made.

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
- W56 rebase onto `19b633c81e` completed without conflicts; rebased content commit `665130039474fd158772cd2fe0bf04df9c7105d7`. The previously reviewed freeze was `52aaf2fd30822e84bfca0178d9a684e34c4702a4`.
- RED before implementation: language policy **10 failed / 14 passed**.
- GREEN after W56 rebase: **5 files / 58 tests passed**, `--retry=0`; source wiring **5/5**; changed RealPG suite **5/5**, collected with no skip.
- Covered siblings: language policy 24, deck brief 5, layout director 8, layout variants 10, presentation template draft 11.
- Server TypeScript after W56 rebase: exact base **0 errors**, candidate **0 errors**.
- Original content commit hooks: Teresa contract **19/19**; artifact, labels, density and language ratchets passed.
- `git diff --check`: clean.
- Fresh RealPG proof repeated after W56 rebase: `cx-a-e2d-pg`, PG18+vector, `127.0.0.1:5330/consultify_e2d`; strict schema migration passed. `RUN_DB_TESTS=1 MOCK_DB=false` collected and passed the changed `managementReports.titleLanguage.realdb.test.ts` **5/5**, with **0 skipped**. The package adds no migration.

## Freeze identities

- Exact base: `19b633c81e262b9f3c2f25b0555b2dfceab8b42e`
- Content commit: `665130039474fd158772cd2fe0bf04df9c7105d7`
- Previous exact backup: `backup/codex/a-e2d-teresa-locale-20260914-review-fix-52aaf2fd30-20260914`
- Freeze manifest: `evidence/a-e2d-teresa-locale/freeze-manifest.json` (self-excluding)

STOP before independent review as required by W56.
