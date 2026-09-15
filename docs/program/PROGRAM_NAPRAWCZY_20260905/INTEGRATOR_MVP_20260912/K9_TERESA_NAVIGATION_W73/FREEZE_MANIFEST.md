# K9 freeze manifest — E1

- Package: W73 K9, P-T13 variant B plus admin/settings module grounding.
- Base: `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`.
- Product checkpoint: `197039091f`.
- Branch: `codex/a-k9-teresa-manifest-20260915`.
- Expected backup: `origin/backup/codex/a-k9-teresa-manifest-20260915`.
- State: `READY_FOR_INDEPENDENT_REVIEW`.
- Integration: `NOT_DONE`.
- Deployment: `NOT_DONE`.
- Database migration: `NONE`.
- UI screenshot: `N/A_MANIFEST_AND_PROMPT_ONLY`.

Frozen behavioral denominator:

- target test files: 3;
- target tests: 17 passed, 0 failed;
- routing importer comparison: candidate 227 passed / 1 pre-existing failed; base 227 passed / same named failure;
- hidden-module prompt mentions: 0 for role-, organization-, and runtime-flag exclusions;
- manifest drift: 0 entries;
- server TypeScript errors: 0;
- frontend TypeScript errors: 177 (limit 177);
- frontend listFiles: 7427;
- list canon: 349;
- artifact canon: 8 / 0 / 117;
- new `as any`: 0;
- migrations: 0;
- forbidden paths: 0.

An independent reviewer must verify the exact package commit, inspect role precedence and fail-closed behavior, rerun the 17-test denominator, and confirm that no excluded module label reaches `systemInstructionAddon`.

