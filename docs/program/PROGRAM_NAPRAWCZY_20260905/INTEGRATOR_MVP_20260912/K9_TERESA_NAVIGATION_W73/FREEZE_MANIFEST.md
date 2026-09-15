# K9 freeze manifest — E1 refreeze after second independent HOLD

- Package: W73 K9, P-T13 variant B plus admin/settings module grounding.
- Base: `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`.
- Product commit: `2a165fa1f18b3f646f7ff19ab1ee0f6178833810`.
- Product tree: `777efe7ba273aab6d44452b9b113684c7a55c6fe`.
- Branch: `codex/a-k9-teresa-manifest-20260915`.
- Expected backup: `origin/backup/codex/a-k9-teresa-manifest-20260915`.
- State: `READY_FOR_NEW_INDEPENDENT_REVIEW_AFTER_P1_CORRECTION`.
- Integration: `NOT_DONE`.
- Deployment: `NOT_DONE`.
- Database migration: `NONE`.
- UI screenshot: `N/A_MANIFEST_AND_PROMPT_ONLY`.

Frozen behavioral denominator:

- target test files: 5;
- target tests: 28 passed, 0 failed;
- routing importer comparison: candidate 248 passed / 1 pre-existing failed; base 246 passed / same named failure; the two candidate passes are the manifest-mirror and runtime-gate inventory contracts;
- hidden-module prompt mentions: 0 for role-, organization-, and runtime-flag exclusions;
- feature-flag query fault: 0 of 5 organization-gated entries, labels or routes in EN and PL;
- stale JWT `ADMIN` with current membership `MEMBER`: 0 admin labels, routes, data queries or citations;
- Projects runtime OFF: 0 Projects labels, click paths, routes or citations in EN and PL;
- Projects runtime ON: exact localized UI click path present in EN and PL;
- manifest drift: 0 entries;
- server TypeScript errors: 0;
- frontend TypeScript errors: 177 (limit 177);
- frontend `--listFiles`: diagnostic only and not frozen; observed 7424-7427 across linked environments because absolute dependency paths are environment-owned;
- list canon: 349;
- artifact canon: 8 / 0 / 117;
- new `as any`: 0;
- migrations: 0;
- forbidden paths: 0.
- diff-check against exact base: RC 0.

The evidence files and their full SHA-256 hashes are recorded in `evidence/k9-teresa-navigation-20260915/SHA256SUMS.txt`. A new independent reviewer must verify the exact package commit, product tree and evidence hashes, rerun the 28-test denominator, fault the flag query, repeat the stale-token role downgrade, and exercise Projects runtime OFF and ON.
