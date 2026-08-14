# Git ref inventory

Canonical head: `90bf8d151fd72447f4392556f246fb89c87d461e`. Generated at 2026-08-14T17:22:15.420Z.

- Remote refs: 187
- Fully integrated tips: 113
- Tips not ancestral to canon: 74

## Non-integrated categories

- DEPENDENCY_UPDATE: 8
- DOCUMENTATION_OR_RECOVERY: 14
- FEATURE_OR_HISTORICAL_REVIEW: 40
- HISTORICAL_BACKUP: 7
- TEST_OR_EVIDENCE: 5

## Commit patch states for bounded branches

- DIVERGED_REVIEW: 188
- EMPTY: 3
- LARGE_PATCH_REVIEW: 30
- PATCH_APPLICABLE: 23
- PATCH_PRESENT: 36

Exact refs, SHAs, subjects, merge bases and bounded commit audits are stored in `git-ref-inventory.json`.

- PATCH_PRESENT proves textual patch equivalence only; it does not prove semantic equivalence.
- DIVERGED_REVIEW may already be represented by later rewritten code and requires module-level comparison.
- Branches with more than 25 ahead commits are not patch-applied commit-by-commit to avoid false confidence and excessive destructive-looking operations.
