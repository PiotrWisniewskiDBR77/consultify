# K9 freeze manifest — E1 refreeze after independent HOLD

- Package: W73 K9, P-T13 variant B plus admin/settings module grounding.
- Base: `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`.
- Product commit: `6f77b9406f9a7dadc1b10467fc08a1a8f5f0be66`.
- Product tree: `73a4da0f5cf943d4408d97c806ec51e58e0dd622`.
- Branch: `codex/a-k9-teresa-manifest-20260915`.
- Expected backup: `origin/backup/codex/a-k9-teresa-manifest-20260915`.
- State: `READY_FOR_NEW_INDEPENDENT_REVIEW_AFTER_P1_CORRECTION`.
- Integration: `NOT_DONE`.
- Deployment: `NOT_DONE`.
- Database migration: `NONE`.
- UI screenshot: `N/A_MANIFEST_AND_PROMPT_ONLY`.

Frozen behavioral denominator:

- target test files: 4;
- target tests: 20 passed, 0 failed;
- routing importer comparison: candidate 247 passed / 1 pre-existing failed; base 246 passed / same named failure; the extra candidate pass is the new manifest-mirror contract;
- hidden-module prompt mentions: 0 for role-, organization-, and runtime-flag exclusions;
- feature-flag query fault: 0 of 5 organization-gated entries, labels or routes in EN and PL;
- stale JWT `ADMIN` with current membership `MEMBER`: 0 admin labels, routes, data queries or citations;
- manifest drift: 0 entries;
- server TypeScript errors: 0;
- frontend TypeScript errors: 177 (limit 177);
- frontend listFiles: 7427;
- list canon: 349;
- artifact canon: 8 / 0 / 117;
- new `as any`: 0;
- migrations: 0;
- forbidden paths: 0.
- diff-check against exact base: RC 0.

The evidence files and their full SHA-256 hashes are recorded in `evidence/k9-teresa-navigation-20260915/SHA256SUMS.txt`. A new independent reviewer must verify the exact package commit, product tree and evidence hashes, rerun the 20-test denominator, fault the flag query, and repeat the stale-token role downgrade.
